/**
 * SyncSpace Collaborative Telemetry Module
 * Retains metric tracking for production monitoring without polluting console output or global window.
 */

function calculatePercentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Number((sorted[lower] * (1 - weight) + sorted[upper] * weight).toFixed(2));
}

function calculateStats(values) {
  if (!values || values.length === 0) {
    return { count: 0, min: 0, avg: 0, median: 0, p95: 0, max: 0 };
  }
  const count = values.length;
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = Number((sum / count).toFixed(2));
  const min = Number(Math.min(...values).toFixed(2));
  const max = Number(Math.max(...values).toFixed(2));
  const median = calculatePercentile(values, 50);
  const p95 = calculatePercentile(values, 95);

  return { count, min, avg, median, p95, max };
}

class LatencyTelemetry {
  constructor() {
    this.pendingUpdates = new Map();
    this.completedRecords = [];
    this.maxRecords = 300;
    this.remoteApplyDurations = [];
  }

  reset() {
    this.pendingUpdates.clear();
    this.completedRecords.length = 0;
    this.remoteApplyDurations.length = 0;
  }

  recordBatchStart(updateId) {
    const now = performance.now();
    this.pendingUpdates.set(updateId, {
      updateId,
      batchStartTime: now,
      emitTime: null,
      batchDurationMs: null,
      serverTimings: null,
      ackTime: null,
      rttMs: null,
      estimatedUplinkMs: null,
      remoteApplicationMs: null,
      e2eDeliveryMs: null,
    });
  }

  recordBatchFlush(updateId, batchDurationMs, bytesCount, updateCount) {
    const entry = this.pendingUpdates.get(updateId);
    if (!entry) return;

    entry.emitTime = performance.now();
    entry.batchDurationMs = Number(batchDurationMs.toFixed(2));
    entry.bytesCount = bytesCount;
    entry.updateCount = updateCount;
  }

  recordServerAck(updateId, serverTimings) {
    const entry = this.pendingUpdates.get(updateId);
    if (!entry || !entry.emitTime) return;

    const now = performance.now();
    entry.ackTime = now;
    entry.serverTimings = serverTimings;

    const rtt = now - entry.emitTime;
    entry.rttMs = Number(rtt.toFixed(2));

    const serverTotal = serverTimings?.serverTotalMs || 0;
    const netTime = Math.max(0, rtt - serverTotal);
    entry.estimatedUplinkMs = Number((netTime / 2).toFixed(2));
    entry.persistenceTotalMs = Number((now - entry.batchStartTime).toFixed(2));
  }

  recordDeliveryAck(updateId, remoteApplicationMs) {
    const entry = this.pendingUpdates.get(updateId);
    if (!entry || !entry.emitTime) return;

    const now = performance.now();
    entry.remoteApplicationMs = Number(remoteApplicationMs.toFixed(2));
    entry.e2eDeliveryMs = Number((now - entry.batchStartTime).toFixed(2));

    this.completedRecords.push({ ...entry });
    if (this.completedRecords.length > this.maxRecords) {
      this.completedRecords.shift();
    }
    this.pendingUpdates.delete(updateId);
  }

  recordRemoteApply(remoteApplicationMs) {
    this.remoteApplyDurations.push(Number(remoteApplicationMs.toFixed(2)));
    if (this.remoteApplyDurations.length > this.maxRecords) {
      this.remoteApplyDurations.shift();
    }
  }

  getMetrics() {
    const records = this.completedRecords;
    const batchingList = records.map((r) => r.batchDurationMs).filter((v) => v != null);
    const uplinkList = records.map((r) => r.estimatedUplinkMs).filter((v) => v != null);
    const mongoTxList = records.map((r) => r.serverTimings?.mongoTxMs).filter((v) => v != null);
    const redisList = records.map((r) => r.serverTimings?.redisPublishMs).filter((v) => v != null);
    const serverTotalList = records.map((r) => r.serverTimings?.serverTotalMs).filter((v) => v != null);
    const remoteApplyList = [
      ...records.map((r) => r.remoteApplicationMs).filter((v) => v != null),
      ...this.remoteApplyDurations,
    ];
    const e2eList = records.map((r) => r.e2eDeliveryMs).filter((v) => v != null);

    return {
      batching: calculateStats(batchingList),
      uplink: calculateStats(uplinkList),
      mongoTx: calculateStats(mongoTxList),
      redis: calculateStats(redisList),
      serverTotal: calculateStats(serverTotalList),
      remoteApply: calculateStats(remoteApplyList),
      e2e: calculateStats(e2eList),
    };
  }
}

export const latencyTelemetry = new LatencyTelemetry();
