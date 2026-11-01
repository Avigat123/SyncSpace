import * as Y from "yjs";
import { getYDoc } from "../yjsStore.js";
import { withDocumentWriteLock } from "../store.js";
import { persistYjsUpdate } from "../../services/yjsUpdate.service.js";
import { publishYjsUpdate } from "../yjsRedis.js";
import { compactYjsDocument } from "../../services/yjsCompaction.service.js";

import Document from "../../models/document.model.js";

// Avoid scheduling multiple compactions for the same document
// on this backend instance.
const compactionInProgress = new Set();

export default function syncYjs(io, socket) {
    return async function ({ documentId, update, generation }) {
        let shouldCompact = false;

        try {
            if (!documentId || !Array.isArray(update)) return;

            await withDocumentWriteLock(documentId, async () => {

                // Verify that the socket joined this document.
                if (socket.documentId !== documentId) {
                    console.warn(
                        "[syncYjs] Rejected update from socket outside document room:",
                        documentId
                    );
                    return;
                }

                // Fetch document and verify permissions.
                const document = await Document.findById(documentId);

                if (!document) {
                    socket.emit("error", "Document not found");
                    return;
                }

                const currentGeneration = document.generation ?? 0;

                if (generation !== currentGeneration) {
                    console.log("[syncYjs] Rejected stale update:", {
                        documentId,
                        receivedGeneration: generation,
                        currentGeneration,
                    });
                    return;
                }

                const isOwner = document.owner.toString() === socket.user._id.toString();

                const collaborator = document.collaborators.find(
                    c => c.user.toString() === socket.user._id.toString()
                );

                if (!isOwner && !collaborator) {
                    socket.emit("error", "Access revoked");
                    return;
                }

                if (!isOwner && collaborator.role !== "editor") {
                    socket.emit("error", "Read-only access");
                    return;
                }

                const binaryUpdate = new Uint8Array(update);

                // 1. Persist the update transactionally.
                const sequence = await persistYjsUpdate(
                    documentId,
                    binaryUpdate,
                    currentGeneration
                );

                if (sequence === null) return;

                // 2. Apply the update to this backend's Y.Doc.
                const ydoc = await getYDoc(documentId);
                Y.applyUpdate(ydoc, binaryUpdate);

                // 3. Publish to other backend instances.
                await publishYjsUpdate(
                    documentId,
                    binaryUpdate,
                    currentGeneration
                );

                // 4. Broadcast to connected clients.
                socket.to(documentId).emit(
                    "yjs-update",
                    Array.from(binaryUpdate)
                );

                console.log("[syncYjs] Update processed:", {
                    documentId,
                    generation: currentGeneration,
                    sequence,
                });

                // Check whether the compaction threshold has been reached.
                const snapshotSequence = document.snapshotSequence ?? 0;

                shouldCompact = sequence - snapshotSequence >= 100;
            });

            // IMPORTANT: This runs after the write lock is released.
            if (shouldCompact && !compactionInProgress.has(documentId)) {
                compactionInProgress.add(documentId);

                compactYjsDocument(documentId)
                    .catch(error => {
                        console.error(
                            "[syncYjs] Automatic compaction failed:",
                            { documentId, error }
                        );
                    })
                    .finally(() => {
                        compactionInProgress.delete(documentId);
                    });
            }

        } catch (err) {
            console.error("[syncYjs] Update error:", err);
        }
    };
}
