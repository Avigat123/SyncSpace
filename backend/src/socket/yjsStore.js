import { loadYDoc } from "../services/yjs.service.js";

const docs = new Map();
const loadingDocs = new Map();
const cacheEpochs = new Map();

export async function getYDoc(documentId) {
    if (docs.has(documentId)) {
        return docs.get(documentId);
    }

    if (loadingDocs.has(documentId)) {
        return loadingDocs.get(documentId);
    }

    let loadingPromise;

    loadingPromise = (async () => {
        while (true) {
            const epoch = cacheEpochs.get(documentId) ?? 0;

            const ydoc = await loadYDoc(documentId);

            const currentEpoch = cacheEpochs.get(documentId) ?? 0;

            // Cache changed while MongoDB was loading.
            if (currentEpoch !== epoch) {
                ydoc.destroy();

                if (docs.has(documentId)) {
                    return docs.get(documentId);
                }

                continue;
            }

            // Another operation populated the cache.
            if (docs.has(documentId)) {
                ydoc.destroy();
                return docs.get(documentId);
            }

            docs.set(documentId, ydoc);

            return ydoc;
        }
    })().finally(() => {
        if (loadingDocs.get(documentId) === loadingPromise) {
            loadingDocs.delete(documentId);
        }
    });

    loadingDocs.set(documentId, loadingPromise);

    return loadingPromise;
}

export function setYDoc(documentId, ydoc) {
    cacheEpochs.set(documentId, (cacheEpochs.get(documentId) ?? 0) + 1);

    const previousYDoc = docs.get(documentId);

    docs.set(documentId, ydoc);

    return previousYDoc;
}

export function removeYDoc(documentId) {
    cacheEpochs.set(documentId, (cacheEpochs.get(documentId) ?? 0) + 1);

    const ydoc = docs.get(documentId);

    docs.delete(documentId);

    return ydoc;
}