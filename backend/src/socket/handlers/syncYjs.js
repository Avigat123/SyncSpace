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
            console.log("[Diagnostic:Backend] sync-yjs received:", {
                socketId: socket.id,
                socketDocId: socket.documentId,
                documentId,
                generation,
                bytes: update?.length,
            });

            if (!documentId || (!Array.isArray(update) && !Buffer.isBuffer(update) && !(update instanceof Uint8Array))) return;

            await withDocumentWriteLock(documentId, async () => {

                // 1. Validate authenticated socket
                if (!socket.user || !socket.user._id) {
                    console.warn("[syncYjs] Rejected update: unauthenticated socket");
                    socket.emit("error", "Unauthorized");
                    return;
                }

                // 2. Validate room membership and document ID (with self-heal for room state)
                const isSocketInRoom = socket.rooms.has(documentId);
                if (socket.documentId !== documentId && !isSocketInRoom) {
                    console.warn(
                        "[Diagnostic:Backend] sync-yjs REJECTED: socket outside room:",
                        { socketDocId: socket.documentId, documentId }
                    );
                    return;
                }

                if (!isSocketInRoom) {
                    await socket.join(documentId);
                }
                if (socket.documentId !== documentId) {
                    socket.documentId = documentId;
                }

                // 3. Fast-path editor permission validation using cached socket role
                let role = socket.documentRole;
                if (!role) {
                    const document = await Document.findById(documentId)
                        .select("generation owner collaborators isDeleted")
                        .lean();

                    if (!document || document.isDeleted) {
                        console.warn("[Diagnostic:Backend] sync-yjs REJECTED: Document not found or in trash:", documentId);
                        socket.emit("error", "Document not found or moved to trash");
                        return;
                    }

                    const isOwner = (document.owner?._id || document.owner).toString() === socket.user._id.toString();
                    const collaborator = document.collaborators?.find(
                        c => (c.user?._id || c.user).toString() === socket.user._id.toString()
                    );

                    role = isOwner ? "owner" : collaborator?.role;
                    socket.documentRole = role;
                }

                if (role !== "owner" && role !== "editor") {
                    console.warn("[Diagnostic:Backend] sync-yjs REJECTED: Read-only access for user:", socket.user._id);
                    socket.emit("error", "Read-only access");
                    return;
                }

                const currentGeneration = generation ?? 0;
                const binaryUpdate = Buffer.isBuffer(update) ? new Uint8Array(update) : new Uint8Array(update);

                // 4. Persist the update transactionally (broadcast only after successful persistence)
                let sequence;
                try {
                    sequence = await persistYjsUpdate(
                        documentId,
                        binaryUpdate,
                        currentGeneration
                    );
                } catch (persistErr) {
                    console.error("[Diagnostic:Backend] MongoDB persistence error:", {
                        documentId,
                        error: persistErr.message || persistErr,
                    });
                    socket.emit("error", "Failed to persist document update");
                    return;
                }

                console.log("[Diagnostic:Backend] MongoDB persistence result:", {
                    documentId,
                    sequence,
                    generation: currentGeneration,
                });

                if (sequence === null) {
                    console.warn("[Diagnostic:Backend] Update dropped: stale sequence or generation conflict");
                    return;
                }

                // 5. Apply the update to this backend's Y.Doc.
                const ydoc = await getYDoc(documentId);
                Y.applyUpdate(ydoc, binaryUpdate);

                // 6. Publish to other backend instances via Redis.
                await publishYjsUpdate(
                    documentId,
                    binaryUpdate,
                    currentGeneration
                );

                // 7. Broadcast to connected clients with document and generation integrity
                const roomSize = io.sockets.adapter.rooms.get(documentId)?.size ?? 0;
                socket.to(documentId).emit("yjs-update", {
                    documentId,
                    generation: currentGeneration,
                    update: Array.from(binaryUpdate),
                });

                console.log("[Diagnostic:Backend] Broadcast yjs-update to room:", {
                    documentId,
                    generation: currentGeneration,
                    recipientRoomSize: Math.max(0, roomSize - 1),
                });

                console.log("[syncYjs] Update processed:", {
                    documentId,
                    generation: currentGeneration,
                    sequence,
                });

                // Check whether the compaction threshold has been reached (every 100 updates)
                shouldCompact = sequence > 0 && sequence % 100 === 0;
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
