import * as Y from "yjs";
import Version from "../models/version.model.js";
import Document from "../models/document.model.js";
import { setYDoc } from "../socket/yjsStore.js";
import { saveTimers, incrementDocumentGeneration, withDocumentWriteLock } from "../socket/store.js";

export async function restoreVersionState(documentId, versionId) {
    console.log("[restoreVersion] Controller reached");

    const [document, version] = await Promise.all([
        Document.findById(documentId),
        Version.findById(versionId),
    ]);

    if (!document) {
        throw new Error("Document not found");
    }

    if (!version || version.document.toString() !== documentId) {
        throw new Error("Version not found for this document");
    }

    if (!version.yjsState?.length) {
        throw new Error("This version has no Yjs snapshot");
    }


    return withDocumentWriteLock(documentId, async () => {
        // Cancel any pending debounced save.
        const timer = saveTimers.get(documentId);

        if (timer) {
            clearTimeout(timer);
            saveTimers.delete(documentId);
        }

        // Invalidate updates from the previous generation immediately.
        const generation = incrementDocumentGeneration(documentId);

        // Rebuild the Y.Doc from the selected snapshot.
        const restoredYDoc = new Y.Doc();

        Y.applyUpdate(
            restoredYDoc,
            new Uint8Array(version.yjsState)
        );

        // Persist the restored snapshot.
        document.title = version.title;
        document.yjsState = Buffer.from(
            Y.encodeStateAsUpdate(restoredYDoc)
        );

        await document.save();

        // Replace cached state only after persistence succeeds.
        const previousYDoc = setYDoc(documentId, restoredYDoc);

        return {
            document,
            restoredYDoc,
            previousYDoc,
            generation,
        };
    });

}
