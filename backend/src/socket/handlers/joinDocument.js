import Document from "../../models/document.model.js";
import { activeUsers } from "../store.js";

export default function joinDocument(io, socket) {

    return async function (documentId) {

        try {

            const document = await Document.findById(documentId);

            if (!document) {
                return socket.emit(
                    "error",
                    "Document not found"
                );
            }

            const isOwner =
                document.owner.toString() ===
                socket.user._id.toString();

            if (!isOwner) {

                const collaborator =
                    document.collaborators.find(
                        c =>
                            c.user.toString() ===
                            socket.user._id.toString()
                    );

                if (!collaborator) {
                    return socket.emit(
                        "error",
                        "Access denied"
                    );
                }

            }

            socket.join(documentId);

            socket.documentId = documentId;

            socket.emit("document-loaded", {
                title: document.title,
                content: document.content,
            });

            if (!activeUsers.has(documentId)) {
                activeUsers.set(documentId, []);
            }

            const users =
                activeUsers.get(documentId);

            const exists = users.find(
                user =>
                    user.socketId === socket.id
            );

            if (!exists) {

                users.push({
                    socketId: socket.id,
                    userId: socket.user._id,
                    name: socket.user.name,
                });

            }

            io.to(documentId).emit(
                "users-online",
                users
            );

        } catch (err) {

            console.error(err);

            socket.emit(
                "error",
                "Something went wrong"
            );

        }

    };

}