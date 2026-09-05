import { activeUsers } from "../store.js";

export default function disconnect(io, socket) {

    return function (reason) {

        const documentId = socket.documentId;

        console.log(
            `[disconnect] socket=${socket.id}`,
            `user=${socket.user?.name ?? "unknown"}`,
            `docId=${documentId ?? "none"}`,
            `reason=${reason}`
        );

        if (!documentId) return;

        const users = activeUsers.get(documentId);

        if (!users) return;

        const updatedUsers = users.filter(u => u.socketId !== socket.id);

        if (updatedUsers.length === 0) {
            activeUsers.delete(documentId);
        } else {
            activeUsers.set(documentId, updatedUsers);
        }

        io.to(documentId).emit("users-online", updatedUsers);

    };

}