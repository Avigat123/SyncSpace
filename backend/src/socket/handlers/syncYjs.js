import { enqueueDocumentUpdate } from "../yjsAccumulator.js";
import Document from "../../models/document.model.js";

export default function syncYjs(io, socket) {
    return async function ({ documentId, update, generation, updateId, clientTimings }) {
        const t_server_recv = process.hrtime.bigint();

        try {
            if (!documentId || (!Array.isArray(update) && !Buffer.isBuffer(update) && !(update instanceof Uint8Array) && !(update instanceof ArrayBuffer))) return;

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
                    (c) => (c.user?._id || c.user).toString() === socket.user._id.toString()
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
            const binaryUpdate = Buffer.isBuffer(update)
                ? update
                : update instanceof Uint8Array
                ? Buffer.from(update.buffer, update.byteOffset, update.byteLength)
                : update instanceof ArrayBuffer
                ? Buffer.from(update)
                : Buffer.from(update);

            // 4. Enqueue into per-document accumulator for batched transactional persistence & broadcast
            await enqueueDocumentUpdate({
                io,
                socket,
                documentId,
                generation: currentGeneration,
                binaryUpdate,
                updateId,
                t_server_recv,
            });

        } catch (error) {
            console.error("[syncYjs] Unexpected error:", error);
            socket.emit("error", "An error occurred while synchronizing document updates");
        }
    };
}
