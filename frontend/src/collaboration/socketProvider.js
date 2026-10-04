import * as Y from "yjs";
import {
    encodeAwarenessUpdate,
    applyAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness";

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

    // --------------------------------------------------
    // 4. Join the document room & request initial awareness
    // --------------------------------------------------
    function joinRoom() {
        if (destroyed) return;

        socket.emit("join-document", documentId);

        // Request current awareness state from any existing clients in the room
        console.log("[AWARENESS SYNC REQUEST]", {
            documentId,
            socketId: socket.id,
            clientId: awareness.clientID,
        });
        socket.emit("awareness-sync-request", { documentId });

        // Send our current presence after joining the room if available
        setTimeout(() => {
            sendInitialAwareness();
        }, 50);
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
            clientID: awareness.clientID,
            update: Array.from(update),
        });
    };

    awareness.on(
        "update",
        handleAwarenessUpdate
    );

    const sendInitialAwareness = () => {
        if (destroyed) return;

        const localState = awareness.getLocalState();
        if (!localState || Object.keys(localState).length === 0) return;

        const localClientId = awareness.clientID;

        const update = encodeAwarenessUpdate(
            awareness,
            [localClientId]
        );

        socket.emit("awareness-update", {
            documentId,
            clientID: localClientId,
            update: Array.from(update),
        });

        console.log(
            "🟢 [AWARENESS INITIAL SENT]",
            localState
        );
    };

    // --------------------------------------------------
    // 6. Handle awareness sync request from newly joined clients
    // --------------------------------------------------
    const handleAwarenessSyncRequest = ({ targetSocketId }) => {
        if (destroyed) return;

        const localState = awareness.getLocalState();
        if (!localState || Object.keys(localState).length === 0) return;

        const update = encodeAwarenessUpdate(
            awareness,
            [awareness.clientID]
        );

        console.log("[AWARENESS SYNC RESPONSE]", {
            documentId,
            targetSocketId,
            clientId: awareness.clientID,
            state: localState,
            updateBytes: update.length,
        });

        socket.emit("awareness-sync-response", {
            documentId,
            targetSocketId,
            update: Array.from(update),
        });
    };

    socket.on("awareness-sync-request", handleAwarenessSyncRequest);

    // --------------------------------------------------
    // 7. Receive remote Awareness from server
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

    // 8. Cleanup -- remove all listeners so they do not leak across providers.
    function destroy() {
        if (destroyed) return;
        destroyed = true;

        // Cleanly remove our local awareness state so peers remove our cursor immediately
        try {
            removeAwarenessStates(awareness, [awareness.clientID], "local");
        } catch {
            // Ignore if awareness was already destroyed
        }

        ydoc.off("update", handleLocalUpdate);
        socket.off("sync-document", handleInitialSync);
        socket.off("yjs-update", handleRemoteUpdate);
        socket.off("connect", joinRoom);
        awareness.off("update", handleAwarenessUpdate);
        socket.off("awareness-update", handleRemoteAwarenessUpdate);
        socket.off("awareness-sync-request", handleAwarenessSyncRequest);
    }

    return { awareness, destroy };
}

