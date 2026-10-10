import joinDocument from "./handlers/joinDocument.js";
import editDocument from "./handlers/editDocument.js";
import disconnect from "./handlers/disconnect.js";
import CursorMove from "./handlers/CursorMove.js";
import typing from "./handlers/typing.js";
import syncYjs from "./handlers/syncYjs.js";
import syncAwareness, { syncAwarenessRequest, syncAwarenessResponse } from "./handlers/syncAwareness.js";
import requestDocumentSync from "./handlers/requestDocumentSync.js";
// import restoreVersion from "./handlers/restoreVersion.js";

export default function registerDocumentHandlers(io, socket) {

    socket.on(
        "join-document",
        joinDocument(io, socket)
    );

    socket.on(
        "sync-yjs",
        syncYjs(io, socket)
    );

    socket.on(
        "cursor-move",
        CursorMove(io, socket)
    );

    socket.on(
        "typing",
        typing(io, socket)
    );

    // socket.on(
    //     "restore-version",
    //     restoreVersion(io, socket)
    // );

    socket.on(
        "awareness-update",
        syncAwareness(io, socket)
    );

    socket.on(
        "awareness-sync-request",
        syncAwarenessRequest(io, socket)
    );

    socket.on(
        "awareness-sync-response",
        syncAwarenessResponse(io, socket)
    );

    socket.on(
        "request-document-sync",
        requestDocumentSync(io, socket)
    );

    socket.on(
        "disconnect",
        disconnect(io, socket)
    );

}