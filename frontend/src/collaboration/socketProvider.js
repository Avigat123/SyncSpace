import * as Y from "yjs";

export function createSocketProvider({
    socket,
    ydoc,
    documentId,
}) {
    let destroyed = false;

    const remoteOrigin = Symbol("remote");

    /*
     * --------------------------------------------------
     * 1. Send local Yjs updates to the backend
     * --------------------------------------------------
     */

    const handleLocalUpdate = (update, origin) => {
        if (destroyed) return;

        // Don't send updates that came from the server.
        if (origin === remoteOrigin) {
            return;
        }

        socket.emit("sync-yjs", {
            documentId,
            update,
        });
    };

    ydoc.on("update", handleLocalUpdate);

    /*
     * --------------------------------------------------
     * 2. Receive initial document state
     * --------------------------------------------------
     */

    const handleInitialSync = (update) => {
        if (destroyed) return;

        const binaryUpdate = new Uint8Array(update);

        Y.applyUpdate(
            ydoc,
            binaryUpdate,
            remoteOrigin
        );
    };

    socket.on(
        "sync-document",
        handleInitialSync
    );

    /*
     * --------------------------------------------------
     * 3. Receive updates from other clients
     * --------------------------------------------------
     */

    const handleRemoteUpdate = (update) => {
        if (destroyed) return;

        const binaryUpdate = new Uint8Array(update);

        Y.applyUpdate(
            ydoc,
            binaryUpdate,
            remoteOrigin
        );
    };

    socket.on(
        "yjs-update",
        handleRemoteUpdate
    );

    /*
     * --------------------------------------------------
     * 4. Join the document
     * --------------------------------------------------
     */

    socket.emit(
        "join-document",
        documentId
    );

    /*
     * --------------------------------------------------
     * 5. Cleanup
     * --------------------------------------------------
     */

    function destroy() {
        if (destroyed) return;

        destroyed = true;

        ydoc.off(
            "update",
            handleLocalUpdate
        );

        socket.off(
            "sync-document",
            handleInitialSync
        );

        socket.off(
            "yjs-update",
            handleRemoteUpdate
        );
    }

    return {
        destroy,
    };
}