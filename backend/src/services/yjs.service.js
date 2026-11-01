import * as Y from "yjs";
import Document from "../models/document.model.js";
import { withDocumentWriteLock } from "../socket/store.js";
import YjsUpdate from "../models/yjsUpdate.model.js";
import mongoose from "mongoose";

export async function saveYDoc(documentId, ydoc, generation) {
    return withDocumentWriteLock(documentId, async () => {
        const state = Y.encodeStateAsUpdate(ydoc);

        // Support older documents that don't physically have
        // a generation field in MongoDB.
        const filter = generation === 0
            ? {
                _id: documentId,
                $or: [
                    { generation: 0 },
                    { generation: { $exists: false } },
                ],
            }
            : {
                _id: documentId,
                generation,
            };

        const result = await Document.updateOne(
            filter,
            {
                $set: {
                    yjsState: Buffer.from(state),
                },
            }
        );

        if (result.matchedCount === 0) {
            console.log("[saveYDoc] Skipped stale save:", documentId);
            return;
        }

        console.log("[saveYDoc] Document state saved:", documentId);
    });
}

export async function loadYDoc(documentId) {
    const session = await mongoose.startSession();

    try {
        let document;
        let updates = [];

        await session.withTransaction(async () => {
            // Read the document and counters.
            document = await Document.findById(documentId)
                .session(session);

            if (!document) {
                throw new Error("Document not found");
            }

            const generation = document.generation ?? 0;
            const snapshotSequence = document.snapshotSequence ?? 0;
            const updateSequence = document.updateSequence ?? 0;

            // Read the corresponding update log in the same transaction.
            updates = await YjsUpdate.find({
                document: documentId,
                generation,
                sequence: {
                    $gt: snapshotSequence,
                    $lte: updateSequence,
                },
            }).sort({ sequence: 1 }).session(session);
        });

        // Reconstruct the Y.Doc after obtaining a consistent database view.
        const ydoc = new Y.Doc();

        if (document.yjsState?.length) {
            Y.applyUpdate(ydoc, new Uint8Array(document.yjsState));
        }

        for (const record of updates) {
            Y.applyUpdate(ydoc, new Uint8Array(record.update));
        }

        console.log("[Yjs Recovery] Document reconstructed:", {
            documentId,
            generation: document.generation ?? 0,
            snapshotSequence: document.snapshotSequence ?? 0,
            updateSequence: document.updateSequence ?? 0,
            replayedUpdates: updates.length,
        });

        return ydoc;

    } finally {
        await session.endSession();
    }
}