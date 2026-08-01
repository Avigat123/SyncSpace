import joinDocument from "./handlers/joinDocument.js";
import editDocument from "./handlers/editDocument.js";
import disconnect from "./handlers/disconnect.js";
import CursorMove from "./handlers/CursorMove.js";
import typing from "./handlers/typing.js";
import restoreVersion from "./handlers/restoreVersion.js";

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
        "cursor-move",
        CursorMove(io, socket)
    );

    socket.on(
        "typing",
        typing(io, socket)
    );

    socket.on(
        "restore-version",
        restoreVersion(io, socket)
    );
    
    socket.on(
        "disconnect",
        disconnect(io, socket)
    );

}