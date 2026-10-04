import { applyAwarenessUpdate } from "y-protocols/awareness";
import { getAwareness } from "../awarenessStore.js";

export default function syncAwareness(io, socket) {
  return async function ({ documentId, update }) {
    try {
      if (!documentId || !update) return;

      const awareness = await getAwareness(documentId);

      const binaryUpdate = new Uint8Array(update);

      applyAwarenessUpdate(
        awareness,
        binaryUpdate,
        socket
      );

      console.log("[AWARENESS BROADCAST]", {
        documentId,
        socketId: socket.id,
        updateBytes: binaryUpdate.length,
        roomSize: io.sockets.adapter.rooms.get(documentId)?.size ?? 0,
      });

      socket.to(documentId).emit("awareness-update", {
        documentId,
        update: Array.from(binaryUpdate),
      });

    } catch (error) {
      console.error(
        "[backend syncAwareness] Error:",
        error
      );
    }
  };
}