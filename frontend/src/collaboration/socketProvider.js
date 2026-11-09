import * as Y from "yjs";
import {
    encodeAwarenessUpdate,
    applyAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness";
import { latencyTelemetry } from "./latencyTelemetry.js";
import {
    savePendingUpdate,
    removePendingUpdate,
    getPendingUpdatesForDocument,
    clearPendingUpdatesForDocument,
} from "./indexedDbStorage.js";

export function createSocketProvider({ socket, ydoc, awareness, documentId }) {
    let destroyed = false;
    let generation = null;
    const remoteOrigin = Symbol("remote");
    const pendingLocalUpdates = [];
    const localBatchQueue = [];
    const unacknowledgedUpdates = new Map(); // updateId -> Uint8Array
    let microBatchTimer = null;
    const MICRO_BATCH_MS = 25;
    let currentBatchUpdateId = null;
    let batchStartTime = 0;
    let hasReceivedInitialSync = false;
    let hasReceivedGeneration = false;
    let isRecovering = false;

    // Helper: flush micro-batched local updates (strictly awaits IndexedDB commit before emit)
    const flushMicroBatch = async () => {
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

        const batchDurationMs = batchStartTime > 0 ? performance.now() - batchStartTime : 0;
        const updateId = currentBatchUpdateId || `upd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        currentBatchUpdateId = null;
        batchStartTime = 0;

        const batch = localBatchQueue.splice(0, localBatchQueue.length);
        const mergedUpdate = batch.length === 1 ? batch[0] : Y.mergeUpdates(batch);

        // 1. Commit to durable IndexedDB storage BEFORE socket emission and await transaction completion
        const t_idb_start = performance.now();
        const persisted = await savePendingUpdate({
            documentId,
            updateId,
            generation,
            update: mergedUpdate,
        });
        const idbDurationMs = Number((performance.now() - t_idb_start).toFixed(2));

        if (!persisted) {
            console.warn("[socketProvider] Failed to commit update to durable IndexedDB; queuing in volatile memory only");
        }

        if (destroyed) return;

        // Retain in unacknowledged buffer until server confirms persistence via yjs-ack
        unacknowledgedUpdates.set(updateId, mergedUpdate);

        latencyTelemetry.recordBatchFlush(updateId, batchDurationMs, mergedUpdate.length, batch.length);

        // 2. Emit ONLY after IndexedDB transaction has finished
        socket.emit("sync-yjs", {
            documentId,
            update: mergedUpdate,
            generation,
            updateId,
            clientTimings: {
                batchDurationMs: Number(batchDurationMs.toFixed(2)),
                idbDurationMs,
            },
        });
    };

    // Helper: flush queued local updates in original FIFO order once generation is established
    const flushPendingUpdates = async (targetGen) => {
        if (destroyed) return;

        if (microBatchTimer) {
            clearTimeout(microBatchTimer);
            microBatchTimer = null;
        }

        // Recover any unacknowledged in-flight updates that were emitted before disconnect
        if (unacknowledgedUpdates.size > 0) {
            for (const [updId, updateBytes] of unacknowledgedUpdates.entries()) {
                pendingLocalUpdates.push({ update: updateBytes, updateId: updId });
            }
            unacknowledgedUpdates.clear();
        }

        const allPending = [...pendingLocalUpdates, ...localBatchQueue];
        pendingLocalUpdates.length = 0;
        localBatchQueue.length = 0;

        if (allPending.length === 0) return;

        const rawUpdates = [];
        const oldIdsToClean = [];

        for (const item of allPending) {
            if (item && item.update && item.updateId) {
                rawUpdates.push(item.update);
                oldIdsToClean.push(item.updateId);
            } else if (item instanceof Uint8Array || Array.isArray(item)) {
                rawUpdates.push(item instanceof Uint8Array ? item : new Uint8Array(item));
            }
        }

        if (rawUpdates.length === 0) return;

        const mergedUpdate = rawUpdates.length === 1 ? rawUpdates[0] : Y.mergeUpdates(rawUpdates);
        const batchUpdateId = `upd_flush_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // Clean up individual old IDs from IndexedDB
        for (const oldId of oldIdsToClean) {
            removePendingUpdate(documentId, oldId).catch(() => {});
        }

        // Retain merged update in unacknowledged buffer and commit to durable IndexedDB before emit
        const t_idb_start = performance.now();
        const persisted = await savePendingUpdate({
            documentId,
            updateId: batchUpdateId,
            generation: targetGen,
            update: mergedUpdate,
        });
        const idbDurationMs = Number((performance.now() - t_idb_start).toFixed(2));

        if (!persisted) {
            console.warn("[socketProvider] Failed to commit flushed update to durable IndexedDB");
        }

        if (destroyed) return;

        unacknowledgedUpdates.set(batchUpdateId, mergedUpdate);

        socket.emit("sync-yjs", {
            documentId,
            update: mergedUpdate,
            generation: targetGen,
            updateId: batchUpdateId,
            clientTimings: {
                idbDurationMs,
            },
        });
    };

    // Helper: coordinate initial document sync and durable recovery without race conditions
    const coordinateInitialSyncAndRecovery = async () => {
        if (destroyed || isRecovering || !hasReceivedGeneration || !hasReceivedInitialSync) return;
        isRecovering = true;

        try {
            const recovered = await getPendingUpdatesForDocument(documentId, generation);
            if (recovered.length > 0 && !destroyed) {
                console.log(`[Diagnostic:Frontend] Recovered ${recovered.length} pending update(s) from IndexedDB for doc ${documentId}`);
                for (const item of recovered) {
                    if (!unacknowledgedUpdates.has(item.updateId)) {
                        // Apply locally to ydoc now that ydoc has its base state from sync-document
                        try {
                            Y.applyUpdate(ydoc, item.update, remoteOrigin);
                        } catch (err) {
                            console.warn("[Diagnostic:Frontend] Error applying recovered update to Y.Doc:", err);
                        }
                        pendingLocalUpdates.push({
                            update: item.update,
                            updateId: item.updateId,
                        });
                    }
                }
            }
        } catch (err) {
            console.warn("[Diagnostic:Frontend] Error recovering pending updates from IndexedDB:", err);
        }

        if (!destroyed) {
            await flushPendingUpdates(generation);
        }
    };

    // --------------------------------------------------
    // 0. Receive document generation from server
    // --------------------------------------------------

    const handleDocumentGeneration = (payload) => {
        if (destroyed || !payload || payload.documentId !== documentId) return;

        generation = payload.generation ?? 0;
        hasReceivedGeneration = true;

        console.log("[Diagnostic:Frontend] Document generation established:", {
            documentId,
            generation,
        });

        // Trigger coordinated recovery once both generation and initial sync have arrived
        coordinateInitialSyncAndRecovery();
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

        const updateCopy = new Uint8Array(update);

        // If generation is not yet available, queue and persist update until generation arrives
        if (generation === null) {
            const preGenUpdateId = `upd_pre_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            pendingLocalUpdates.push({
                update: updateCopy,
                updateId: preGenUpdateId,
            });
            unacknowledgedUpdates.set(preGenUpdateId, updateCopy);
            savePendingUpdate({
                documentId,
                updateId: preGenUpdateId,
                generation: null,
                update: updateCopy,
            }).catch((err) => console.warn("[socketProvider] Failed to persist pre-generation update:", err));
            return;
        }

        // Micro-batch rapid typing updates (25ms window) to reduce network/DB transactions
        if (localBatchQueue.length === 0) {
            currentBatchUpdateId = `upd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            batchStartTime = performance.now();
            latencyTelemetry.recordBatchStart(currentBatchUpdateId);
        }

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
        if (destroyed || !update) return;
        const binary = update instanceof Uint8Array
            ? update
            : update instanceof ArrayBuffer
            ? new Uint8Array(update)
            : new Uint8Array(update);
        Y.applyUpdate(ydoc, binary, remoteOrigin);
        hasReceivedInitialSync = true;

        // Trigger coordinated recovery once both generation and initial sync have arrived
        coordinateInitialSyncAndRecovery();
    };

    socket.on("sync-document", handleInitialSync);

    const handleDocumentRestored = (payload) => {
        if (destroyed) return;
        if (payload.documentId !== documentId) return;

        // Discard all pending local and queued updates
        pendingLocalUpdates.length = 0;
        localBatchQueue.length = 0;
        unacknowledgedUpdates.clear();
        hasReceivedInitialSync = false;
        hasReceivedGeneration = false;
        isRecovering = false;

        // Purge pre-restore pending updates from IndexedDB for this document
        clearPendingUpdatesForDocument(documentId).catch((err) => {
            console.warn("[socketProvider] Failed to clear IndexedDB on document restore:", err);
        });

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

        if (updateBytes && (Array.isArray(updateBytes) || updateBytes instanceof Uint8Array || updateBytes instanceof ArrayBuffer)) {
            const binary = updateBytes instanceof Uint8Array
                ? updateBytes
                : updateBytes instanceof ArrayBuffer
                ? new Uint8Array(updateBytes)
                : new Uint8Array(updateBytes);

            const t_apply_start = performance.now();
            Y.applyUpdate(ydoc, binary, remoteOrigin);
            const t_apply_end = performance.now();
            const remoteApplicationMs = Number((t_apply_end - t_apply_start).toFixed(2));
            latencyTelemetry.recordRemoteApply(remoteApplicationMs);

            // Acknowledge remote delivery & application back to sender
            if (payload && payload.updateId) {
                socket.emit("yjs-delivery-ack", {
                    documentId,
                    updateId: payload.updateId,
                    remoteApplicationMs,
                });
            }
        }
    };

    socket.on("yjs-update", handleRemoteUpdate);

    // Latency diagnostic server acknowledgement listener
    const handleServerAck = (payload) => {
        if (destroyed || !payload || payload.documentId !== documentId) return;
        if (payload.updateId) {
            unacknowledgedUpdates.delete(payload.updateId);
            removePendingUpdate(documentId, payload.updateId).catch((err) => {
                console.warn("[socketProvider] Failed to remove acknowledged update from IndexedDB:", err);
            });
            if (payload.serverTimings) {
                latencyTelemetry.recordServerAck(payload.updateId, payload.serverTimings);
            }
        }
    };

    socket.on("yjs-ack", handleServerAck);

    // Latency diagnostic remote delivery acknowledgement listener
    const handleDeliveryAck = (payload) => {
        if (destroyed || !payload || payload.documentId !== documentId) return;
        if (payload.updateId && payload.remoteApplicationMs !== undefined) {
            latencyTelemetry.recordDeliveryAck(payload.updateId, payload.remoteApplicationMs);
        }
    };

    socket.on("yjs-delivery-ack", handleDeliveryAck);

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

        hasReceivedInitialSync = false;
        hasReceivedGeneration = false;
        isRecovering = false;

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
                const exitUpdateId = currentBatchUpdateId || `upd_exit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                savePendingUpdate({
                    documentId,
                    updateId: exitUpdateId,
                    generation,
                    update: mergedUpdate,
                }).catch(() => {});
                socket.emit("sync-yjs", {
                    documentId,
                    update: mergedUpdate,
                    generation,
                    updateId: exitUpdateId,
                });
            } catch (e) {
                console.error("[socketProvider] Error flushing batched updates on destroy:", e);
            }
        }

        localBatchQueue.length = 0;
        pendingLocalUpdates.length = 0; // Clear queued local updates
        unacknowledgedUpdates.clear();

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
        socket.off("yjs-ack", handleServerAck);
        socket.off("yjs-delivery-ack", handleDeliveryAck);
        socket.off("error", handleSocketError);
    }

    return { awareness, destroy };
}

