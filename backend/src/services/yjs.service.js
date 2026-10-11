
import * as Y from "yjs";
import Document from "../models/document.model.js";
import { withDocumentWriteLock } from "../socket/store.js";
import { getDocumentGeneration } from "../socket/store.js";

export async function saveYDoc(documentId, ydoc, generation) {
    return withDocumentWriteLock(documentId, async () => {
        // Check generation when this operation reaches the queue.
        if (generation !== getDocumentGeneration(documentId)) {
            console.log("[saveYDoc] Skipped stale save:", documentId);
            return;
        }

        const state = Y.encodeStateAsUpdate(ydoc);

        await Document.findByIdAndUpdate(documentId, {
            yjsState: Buffer.from(state),
        });
    });
}

export async function loadYDoc(documentId) {
    const document = await Document.findById(documentId);

    if (!document) {
        throw new Error("Document not found");
    }

    const ydoc = new Y.Doc();

    if (document.yjsState?.length) {
        Y.applyUpdate(ydoc, new Uint8Array(document.yjsState));
    }

    return ydoc;
}
