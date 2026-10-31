import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import initializeSocket from "./socket/index.js";
import connectDB from "./config/db.js";
import redisClient from "./config/redis.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const startServer = async () => {
    try {
        // 1. Connect MongoDB
        await connectDB();

        // 2. Connect Redis
        await redisClient.connect();

        // 3. Initialize Socket.IO
        await initializeSocket(server);

        // 4. Start HTTP server
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("[Server Startup Error]", error);
        process.exit(1);
    }
};

startServer();