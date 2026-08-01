export default function cursorMove(io, socket) {

    return function ({ documentId, position }) {

        socket.to(documentId).emit(
            "cursor-updated",
            {
                userId: socket.user._id,
                name: socket.user.name,
                position,
            }
        );

    };

}