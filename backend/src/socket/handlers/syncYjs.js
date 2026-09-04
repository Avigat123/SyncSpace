import * as Y from "yjs";
import { getYDoc } from "../yjsStore.js";
import { saveTimers } from "../store.js";
import { saveYDoc } from "../../services/yjs.service.js";

export default function syncYjs(io, socket) {

    return async function ({ documentId, update }) {

        const ydoc = await getYDoc(documentId);

        Y.applyUpdate(ydoc, new Uint8Array(update));

        socket.to(documentId).emit("yjs-update",update);

        if (saveTimers.has(documentId)) {
            clearTimeout(saveTimers.get(documentId));
        }
        const timer = setTimeout(async () => {

        try {
            await saveYDoc(documentId,ydoc);

        } catch (err) {
            console.error(err);

        } finally {
            saveTimers.delete(documentId);

        }}, 2000);

        saveTimers.set(documentId,timer);
    };
    
}