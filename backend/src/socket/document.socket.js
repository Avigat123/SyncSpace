import joinDocument from "./handlers/joinDocument.js";
import editDocument from "./handlers/editDocument.js";
import disconnect from "./handlers/disconnect.js";

export default function registerDocumentHandlers(io, socket) {

    socket.on(
        "join-document",
        joinDocument(io, socket)
    );

    socket.on(
        "edit-document",
        editDocument(io, socket)
    );

    socket.on(
        "disconnect",
        disconnect(io, socket)
    );

}