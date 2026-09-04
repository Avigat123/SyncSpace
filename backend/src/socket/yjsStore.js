import * as Y from "yjs";
import { loadYDoc } from "../services/yjs.service.js";

const docs = new Map();

/**
 * Returns an existing Y.Doc or creates a new one.
 */
export async function getYDoc(documentId) {

    if (!docs.has(documentId)) {

        const ydoc = await loadYDoc(documentId);

        docs.set(documentId, ydoc);

    }

    return docs.get(documentId);

}

export function removeYDoc(documentId) {
    docs.delete(documentId);
}