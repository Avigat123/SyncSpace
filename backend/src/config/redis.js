import { createClient } from "redis";

const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
    console.error("[Redis] Connection error:", err);
});

redisClient.on("connect", () => {
    console.log("[Redis] Connecting...");
});

redisClient.on("ready", () => {
    console.log("[Redis] Connected successfully");
});

export default redisClient;