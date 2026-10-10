
import { loadYDoc } from "../services/yjs.service.js";

const docs = new Map(); // This JavaScript Map is my cache.

//getYDoc() function implements a cache-aside pattern: check the cache first, and load from persistent storage only on a cache miss.

export async function getYDoc(documentId) {  
    if (!docs.has(documentId)) {
        const ydoc = await loadYDoc(documentId);
        docs.set(documentId, ydoc);
    }

    return docs.get(documentId);
}

export function setYDoc(documentId, ydoc) {
    const previousYDoc = docs.get(documentId);

    docs.set(documentId, ydoc);

    return previousYDoc;
}

export function removeYDoc(documentId) {
    const ydoc = docs.get(documentId);

    docs.delete(documentId);

    return ydoc;
}
