import { applyAwarenessUpdate } from "y-protocols/awareness";
import { getAwareness } from "../awarenessStore.js";

export default function syncAwareness(io, socket) {
  return async function ({ documentId, clientID, update }) {
    try {
      if (!documentId || !update) return;

      if (clientID) {
        if (!socket.awarenessClientIds) {
          socket.awarenessClientIds = new Set();
        }
        socket.awarenessClientIds.add(clientID);
      }

      const awareness = await getAwareness(documentId);

      const binaryUpdate = new Uint8Array(update);

      applyAwarenessUpdate(
        awareness,
        binaryUpdate,
        socket
      );

      // needed for debugging but fixed now

      // console.log("[AWARENESS BROADCAST]", {
      //   documentId,
      //   socketId: socket.id,
      //   clientID: clientID ?? "unknown",
      //   updateBytes: binaryUpdate.length,
      //   roomSize: io.sockets.adapter.rooms.get(documentId)?.size ?? 0,
      // });

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

export function syncAwarenessRequest(io, socket) {
  return function ({ documentId }) {
    try {
      if (!documentId) return;

      // needed for debugging but fixed now

      // console.log("[AWARENESS SYNC REQUEST forwarded]", {
      //   documentId,
      //   fromSocket: socket.id,
      // });

      socket.to(documentId).emit("awareness-sync-request", {
        documentId,
        targetSocketId: socket.id,
      });
    } catch (error) {
      console.error("[backend syncAwarenessRequest] Error:", error);
    }
  };
}

export function syncAwarenessResponse(io, socket) {
  return function ({ documentId, targetSocketId, update }) {
    try {
      if (!documentId || !targetSocketId || !update) return;

      // console.log("[AWARENESS SYNC RESPONSE delivered]", {

      //   documentId,
      //   fromSocket: socket.id,
      //   targetSocketId,
      //   updateBytes: update.length,
      // });

      io.to(targetSocketId).emit("awareness-update", {
        documentId,
        update,
      });
    } catch (error) {
      console.error("[backend syncAwarenessResponse] Error:", error);
    }
  };
}

