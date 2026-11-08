import * as Y from "yjs";
import { encodeAwarenessUpdate } from "y-protocols/awareness";
import Document from "../../models/document.model.js";
import { activeUsers } from "../store.js";
import { getYDoc } from "../yjsStore.js";
import { getAwareness } from "../awarenessStore.js";
import { getDocumentGeneration, setDocumentGenerationIfNewer } from "../store.js";
import leaveDocument from "./leaveDocument.js";

export default function joinDocument(io, socket) {

    return async function (documentId) {

        try {
            // If socket was previously in a different document, leave it cleanly first
            if (socket.documentId && socket.documentId !== documentId) {
                await leaveDocument(io, socket)(socket.documentId);
            }

            // 1. Find the document
            const document = await Document.findById(documentId);

            if (!document || document.isDeleted) {
                return socket.emit("error", "Document not found or has been moved to trash");
            }

            // 2. Check ownership / collaborator access BEFORE initializing ydoc
            const isOwner =
                (document.owner?._id || document.owner).toString() === socket.user._id.toString();

            if (!isOwner) {
                const collaborator = document.collaborators.find(
                    c => (c.user?._id || c.user).toString() === socket.user._id.toString()
                );

                if (!collaborator) {
                    return socket.emit("error", "Access denied");
                }
            }

            // 3. Get (or create) the server-side Y.Doc
            const ydoc = await getYDoc(documentId);

            // 4. Join the Socket.IO room
            await socket.join(documentId);
            socket.documentId = documentId;

            // Authoritative generation from MongoDB document
            const authoritativeGen = document.generation ?? 0;
            const activeGen = setDocumentGenerationIfNewer(documentId, authoritativeGen);

            const roomSize = io.sockets.adapter.rooms.get(documentId)?.size ?? 0;
            console.log(`[Diagnostic:Backend] joinDocument: socket=${socket.id} joined docId=${documentId} roomSize=${roomSize} generation=${activeGen}`);

            socket.emit("document-generation", {
                documentId,
                generation: activeGen,
            });

            // 5. Awareness synchronization
            const awareness = await getAwareness(documentId);

            // Request existing clients in the room to send their awareness to the newly joined client
            if (roomSize > 1) {
                socket.to(documentId).emit("awareness-sync-request", {
                    documentId,
                    targetSocketId: socket.id,
                });
            }

            // Send existing server-side awareness if any clients are recorded
            const serverClientIds = Array.from(awareness.getStates().keys());
            if (serverClientIds.length > 0) {
                const awarenessUpdate = encodeAwarenessUpdate(awareness, serverClientIds);
                socket.emit("awareness-update", {
                    documentId,
                    update: Array.from(awarenessUpdate),
                });
            }

            // 6. Send current Y.Doc state to the joining client
            const update = Y.encodeStateAsUpdate(ydoc);
            socket.emit("sync-document", Array.from(update));

            // 7. Track active users
            if (!activeUsers.has(documentId)) {
                activeUsers.set(documentId, []);
            }

            const users = activeUsers.get(documentId);

            const alreadyTracked = users.find(u => u.socketId === socket.id);

            if (!alreadyTracked) {
                users.push({
                    socketId: socket.id,
                    userId: socket.user._id,
                    name: socket.user.name,
                });
            }

            io.to(documentId).emit("users-online", users);

        } catch (err) {

            console.error("[joinDocument] Error:", err);
            socket.emit("error", "Something went wrong");

        }

    };

}
