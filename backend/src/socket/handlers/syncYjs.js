
import * as Y from "yjs";
import { getYDoc } from "../yjsStore.js";
import { saveTimers, getDocumentGeneration } from "../store.js";
import { saveYDoc } from "../../services/yjs.service.js";

export default function syncYjs(io, socket) {
    return async function ({ documentId, update, generation }) {
        try {
            if (!documentId || !Array.isArray(update)) return;

            // Reject updates from an outdated editor session.
            const currentGeneration = getDocumentGeneration(documentId);

            if (generation !== currentGeneration) {
                console.log("[syncYjs] Rejected stale update:", {
                    documentId,
                    receivedGeneration: generation,
                    currentGeneration,
                });
                return;
            }

            const ydoc = await getYDoc(documentId);

            // Check again in case the document was restored while loading.
            if (generation !== getDocumentGeneration(documentId)) {
                return;
            }

            // Normalize to Uint8Array, then re-encode as plain Array for broadcast
            // so the JSON/polling transport delivers a reconstructable array to clients.

            const binaryUpdate = new Uint8Array(update);
            Y.applyUpdate(ydoc, binaryUpdate);

            socket.to(documentId).emit(
                "yjs-update",
                Array.from(binaryUpdate)
            );

            if (saveTimers.has(documentId)) {
                clearTimeout(saveTimers.get(documentId));
            }

            const timer = setTimeout(async () => {
                try {
                    if (
                        generation !== getDocumentGeneration(documentId)
                    ) {
                        return;
                    }

                    await saveYDoc(documentId, ydoc);
                } catch (err) {
                    console.error("[syncYjs] save error:", err);
                } finally {
                    if (saveTimers.get(documentId) === timer) {
                        saveTimers.delete(documentId);
                    }
                }
            }, 2000);

            saveTimers.set(documentId, timer);
        } catch (err) {
            console.error("[syncYjs] update error:", err);
        }
    };
}
