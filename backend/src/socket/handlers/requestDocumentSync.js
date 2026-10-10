import * as Y from "yjs";
import { getYDoc } from "../yjsStore.js";

export default function requestDocumentSync(io, socket) {
    return async function ({ documentId }) {
        try {
            if (!documentId || socket.documentId !== documentId) {
                return;
            }

            const ydoc = await getYDoc(documentId);
            const state = Y.encodeStateAsUpdate(ydoc);

            socket.emit("sync-document", Array.from(state));
        } catch (error) {
            console.error("[requestDocumentSync] Failed:", error);
            socket.emit("error", "Unable to synchronize document");
        }
    };
}
