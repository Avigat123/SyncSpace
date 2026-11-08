import { activeUsers, withSocketRoomLock } from "../store.js";
import { getAwareness, hasAwareness } from "../awarenessStore.js";
import { removeAwarenessStates, encodeAwarenessUpdate } from "y-protocols/awareness";

/**
 * Handles a socket leaving a document room cleanly.
 * Safe to call on explicit 'leave-document' event, before switching documents,
 * and during socket disconnect.
 */
export default function leaveDocument(io, socket) {
    return async function (payload) {
        return withSocketRoomLock(socket, async () => {
            const targetDocId =
                typeof payload === "string"
                    ? payload
                    : payload?.documentId || socket.documentId;

            if (!targetDocId) return;

            console.log(
                `[leaveDocument] socket=${socket.id} user=${socket.user?.name ?? "unknown"} leaving docId=${targetDocId}`
            );

            try {
                // 1. Leave the Socket.IO room
                await socket.leave(targetDocId);

                // 2. Clear documentId and documentRole on socket if it matches targetDocId
                if (socket.documentId === targetDocId) {
                    socket.documentId = null;
                    socket.documentRole = null;
                }

                // 3. Remove awareness state for this socket in this document if recorded
                if (
                    socket.awarenessClientIds &&
                    socket.awarenessClientIds.size > 0 &&
                    hasAwareness(targetDocId)
                ) {
                    try {
                        const awareness = await getAwareness(targetDocId);
                        const clientIds = Array.from(socket.awarenessClientIds);
                        removeAwarenessStates(awareness, clientIds, "leave-document");
                        const removalUpdate = encodeAwarenessUpdate(awareness, clientIds);

                        io.to(targetDocId).emit("awareness-update", {
                            documentId: targetDocId,
                            update: Array.from(removalUpdate),
                        });

                        socket.awarenessClientIds.clear();

                        console.log("[leaveDocument] Awareness removed:", {
                            documentId: targetDocId,
                            socketId: socket.id,
                            clientIds,
                        });
                    } catch (awarenessErr) {
                        console.error("[leaveDocument] Awareness removal error:", awarenessErr);
                    }
                }

                // 4. Update activeUsers in store (socket-level tracking preserves other tabs of same user)
                const users = activeUsers.get(targetDocId);
                if (users) {
                    const updatedUsers = users.filter((u) => u.socketId !== socket.id);

                    if (updatedUsers.length === 0) {
                        activeUsers.delete(targetDocId);
                    } else {
                        activeUsers.set(targetDocId, updatedUsers);
                    }

                    io.to(targetDocId).emit("users-online", updatedUsers);
                }
            } catch (err) {
                console.error("[leaveDocument] Error:", err);
            }
        });
    };
}

