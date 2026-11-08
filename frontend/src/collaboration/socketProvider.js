import * as Y from "yjs";
import {
    encodeAwarenessUpdate,
    applyAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness";

export function createSocketProvider({ socket, ydoc, awareness, documentId }) {
    let destroyed = false;
    let generation = null;
    const remoteOrigin = Symbol("remote");
    const pendingLocalUpdates = [];
    const localBatchQueue = [];
    let microBatchTimer = null;
    const MICRO_BATCH_MS = 25;

    // Helper: flush micro-batched local updates
    const flushMicroBatch = () => {
        if (destroyed) return;
        if (microBatchTimer) {
            clearTimeout(microBatchTimer);
            microBatchTimer = null;
        }

        if (localBatchQueue.length === 0) return;

        // If generation is unavailable or socket is disconnected, preserve in pendingLocalUpdates queue
        if (generation === null || !socket.connected) {
            while (localBatchQueue.length > 0) {
                pendingLocalUpdates.push(localBatchQueue.shift());
            }
            return;
        }

        const batch = localBatchQueue.splice(0, localBatchQueue.length);
        const mergedUpdate = batch.length === 1 ? batch[0] : Y.mergeUpdates(batch);

        console.log("[Diagnostic:Frontend] sync-yjs emitted (micro-batched):", {
            documentId,
            generation,
            updatesMerged: batch.length,
            bytes: mergedUpdate.length,
        });

        socket.emit("sync-yjs", {
            documentId,
            update: Array.from(mergedUpdate),
            generation,
        });
    };

    // Helper: flush queued local updates in original FIFO order once generation is established
    const flushPendingUpdates = (targetGen) => {
        if (destroyed) return;

        if (microBatchTimer) {
            clearTimeout(microBatchTimer);
            microBatchTimer = null;
        }

        const allPending = [...pendingLocalUpdates, ...localBatchQueue];
        pendingLocalUpdates.length = 0;
        localBatchQueue.length = 0;

        if (allPending.length === 0) return;

        console.log(`[Diagnostic:Frontend] Flushing ${allPending.length} queued update(s) with generation ${targetGen}`);

        const mergedUpdate = allPending.length === 1 ? allPending[0] : Y.mergeUpdates(allPending);

        socket.emit("sync-yjs", {
            documentId,
            update: Array.from(mergedUpdate),
            generation: targetGen,
        });
    };

    // --------------------------------------------------
    // 0. Receive document generation from server
    // --------------------------------------------------

    const handleDocumentGeneration = (payload) => {
        if (destroyed) return;
        if (!payload || payload.documentId !== documentId) return;

        generation = payload.generation ?? 0;

        console.log("[Diagnostic:Frontend] Document generation established:", {
            documentId,
            generation,
        });

        // Flush any updates that were queued before generation arrived
        flushPendingUpdates(generation);
    };

    socket.on("document-generation", handleDocumentGeneration);

    /*
     * --------------------------------------------------
     * 1. Send local Yjs updates to the backend
     * --------------------------------------------------
     */

    const handleLocalUpdate = (update, origin) => {
        if (destroyed) return;
        if (origin === remoteOrigin) return;

        console.log("[Diagnostic:Frontend] Yjs local update generated:", {
            documentId,
            origin: typeof origin === "symbol" ? origin.toString() : String(origin),
            bytes: update.length,
            currentGeneration: generation,
        });

        const updateCopy = new Uint8Array(update);

        // If generation is not yet available, queue the update until generation arrives
        if (generation === null) {
            console.log(
                "[Diagnostic:Frontend] Generation unavailable; queueing local update until document-generation arrives (queue size: " +
                (pendingLocalUpdates.length + 1) +
                ")"
            );
            pendingLocalUpdates.push(updateCopy);
            return;
        }

        // Micro-batch rapid typing updates (25ms window) to reduce network/DB transactions
        localBatchQueue.push(updateCopy);

        if (!microBatchTimer) {
            microBatchTimer = setTimeout(flushMicroBatch, MICRO_BATCH_MS);
        }
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

    const handleDocumentRestored = (payload) => {
        if (destroyed) return;
        if (payload.documentId !== documentId) return;

        // DocumentPage will remount the editor.
        // The new provider will request state through join-document.
    };

    socket.on("document-restored", handleDocumentRestored);

    /*
     * --------------------------------------------------
     * 3. Receive updates from other clients
     * --------------------------------------------------
     */

    const handleRemoteUpdate = (payload) => {
        if (destroyed) return;

        let updateBytes;

        // Structured payload with documentId & generation verification
        if (payload && typeof payload === "object" && !Array.isArray(payload) && payload.update) {
            // Reject updates belonging to a different document
            if (payload.documentId && payload.documentId !== documentId) {
                console.warn("[Yjs] Rejected cross-document update:", {
                    activeDocument: documentId,
                    incomingDocument: payload.documentId,
                });
                return;
            }

            // Reject updates belonging to an outdated generation
            if (generation !== null && payload.generation !== undefined && payload.generation !== generation) {
                console.warn("[Yjs] Rejected stale generation update:", {
                    activeGeneration: generation,
                    incomingGeneration: payload.generation,
                });
                return;
            }

            updateBytes = payload.update;
        } else {
            // Raw binary array fallback
            updateBytes = payload;
        }

        if (updateBytes && (Array.isArray(updateBytes) || updateBytes instanceof Uint8Array)) {
            console.log("[Diagnostic:Frontend] yjs-update received and applying to Y.Doc:", {
                documentId,
                bytes: updateBytes.length,
            });
            Y.applyUpdate(ydoc, new Uint8Array(updateBytes), remoteOrigin);
        }
    };

    socket.on("yjs-update", handleRemoteUpdate);

    const handleSocketError = (err) => {
        if (destroyed) return;
        console.error("[Diagnostic:Frontend] Socket error from server:", err);
    };

    socket.on("error", handleSocketError);

    // --------------------------------------------------
    // 4. Join the document room & request initial awareness
    // --------------------------------------------------
    function joinRoom() {
        if (destroyed) return;

        socket.emit("join-document", documentId);

        // Request current awareness state from any existing clients in the room

        //needed for debugging but fixed now 

        // console.log("[AWARENESS SYNC REQUEST]", {
        //     documentId,
        //     socketId: socket.id,
        //     clientId: awareness.clientID,
        // });
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

        //needed for debugging but fixed now

        // console.log("[AWARENESS SYNC RESPONSE]", {
        //     documentId,
        //     targetSocketId,
        //     clientId: awareness.clientID,
        //     state: localState,
        //     updateBytes: update.length,
        // });

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

    const handleRemoteAwarenessUpdate = ({ update }) => {

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

        if (microBatchTimer) {
            clearTimeout(microBatchTimer);
            microBatchTimer = null;
        }

        // Synchronously flush any pending batched updates before leaving
        if (generation !== null && localBatchQueue.length > 0) {
            try {
                const batch = localBatchQueue.splice(0, localBatchQueue.length);
                const mergedUpdate = batch.length === 1 ? batch[0] : Y.mergeUpdates(batch);
                socket.emit("sync-yjs", {
                    documentId,
                    update: Array.from(mergedUpdate),
                    generation,
                });
            } catch (e) {
                console.error("[socketProvider] Error flushing batched updates on destroy:", e);
            }
        }

        localBatchQueue.length = 0;
        pendingLocalUpdates.length = 0; // Clear queued local updates

        // Explicitly leave the Socket.IO document room on the server
        try {
            socket.emit("leave-document", { documentId });
        } catch (e) {
            console.error("[socketProvider] Error emitting leave-document:", e);
        }

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
        socket.off("document-restored", handleDocumentRestored);
        socket.off("document-generation", handleDocumentGeneration);
        socket.off("error", handleSocketError);
    }

    return { awareness, destroy };
}

