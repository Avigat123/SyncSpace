import * as Y from "yjs";
import Version from "../models/version.model.js";
import Document from "../models/document.model.js";
import { getYDoc, setYDoc } from "../socket/yjsStore.js";
import { saveTimers, incrementDocumentGeneration } from "../socket/store.js";

export async function restoreVersionState(documentId, versionId) {
    console.log("[restoreVersion] Controller reached");

    console.log("[restore] IDs received:", {
        documentId,
        versionId,
    });

    const [document, version] = await Promise.all([
        Document.findById(documentId),
        Version.findById(versionId),
    ]);

    console.log("[restore] Lookup results:", {
        documentFound: Boolean(document),
        versionFound: Boolean(version),
        database: Document.db.name,
        collection: Document.collection.name,
    });

    if (!document) {
        throw new Error("Document not found");
    }

    if (!version) {
        throw new Error("Version not found");
    }


    if (!version || version.document.toString() !== documentId) {
        throw new Error("Version not found for this document");
    }

    if (!version.yjsState?.length) {
        throw new Error("This version has no Yjs snapshot");
    }

    // Cancel any pending debounced save.
    const timer = saveTimers.get(documentId);

    if (timer) {
        clearTimeout(timer);
        saveTimers.delete(documentId);
    }

    // Build a fresh Y.Doc from the saved snapshot.
    const restoredYDoc = new Y.Doc();
    Y.applyUpdate(restoredYDoc, new Uint8Array(version.yjsState));

    // Replace the cached instance.

    document.title = version.title;
    document.yjsState = Buffer.from(
        Y.encodeStateAsUpdate(restoredYDoc)
    );

    // Persist first. Replace the cache only if saving succeeds.
    await document.save();

    const previousYDoc = setYDoc(documentId, restoredYDoc);

    const generation = incrementDocumentGeneration(documentId);

    return { document, restoredYDoc, previousYDoc, generation };
}
