import leaveDocument from "./leaveDocument.js";

export default function disconnect(io, socket) {
    return async function (reason) {
        const documentId = socket.documentId;

        console.log(
            `[disconnect] socket=${socket.id}`,
            `user=${socket.user?.name ?? "unknown"}`,
            `docId=${documentId ?? "none"}`,
            `reason=${reason}`
        );

        if (documentId) {
            await leaveDocument(io, socket)(documentId);
        }
    };
}
