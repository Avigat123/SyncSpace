export default function typing(io, socket) {

    return function ({ documentId, isTyping }) {

        socket.to(documentId).emit(
            "user-typing",
            {
                userId: socket.user._id,
                name: socket.user.name,
                isTyping,
            }
        );

    };

}