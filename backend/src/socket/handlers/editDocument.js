import Document from "../../models/document.model.js";
import { saveTimers } from "../store.js";

export default function editDocument(io, socket) {

    return function ({ documentId, content }) {

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

                await Document.findByIdAndUpdate(
                    documentId,
                    {
                        content,
                    }
                );

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