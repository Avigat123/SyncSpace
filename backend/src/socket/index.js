import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { formatRedisError } from "../config/redis.js";

import registerDocumentHandlers from "./document.socket.js";
import socketAuth from "./socketAuth.js";
import { setIO } from "./socketInstance.js";

export default async function initializeSocket(server, options = {}) {
    const { redisAvailable = false } = options;

    const io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                const allowed = process.env.CLIENT_URL;

                if (!origin || origin === allowed) {
                    callback(null, true);
                } else {
                    callback(new Error(`CORS: origin ${origin} not allowed`));
                }
            },
            credentials: true,
        },
    });

    if (redisAvailable) {
        try {
            const pubClient = createClient({
                url: process.env.REDIS_URL || "redis://localhost:6379",
                socket: {
                    connectTimeout: 3000,
                    reconnectStrategy: (retries) => Math.min(retries * 500, 3000),
                },
            });

            const subClient = pubClient.duplicate();

            pubClient.on("error", (err) =>
                console.warn("[Redis Publisher Error]", formatRedisError(err))
            );

            subClient.on("error", (err) =>
                console.warn("[Redis Subscriber Error]", formatRedisError(err))
            );

            await Promise.all([pubClient.connect(), subClient.connect()]);

            io.adapter(createAdapter(pubClient, subClient));

            console.log("[Socket.IO] Redis adapter connected (distributed mode)");
        } catch (err) {
            console.warn(`[Socket.IO] Could not attach Redis adapter: ${formatRedisError(err)}. Falling back to in-memory adapter.`);
        }
    } else {
        console.log("[Socket.IO] Running with in-memory adapter (standalone mode)");
    }

    setIO(io);

    io.use(socketAuth);

    io.on("connection", (socket) => {
        console.log(
            `[socket] connected id=${socket.id} user=${socket.user?.name ?? "unknown"}`
        );
        registerDocumentHandlers(io, socket);
    });

    return io;
}
