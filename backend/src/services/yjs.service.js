
import * as Y from "yjs";
import Document from "../models/document.model.js";

export async function saveYDoc(documentId, ydoc) {
    const state = Y.encodeStateAsUpdate(ydoc);

    await Document.findByIdAndUpdate(documentId, {
        yjsState: Buffer.from(state),
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
