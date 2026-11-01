import mongoose from "mongoose";
import * as Y from "yjs";
import Document from "../models/document.model.js";
import YjsUpdate from "../models/yjsUpdate.model.js";
import { withDocumentWriteLock } from "../socket/store.js";

export async function compactYjsDocument(documentId) {
    return withDocumentWriteLock(documentId, async () => {
        const session = await mongoose.startSession();

        try {
            let result = null;

            await session.withTransaction(async () => {
                const document = await Document.findById(documentId)
                    .session(session);

                if (!document) {
                    throw new Error("Document not found");
                }

                const generation = document.generation ?? 0;
                const snapshotSequence = document.snapshotSequence ?? 0;
                const updateSequence = document.updateSequence ?? 0;

                // Nothing new needs to be compacted.
                const pendingUpdates = updateSequence - snapshotSequence;

                // Avoid compacting too frequently.
                if (pendingUpdates < 100) {
                    result = {
                        compacted: false,
                        reason: "Threshold not reached",
                        pendingUpdates,
                    };
                    return;
                }

                // Fetch updates that are not yet included in the snapshot.
                const updates = await YjsUpdate.find({
                    document: documentId,
                    generation,
                    sequence: {
                        $gt: snapshotSequence,
                        $lte: updateSequence,
                    },
                }).sort({ sequence: 1 }).session(session);

                // Never advance the snapshot over missing updates.
                const expectedUpdates = updateSequence - snapshotSequence;

                if (updates.length !== expectedUpdates) {
                    throw new Error(
                        `Incomplete update log: expected ${expectedUpdates}, found ${updates.length}`
                    );
                }

                const compactedYDoc = new Y.Doc();

                try {
                    // Start with the existing snapshot.
                    if (document.yjsState?.length) {
                        Y.applyUpdate(
                            compactedYDoc,
                            new Uint8Array(document.yjsState)
                        );
                    }

                    // Replay all updates in sequence.
                    for (const record of updates) {
                        Y.applyUpdate(
                            compactedYDoc,
                            new Uint8Array(record.update)
                        );
                    }

                    const newSnapshot = Y.encodeStateAsUpdate(compactedYDoc);

                    // Save the snapshot and its sequence boundary.
                    const updateResult = await Document.updateOne(
                        {
                            _id: documentId,
                            ...(generation === 0
                                ? {
                                    $or: [
                                        { generation: 0 },
                                        { generation: { $exists: false } },
                                    ],
                                }
                                : { generation }),
                            updateSequence,
                        },
                        {
                            $set: {
                                yjsState: Buffer.from(newSnapshot),
                                snapshotSequence: updateSequence,
                            },
                        },
                        { session }
                    );

                    if (updateResult.matchedCount !== 1) {
                        throw new Error(
                            "Document changed during compaction"
                        );
                    }

                    // Delete only updates included in the new snapshot.
                    await YjsUpdate.deleteMany(
                        {
                            document: documentId,
                            generation,
                            sequence: {
                                $lte: updateSequence,
                            },
                        },
                        { session }
                    );

                    result = {
                        compacted: true,
                        generation,
                        previousSnapshotSequence: snapshotSequence,
                        newSnapshotSequence: updateSequence,
                        compactedUpdates: updates.length,
                    };

                } finally {
                    compactedYDoc.destroy();
                }
            });

            console.log("[Yjs Compaction]", {
                documentId,
                ...result,
            });

            return result;

        } catch (error) {
            console.error("[Yjs Compaction] Failed:", error);
            throw error;

        } finally {
            await session.endSession();
        }
    });
}
