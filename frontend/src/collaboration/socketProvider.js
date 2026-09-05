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
        if (origin === remoteOrigin) return;

        socket.emit("sync-yjs", {
            documentId,
            update: Array.from(update),
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
        Y.applyUpdate(ydoc, new Uint8Array(update), remoteOrigin);
    };

    socket.on("sync-document", handleInitialSync);

    /*
     * --------------------------------------------------
     * 3. Receive updates from other clients
     * --------------------------------------------------
     */

    const handleRemoteUpdate = (update) => {
        if (destroyed) return;
        Y.applyUpdate(ydoc, new Uint8Array(update), remoteOrigin);
    };

    socket.on("yjs-update", handleRemoteUpdate);

    // 4. Join the document room.
    //    Re-join automatically after a reconnect (new socket.id = new room membership).
    function joinRoom() {
        if (destroyed) return;
        socket.emit("join-document", documentId);
    }

    joinRoom();
    socket.on("connect", joinRoom);

    // 5. Cleanup — remove all listeners so they don't leak across providers.
    function destroy() {
        if (destroyed) return;
        destroyed = true;

        ydoc.off("update", handleLocalUpdate);
        socket.off("sync-document", handleInitialSync);
        socket.off("yjs-update", handleRemoteUpdate);
        socket.off("connect", joinRoom);
    }

    return { destroy };
}

