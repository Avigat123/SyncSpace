import "./config/env.js";
import http from "http";
import app from "./app.js";
import initializeSocket from "./socket/index.js";
import connectDB from "./config/db.js";
import { connectMainRedis } from "./config/redis.js";
import { connectYjsRedis, subscribeToYjsUpdates, subscribeToYjsRestores } from "./socket/yjsRedis.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const startServer = async () => {
    try {
        // 1. Connect MongoDB (mandatory)
        await connectDB();

        // 2. Connect Redis (mandatory in production or when REDIS_REQUIRED=true; optional in development)
        const redisAvailable = await connectMainRedis();

        // 3. Connect Yjs Redis pub/sub clients if Redis is connected
        if (redisAvailable) {
            await connectYjsRedis();
        }

        // 4. Initialize Socket.IO with appropriate adapter
        await initializeSocket(server, { redisAvailable });

        if (redisAvailable) {
            await subscribeToYjsUpdates();
            await subscribeToYjsRestores();
        }

        // 5. Start HTTP server
        server.listen(PORT, () => {
            const mode = redisAvailable ? "Distributed (Redis active)" : "Standalone (In-memory adapter)";
            console.log(`🚀 Server running on port ${PORT} [Mode: ${mode}]`);
        });

    } catch (error) {
        console.error("[Server Startup Error]", error.message || error);
        process.exit(1);
    }
};

startServer();
