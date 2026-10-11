
import * as Y from "yjs";
import { getYDoc } from "../yjsStore.js";
import {
    saveTimers,
    getDocumentGeneration,
    withDocumentWriteLock,
} from "../store.js";
import { saveYDoc } from "../../services/yjs.service.js";

export default function syncYjs(io, socket) {
    return async function ({ documentId, update, generation }) {
        try {
            if (!documentId || !Array.isArray(update)) return;

            await withDocumentWriteLock(documentId, async () => {
                // Reject updates from outdated editor sessions.
                const currentGeneration =
                    getDocumentGeneration(documentId);

                if (generation !== currentGeneration) {
                    console.log("[syncYjs] Rejected stale update:", { documentId,receivedGeneration: generation, currentGeneration });
                    return;
                }
                // Only accept updates from a socket that joined this document.
                if (socket.documentId !== documentId) {
                    console.warn("[syncYjs] Rejected update from socket outside document room:", documentId);
                    return;
                }

                const ydoc = await getYDoc(documentId);

                // Recheck after loading the document.
                if (generation !== getDocumentGeneration(documentId)) {
                    return;
                }

                const binaryUpdate = new Uint8Array(update);

                Y.applyUpdate(ydoc, binaryUpdate);

                socket.to(documentId).emit("yjs-update", Array.from(binaryUpdate));

                // Debounce persistence.
                if (saveTimers.has(documentId)) {
                    clearTimeout(saveTimers.get(documentId));
                }

                const timer = setTimeout(async () => {
                    try {
                        if (generation !== getDocumentGeneration(documentId)) {
                            return;
                        }
                        await saveYDoc(documentId, ydoc, generation);
                    } catch (err) {
                        console.error("[syncYjs] save error:", err);
                    } finally {
                        if (saveTimers.get(documentId) === timer) {
                            saveTimers.delete(documentId);
                        }
                    }
                }, 2000);
                saveTimers.set(documentId, timer);
            });
        } catch (err) {
            console.error("[syncYjs] update error:", err);
        }
    };
}
