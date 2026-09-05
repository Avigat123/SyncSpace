import * as Y from "yjs";
import Document from "../../models/document.model.js";
import { activeUsers } from "../store.js";
import { getYDoc } from "../yjsStore.js";
import { getAwareness } from "../awarenessStore.js";

export default function joinDocument(io, socket) {

    return async function (documentId) {

        try {

            // 1. Find the document
            const document = await Document.findById(documentId);

            if (!document) {
                return socket.emit("error", "Document not found");
            }

            // 2. Check ownership / collaborator access BEFORE initializing ydoc
            const isOwner =
                document.owner.toString() === socket.user._id.toString();

            if (!isOwner) {
                const collaborator = document.collaborators.find(
                    c => c.user.toString() === socket.user._id.toString()
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

            const roomSize = io.sockets.adapter.rooms.get(documentId)?.size ?? 0;
            console.log(`[joinDocument] socket=${socket.id} joined docId=${documentId} roomSize=${roomSize}`);

            // 5. Awareness placeholder (kept for future use)
            await getAwareness(documentId);

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