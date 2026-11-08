import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.routes.js";
import errorHandler from "./middlewares/error.middleware.js";
import documentRoutes from "./routes/document.routes.js";
import { getRedisHealth, isRedisMandatory } from "./config/redis.js";

const app = express();

/*
|--------------------------------------------------------------------------
| Middlewares
|--------------------------------------------------------------------------
*/

app.use(
    cors({
        // Use a function so the env var is read at request time,
        // not at module-evaluation time (ES module imports are hoisted
        // before dotenv.config() runs in server.js).
        origin: (origin, callback) => {
            const allowed = process.env.CLIENT_URL;
            if (!origin || origin === allowed) {
                callback(null, true);
            } else {
                callback(new Error(`CORS: origin ${origin} not allowed`));
            }
        },
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api/documents", documentRoutes);

/*
|--------------------------------------------------------------------------
| Health & Readiness Probes
|--------------------------------------------------------------------------
*/

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        service: "syncspace-backend",
    });
});

app.get("/api/ready", (req, res) => {
    const mongoState = mongoose.connection.readyState;
    const isMongoConnected = mongoState === 1;

    const redisHealth = getRedisHealth();
    const isRedisRequired = isRedisMandatory();

    // Application is ready if MongoDB is connected and (Redis is connected OR Redis is not required in standalone mode)
    const isReady = isMongoConnected && (!isRedisRequired || redisHealth.connected);

    res.status(isReady ? 200 : 503).json({
        ready: isReady,
        status: isReady ? "ready" : "unavailable",
        mode: redisHealth.status === "connected" ? "distributed" : "standalone",
        timestamp: new Date().toISOString(),
        dependencies: {
            mongodb: {
                status: isMongoConnected ? "connected" : "disconnected",
                readyState: mongoState,
            },
            redis: {
                status: redisHealth.status,
                connected: redisHealth.connected,
                required: isRedisRequired,
            },
        },
    });
});

app.use("/api/auth", authRoutes);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use(errorHandler);

export default app;