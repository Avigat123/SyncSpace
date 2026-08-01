import Document from "../../models/document.model.js";
import { saveTimers } from "../store.js";
import Version from "../../models/version.model.js";

export default function editDocument(io, socket) {

    return async function ({ documentId, content }) {

        socket.to(documentId).emit(
            "document-updated",
            content
        );

        if (saveTimers.has(documentId)) {

            clearTimeout(
                saveTimers.get(documentId)
            );

        }

        const timer = setTimeout(async () => {

            try {

                // Load the current document
                const document = await Document.findById(documentId);

                if (!document) {
                    saveTimers.delete(documentId);
                    return;
                }

                // Don't create a version if nothing changed
                if (document.content !== content) {

                    // Save the previous state
                    await Version.create({
                        document: document._id,
                        title: document.title,
                        content: document.content,
                        editedBy: socket.user._id,
                    });

                    // Update the document
                    document.content = content;

                    await document.save();
                }

                saveTimers.delete(documentId);

            } catch (err) {

                console.error(err);

            }

        }, 2000);

        saveTimers.set(
            documentId,
            timer
        );

    };

}