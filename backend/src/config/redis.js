import "./env.js";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Formats Redis and socket errors cleanly, unpacking AggregateErrors
 * (such as multi-address ECONNREFUSED/EACCES) to provide readable log output.
 */
export function formatRedisError(err) {
    if (!err) return "Unknown error";
    if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        return err.errors.map((e) => e.message || e.code).join(", ");
    }
    return err.message || err.code || String(err);
}

/**
 * Returns true if Redis is strictly required for application startup.
 * Defaults to true in production unless explicitly set to 'false'.
 * Defaults to false in development unless explicitly set to 'true'.
 */
export const isRedisMandatory = () => {
    if (process.env.REDIS_REQUIRED !== undefined) {
        return process.env.REDIS_REQUIRED === "true";
    }
    return process.env.NODE_ENV === "production";
};

let redisStatus = "uninitialized"; // 'uninitialized' | 'connecting' | 'connected' | 'disconnected' | 'disabled_standalone'
let isConnected = false;
let hasConnected = false;

const redisClient = createClient({
    url: redisUrl,
    socket: {
        connectTimeout: 3000,
        reconnectStrategy: (retries) => {
            // During initial startup before first successful connection:
            // Stop immediately if connection fails so connectMainRedis() can decide
            // whether to abort startup (REDIS_REQUIRED=true) or enter standalone fallback.
            if (!hasConnected) {
                return false;
            }
            // Once connected, if connection drops, attempt reconnection with backoff
            return Math.min(retries * 500, 3000);
        },
    },
});

// Always register the error listener immediately to prevent unhandled error events.
redisClient.on("error", (err) => {
    isConnected = false;
    // Suppress connection noise when running in standalone mode where Redis is intentionally disabled
    if (redisStatus !== "disabled_standalone" && hasConnected) {
        console.warn("[Redis] Connection error:", formatRedisError(err));
        redisStatus = "disconnected";
    }
});

redisClient.on("connect", () => {
    redisStatus = "connecting";
    console.log("[Redis] Connecting...");
});

redisClient.on("ready", () => {
    redisStatus = "connected";
    isConnected = true;
    hasConnected = true;
    console.log("[Redis] Connected successfully");
});

export async function connectMainRedis() {
    try {
        redisStatus = "connecting";
        await redisClient.connect();
        redisStatus = "connected";
        isConnected = true;
        hasConnected = true;
        return true;
    } catch (err) {
        isConnected = false;
        const formatted = formatRedisError(err);
        if (isRedisMandatory()) {
            redisStatus = "disconnected";
            throw new Error(`[Redis] Required connection to ${redisUrl} failed: ${formatted}`);
        } else {
            redisStatus = "disabled_standalone";
            console.warn(
                `⚠️ [Redis] Redis is unavailable at ${redisUrl} (${formatted}). Starting in standalone single-instance mode (in-memory Socket.IO adapter). Cross-instance sync is disabled.`
            );
            return false;
        }
    }
}

export function getRedisHealth() {
    return {
        status: redisStatus,
        connected: isConnected,
        required: isRedisMandatory(),
    };
}

export function isRedisOperational() {
    return isConnected && redisStatus === "connected";
}

export default redisClient;
