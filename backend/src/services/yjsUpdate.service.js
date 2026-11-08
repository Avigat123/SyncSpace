
import mongoose from "mongoose";
import Document from "../models/document.model.js";
import YjsUpdate from "../models/yjsUpdate.model.js";

export async function persistYjsUpdate(documentId, update, generation) {
    const session = await mongoose.startSession();

    try {
        let savedSequence = null;

        await session.withTransaction(async () => {
            const generationFilter = generation === 0
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

            // Atomically increment the sequence only
            // if the document still has the expected generation.
            const document = await Document.findOneAndUpdate(
                generationFilter,
                { $inc: { updateSequence: 1 } },
                { new: true, returnDocument: "after", session }
            );

            if (!document) {
                return;
            }

            // Save the update using the reserved sequence.
            await YjsUpdate.create(
                [{
                    document: documentId,
                    generation,
                    sequence: document.updateSequence,
                    update: Buffer.from(update),
                }],
                { session }
            );

            savedSequence = document.updateSequence;
        });

        if (savedSequence === null) {
            console.log(
                "[Yjs Persistence] Rejected stale update:",
                documentId
            );
            return null;
        }

        console.log("[Yjs Persistence] Update saved:", {
            documentId,
            generation,
            sequence: savedSequence,
        });

        return savedSequence;

    } catch (error) {
        console.error("[Yjs Persistence] Failed:", error);
        throw error;

    } finally {
        await session.endSession();
    }
}
