import * as Y from "yjs";
import { getYDoc } from "../yjsStore.js";
import { saveTimers } from "../store.js";
import { saveYDoc } from "../../services/yjs.service.js";

export default function syncYjs(io, socket) {

    return async function ({ documentId, update }) {

        const ydoc = await getYDoc(documentId);

        // Normalize to Uint8Array, then re-encode as plain Array for broadcast
        // so the JSON/polling transport delivers a reconstructable array to clients.
        const binaryUpdate = new Uint8Array(update);
        Y.applyUpdate(ydoc, binaryUpdate);

        socket.to(documentId).emit("yjs-update", Array.from(binaryUpdate));

        if (saveTimers.has(documentId)) {
            clearTimeout(saveTimers.get(documentId));
        }

        const timer = setTimeout(async () => {
            try {
                await saveYDoc(documentId, ydoc);
            } catch (err) {
                console.error("[syncYjs] save error:", err);
            } finally {
                saveTimers.delete(documentId);
            }
        }, 2000);

        saveTimers.set(documentId, timer);
    };

}