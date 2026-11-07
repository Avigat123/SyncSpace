import * as Y from "yjs";
import Version from "../models/version.model.js";
import Document from "../models/document.model.js";

export async function createVersion(documentId, ydoc, editedBy, customTitle) {
    const document = await Document.findById(documentId);

    if (!document) {
        throw new Error("Document not found");
    }

    const yjsState = Y.encodeStateAsUpdate(ydoc);
    const versionTitle = (customTitle && typeof customTitle === "string" && customTitle.trim())
        ? customTitle.trim()
        : document.title;

    let textContent = "";
    try {
        const frag = ydoc.getXmlFragment("default");
        if (frag && frag.length > 0) {
            textContent = frag.toString();
        }
    } catch (error) {
        console.warn("[createVersion] Could not serialize XmlFragment:", error);
    }

    console.log("[createVersion] payload:", {
        document: document._id,
        title: versionTitle,
        content: textContent || document.content || "",
        editedBy,
        hasYjsState: Boolean(yjsState),
    });

    let version;

    try {
        version = await Version.create({
            document: document._id,
            title: versionTitle,
            content: textContent || document.content || "",
            editedBy,
            yjsState: Buffer.from(yjsState),
        });
    } catch (error) {
        console.error("[createVersion] FAILED:", error);
        throw error;
    }

    return version;
}
