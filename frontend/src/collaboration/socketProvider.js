import * as Y from "yjs";
import { encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";

export function createSocketProvider({ socket, ydoc, awareness, documentId }) {
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


    // --------------------------------------------------
    // 5. Awareness -- send local awareness changes to server
    // --------------------------------------------------

    const handleAwarenessUpdate = ({
        added,
        updated,
        removed,
    }) => {

        if (destroyed) return;

        // Include removed clients: encodeAwarenessUpdate encodes a
        // null-state (clock++) entry for removed clients so peers know they left.
        const changedClients = [
            ...added,
            ...updated,
            ...removed,
        ];

        if (changedClients.length === 0) return;

        const update = encodeAwarenessUpdate(
            awareness,
            changedClients
        );

        console.log("[AWARENESS SENT]", {
            documentId,
            socketId: socket.id,
            added,
            updated,
            removed,
            clientIds: changedClients,
            states: Array.from(awareness.getStates().entries()),
            updateBytes: update.length,
        });

        socket.emit("awareness-update", {
            documentId,
            update: Array.from(update),
        });
    };

    awareness.on(
        "update",
        handleAwarenessUpdate
    );


    // --------------------------------------------------
    // 6. Receive remote Awareness from server
    // --------------------------------------------------

    const handleRemoteAwarenessUpdate = ({
        update,
    }) => {

        if (destroyed) return;

        const binaryUpdate = new Uint8Array(update);

        console.log("[AWARENESS RECEIVED]", {
            documentId,
            socketId: socket.id,
            updateBytes: binaryUpdate.length,
            statesBefore: Array.from(awareness.getStates().entries()),
        });

        applyAwarenessUpdate(
            awareness,
            binaryUpdate,
            "remote"
        );

        console.log("[AWARENESS APPLIED]", {
            statesAfter: Array.from(awareness.getStates().entries()),
        });
    };

    socket.on(
        "awareness-update",
        handleRemoteAwarenessUpdate
    );

    // 7. Cleanup -- remove all listeners so they do not leak across providers.
    function destroy() {
        if (destroyed) return;
        destroyed = true;

        ydoc.off("update", handleLocalUpdate);
        socket.off("sync-document", handleInitialSync);
        socket.off("yjs-update", handleRemoteUpdate);
        socket.off("connect", joinRoom);
        awareness.off("update", handleAwarenessUpdate);
        socket.off("awareness-update", handleRemoteAwarenessUpdate);
    }

    return { awareness, destroy };

}
