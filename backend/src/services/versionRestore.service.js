import mongoose from "mongoose";
import * as Y from "yjs";
import Version from "../models/version.model.js";
import Document from "../models/document.model.js";
import YjsUpdate from "../models/yjsUpdate.model.js";
import { setYDoc } from "../socket/yjsStore.js";
import { removeAwareness } from "../socket/awarenessStore.js";
import { saveTimers, withDocumentWriteLock } from "../socket/store.js";
import { clearAccumulator } from "../socket/yjsAccumulator.js";

export async function restoreVersionState(documentId, versionId) {
    console.log("[restoreVersion] Controller reached");

    const version = await Version.findById(versionId);

    if (!version || version.document.toString() !== documentId) {
        throw new Error("Version not found for this document");
    }

    if (!version.yjsState?.length) {
        throw new Error("This version has no Yjs snapshot");
    }

    return withDocumentWriteLock(documentId, async () => {
        const restoredYDoc = new Y.Doc();
        const session = await mongoose.startSession();

        try {
            Y.applyUpdate(
                restoredYDoc,
                new Uint8Array(version.yjsState)
            );

            const restoredState = Y.encodeStateAsUpdate(restoredYDoc);

            let document;

            await session.withTransaction(async () => {
                // Restore snapshot and advance generation atomically.
                document = await Document.findOneAndUpdate(
                    { _id: documentId },
                    {
                        $set: {
                            title: version.title,
                            yjsState: Buffer.from(restoredState),
                            updateSequence: 0,
                            snapshotSequence: 0,
                        },
                        $inc: {
                            generation: 1,
                        },
                    },
                    {
                        new: true,
                        runValidators: true,
                        session,
                    }
                );

                if (!document) {
                    throw new Error("Document not found");
                }

                // Remove update records from previous generations.
                await YjsUpdate.deleteMany(
                    { document: documentId },
                    { session }
                );
            });

            // Cancel any pending local save.
            const timer = saveTimers.get(documentId);

            if (timer) {
                clearTimeout(timer);
                saveTimers.delete(documentId);
            }

            // Clean up any pending accumulator updates from previous generation.
            await clearAccumulator(documentId);

            // Clean up old awareness state.
            removeAwareness(documentId);

            // Replace the local cached Y.Doc.
            const previousYDoc = setYDoc(
                documentId,
                restoredYDoc
            );

            if (previousYDoc) {
                previousYDoc.destroy();
            }

            console.log("[restoreVersion] Successfully restored:", {
                documentId,
                generation: document.generation,
            });

            return {
                document,
                restoredYDoc,
                generation: document.generation,
            };

        } catch (error) {
            restoredYDoc.destroy();
            throw error;

        } finally {
            await session.endSession();
        }
    });
}