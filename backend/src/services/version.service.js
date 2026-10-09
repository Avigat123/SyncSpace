
import * as Y from "yjs";
import Version from "../models/version.model.js";
import Document from "../models/document.model.js";

export async function createVersion(documentId, ydoc, editedBy) {
    const document = await Document.findById(documentId);

    if (!document) {
        throw new Error("Document not found");
    }

    const yjsState = Y.encodeStateAsUpdate(ydoc);

    console.log("[createVersion] payload:", {
        document: document._id,
        title: document.title,
        content: document.content || "",
        editedBy,
        hasYjsState: Boolean(yjsState),
    });

    let version;

    try {
        version = await Version.create({
            document: document._id,
            title: document.title,
            content: document.content || "",
            editedBy,
            yjsState: Buffer.from(yjsState),
        });
    } catch (error) {
        console.error("[createVersion] FAILED:", error);
        throw error;
    }

    return version;
}
