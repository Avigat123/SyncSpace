import * as Y from "yjs";
import Document from "../../models/document.model.js";
import { activeUsers } from "../store.js";
import { getYDoc } from "../yjsStore.js";
import { getAwareness } from "../awarenessStore.js";

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

            const ydoc = getYDoc(documentId);

            const ytext = ydoc.getText("document");

            if (ytext.length === 0) {
                ytext.insert(0, document.content);
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

            const awareness = getAwareness(documentId);

            socket.documentId = documentId;

            const update = Y.encodeStateAsUpdate(ydoc);

            socket.emit("sync-document", update);

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