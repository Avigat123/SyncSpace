import { activeUsers } from "../store.js";

export default function disconnect(io, socket) {

    return function () {

        const documentId = socket.documentId;

        if (!documentId) return;

        const users =
            activeUsers.get(documentId);

        if (!users) return;

        const updatedUsers = users.filter(
            user =>
                user.socketId !== socket.id
        );

        if (updatedUsers.length === 0) {

            activeUsers.delete(documentId);

        } else {

            activeUsers.set(
                documentId,
                updatedUsers
            );

        }

        io.to(documentId).emit(
            "users-online",
            updatedUsers
        );

        console.log(
            `${socket.user?.name} disconnected`
        );

    };

}