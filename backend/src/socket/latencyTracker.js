/**
 * SyncSpace Backend Latency Metrics Tracker
 * Production metrics collection using process.hrtime.bigint().
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

class BackendLatencyTracker {
    constructor() {
        this.records = [];
        this.maxRecords = 500;
    }

    recordUpdate({ documentId, updateId, timings }) {
        this.records.push({
            documentId,
            updateId,
            timestamp: Date.now(),
            ...timings,
        });

        if (this.records.length > this.maxRecords) {
            this.records.shift();
        }
    }

    getSummary() {
        const records = this.records;
        const lockWaits = records.map((r) => r.lockWaitMs).filter((v) => v != null);
        const validations = records.map((r) => r.validationMs).filter((v) => v != null);
        const mongoTxs = records.map((r) => r.mongoTxMs).filter((v) => v != null);
        const ydocApplies = records.map((r) => r.ydocApplyMs).filter((v) => v != null);
        const redisPublishes = records.map((r) => r.redisPublishMs).filter((v) => v != null);
        const broadcasts = records.map((r) => r.broadcastMs).filter((v) => v != null);
        const totals = records.map((r) => r.serverTotalMs).filter((v) => v != null);

        return {
            lockWait: calculateStats(lockWaits),
            validation: calculateStats(validations),
            mongoTx: calculateStats(mongoTxs),
            ydocApply: calculateStats(ydocApplies),
            redisPublish: calculateStats(redisPublishes),
            broadcast: calculateStats(broadcasts),
            totalServer: calculateStats(totals),
        };
    }
}

export const backendLatencyTracker = new BackendLatencyTracker();
