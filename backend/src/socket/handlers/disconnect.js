import { activeUsers } from "../store.js";
import { getAwareness } from "../awarenessStore.js";
import { removeAwarenessStates, encodeAwarenessUpdate } from "y-protocols/awareness";

export default function disconnect(io, socket) {

    return async function (reason) {

        const documentId = socket.documentId;

        console.log(
            `[disconnect] socket=${socket.id}`,
            `user=${socket.user?.name ?? "unknown"}`,
            `docId=${documentId ?? "none"}`,
            `reason=${reason}`
        );

        if (!documentId) return;

        // Propagate awareness removal if this socket had associated clientIDs
        if (socket.awarenessClientIds && socket.awarenessClientIds.size > 0) {
            try {
                const awareness = await getAwareness(documentId);
                const clientIds = Array.from(socket.awarenessClientIds);
                removeAwarenessStates(awareness, clientIds, "disconnect");
                const removalUpdate = encodeAwarenessUpdate(awareness, clientIds);
                io.to(documentId).emit("awareness-update", {
                    documentId,
                    update: Array.from(removalUpdate),
                });
                console.log("[AWARENESS REMOVED ON DISCONNECT]", {
                    documentId,
                    socketId: socket.id,
                    clientIds,
                });
            } catch (err) {
                console.error("[disconnect awareness error]:", err);
            }
        }

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
