import * as Y from "yjs";
import { withDocumentWriteLock } from "./store.js";
import { persistYjsUpdate } from "../services/yjsUpdate.service.js";
import { getYDoc } from "./yjsStore.js";
import { publishYjsUpdate } from "./yjsRedis.js";
import { compactYjsDocument } from "../services/yjsCompaction.service.js";
import { backendLatencyTracker } from "./latencyTracker.js";

const BATCH_WINDOW_MS = 25; // Configurable batching window (20–30ms)
const MAX_BATCH_SIZE = 50;

const accumulators = new Map(); // documentId -> DocumentAccumulator
const compactionInProgress = new Set();

class DocumentAccumulator {
    constructor(documentId, generation, io) {
        this.documentId = documentId;
        this.generation = generation;
        this.io = io;
        this.queue = [];
        this.timer = null;
        this.isProcessing = false;
        this.processingPromise = null;
    }

    enqueue(item) {
        this.queue.push(item);

        if (!this.isProcessing) {
            if (this.queue.length >= MAX_BATCH_SIZE) {
                this.flush();
            } else if (!this.timer) {
                this.timer = setTimeout(() => this.flush(), BATCH_WINDOW_MS);
            }
        }
    }

    async flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.isProcessing || this.queue.length === 0) {
            return this.processingPromise;
        }

        this.isProcessing = true;
        const batch = this.queue.splice(0, this.queue.length);
        const generation = this.generation;
        const documentId = this.documentId;
        const io = this.io;

        this.processingPromise = (async () => {
            let shouldCompact = false;

            try {
                // Serialize persistence using withDocumentWriteLock
                await withDocumentWriteLock(documentId, async () => {
                    const t_lock_acquired = process.hrtime.bigint();

                    // 1. Merge updates
                    const updates = batch.map((b) => b.binaryUpdate);
                    const mergedUpdate = updates.length === 1
                        ? updates[0]
                        : Buffer.from(Y.mergeUpdates(updates));

                    // 2. Persist merged update transactionally (with transient retry)
                    const t_mongo_start = process.hrtime.bigint();
                    let sequence = null;
                    let retries = 2;

                    while (retries >= 0) {
                        try {
                            sequence = await persistYjsUpdate(documentId, mergedUpdate, generation);
                            break;
                        } catch (persistErr) {
                            retries--;
                            if (retries < 0) {
                                console.error("[yjsAccumulator] Fatal MongoDB persistence failure for batch:", {
                                    documentId,
                                    generation,
                                    batchSize: batch.length,
                                    error: persistErr.message || persistErr,
                                });
                                for (const item of batch) {
                                    if (item.socket && item.socket.connected) {
                                        item.socket.emit("error", "Failed to persist document update");
                                    }
                                    item.reject(persistErr);
                                }
                                return;
                            }
                            console.warn(`[yjsAccumulator] Retrying persistence for ${documentId} (${retries} attempts left)...`);
                            await new Promise((r) => setTimeout(r, 20));
                        }
                    }

                    const t_mongo_done = process.hrtime.bigint();
                    const mongoTxMs = Number(t_mongo_done - t_mongo_start) / 1e6;

                    if (sequence === null) {
                        console.warn("[yjsAccumulator] Batch dropped: stale sequence or generation conflict:", {
                            documentId,
                            generation,
                        });
                        for (const item of batch) {
                            item.reject(new Error("Stale sequence or generation conflict"));
                        }
                        return;
                    }

                    // 3. Apply to local backend Y.Doc
                    const t_ydoc_start = process.hrtime.bigint();
                    const ydoc = await getYDoc(documentId);
                    Y.applyUpdate(ydoc, mergedUpdate);
                    const t_ydoc_done = process.hrtime.bigint();
                    const ydocApplyMs = Number(t_ydoc_done - t_ydoc_start) / 1e6;

                    // 4. Publish to other backend instances via Redis
                    const t_redis_start = process.hrtime.bigint();
                    await publishYjsUpdate(documentId, mergedUpdate, generation);
                    const t_redis_done = process.hrtime.bigint();
                    const redisPublishMs = Number(t_redis_done - t_redis_start) / 1e6;

                    // 5. Broadcast to connected clients only after successful persistence
                    const t_bcast_start = process.hrtime.bigint();
                    const contributingSockets = new Set(batch.map((b) => b.socket).filter(Boolean));

                    const serverTimings = {
                        lockWaitMs: 0,
                        validationMs: 0,
                        mongoTxMs: Number(mongoTxMs.toFixed(2)),
                        ydocApplyMs: Number(ydocApplyMs.toFixed(2)),
                        redisPublishMs: Number(redisPublishMs.toFixed(2)),
                        batchSize: batch.length,
                    };

                    // Broadcast merged update to room
                    if (contributingSockets.size === 1) {
                        const singleSocket = batch[0].socket;
                        if (singleSocket && singleSocket.connected) {
                            singleSocket.to(documentId).emit("yjs-update", {
                                documentId,
                                generation,
                                update: mergedUpdate,
                                updateId: batch[0].updateId,
                                serverTimings,
                            });
                        } else {
                            io.to(documentId).emit("yjs-update", {
                                documentId,
                                generation,
                                update: mergedUpdate,
                                updateId: batch[0].updateId,
                                serverTimings,
                            });
                        }
                    } else {
                        io.to(documentId).emit("yjs-update", {
                            documentId,
                            generation,
                            update: mergedUpdate,
                            updateId: batch[0].updateId,
                            serverTimings,
                        });
                    }

                    const t_bcast_done = process.hrtime.bigint();
                    const broadcastMs = Number(t_bcast_done - t_bcast_start) / 1e6;
                    serverTimings.broadcastMs = Number(broadcastMs.toFixed(2));

                    // 6. Send individual yjs-ack to each contributing socket
                    for (const item of batch) {
                        const lockWait = Number(t_lock_acquired - item.t_server_recv) / 1e6;
                        const totalServer = Number(t_bcast_done - item.t_server_recv) / 1e6;

                        const itemTimings = {
                            ...serverTimings,
                            lockWaitMs: Number(lockWait.toFixed(2)),
                            serverTotalMs: Number(totalServer.toFixed(2)),
                        };

                        if (item.socket && item.socket.connected) {
                            item.socket.emit("yjs-ack", {
                                documentId,
                                updateId: item.updateId,
                                sequence,
                                generation,
                                serverTimings: itemTimings,
                            });
                        }

                        if (item.updateId) {
                            backendLatencyTracker.recordUpdate({
                                documentId,
                                updateId: item.updateId,
                                timings: itemTimings,
                            });
                        }

                        item.resolve(sequence);
                    }

                    console.log(`[yjsAccumulator] Batch of ${batch.length} updates persisted & broadcast:`, {
                        documentId,
                        generation,
                        sequence,
                        mongoTxMs: serverTimings.mongoTxMs,
                        batchSize: batch.length,
                    });

                    shouldCompact = sequence > 0 && sequence % 100 === 0;
                });

                if (shouldCompact && !compactionInProgress.has(documentId)) {
                    compactionInProgress.add(documentId);
                    compactYjsDocument(documentId)
                        .catch((err) => console.error("[yjsAccumulator] Compaction error:", err))
                        .finally(() => compactionInProgress.delete(documentId));
                }

            } catch (err) {
                console.error("[yjsAccumulator] Unexpected error in flush:", err);
                for (const item of batch) {
                    item.reject(err);
                }
            } finally {
                this.isProcessing = false;
                this.processingPromise = null;

                // Pipeline drain: if more updates arrived during transaction, immediately flush next batch
                if (this.queue.length > 0) {
                    this.flush();
                } else if (accumulators.get(documentId) === this && this.queue.length === 0) {
                    setTimeout(() => {
                        if (accumulators.get(documentId) === this && this.queue.length === 0 && !this.isProcessing) {
                            accumulators.delete(documentId);
                        }
                    }, 5000);
                }
            }
        })();

        return this.processingPromise;
    }
}

/**
 * Enqueue an update into the document's accumulator.
 */
export async function enqueueDocumentUpdate({
    io,
    socket,
    documentId,
    generation,
    binaryUpdate,
    updateId,
    t_server_recv,
}) {
    let acc = accumulators.get(documentId);

    // If accumulator exists but generation changed (e.g. version restored), await flush of old generation first
    if (acc && acc.generation !== generation) {
        console.log(`[yjsAccumulator] Generation change detected for ${documentId} (${acc.generation} -> ${generation}), awaiting active batch flush`);
        await acc.flush();
        accumulators.delete(documentId);
        acc = null;
    }

    if (!acc) {
        acc = new DocumentAccumulator(documentId, generation, io);
        accumulators.set(documentId, acc);
    }

    return new Promise((resolve, reject) => {
        acc.enqueue({
            socket,
            binaryUpdate,
            updateId,
            t_server_recv,
            resolve,
            reject,
        });
    });
}

/**
 * Clear any buffered accumulator updates for a document (called during version restoration).
 */
export async function clearAccumulator(documentId) {
    const acc = accumulators.get(documentId);
    if (!acc) return;

    if (acc.timer) {
        clearTimeout(acc.timer);
        acc.timer = null;
    }

    for (const item of acc.queue) {
        item.reject(new Error("Document version restored"));
    }
    acc.queue.length = 0;
    accumulators.delete(documentId);
}

/**
 * Flush all active accumulators across all documents (used during graceful shutdown or version restore).
 */
export async function flushAllAccumulators() {
    const promises = [];
    for (const [documentId, acc] of accumulators.entries()) {
        if (acc.queue.length > 0 || acc.isProcessing) {
            console.log(`[yjsAccumulator] Flushing pending updates for ${documentId}...`);
            promises.push(acc.flush());
        }
    }
    await Promise.allSettled(promises);
    accumulators.clear();
}

