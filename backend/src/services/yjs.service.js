import * as Y from "yjs";
import Document from "../models/document.model.js";

export async function saveYDoc(documentId, ydoc) {

    const state = Y.encodeStateAsUpdate(ydoc);

    await Document.findByIdAndUpdate(
        documentId,
        {
            yjsState: Buffer.from(state),
            content: ydoc.getText("document").toString(),
        }
    );

}

export async function loadYDoc(documentId) {

    const document = await Document.findById(documentId);

    const ydoc = new Y.Doc();

    if (document.yjsState) {
        Y.applyUpdate(ydoc,new Uint8Array(document.yjsState));
    }
    else {

        ydoc.getText("document").insert(0,document.content);

    }

    return ydoc;

}   