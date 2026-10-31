import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

import registerDocumentHandlers from "./document.socket.js";
import socketAuth from "./socketAuth.js";
import { setIO } from "./socketInstance.js";

export default async function initializeSocket(server) {
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

    // Redis publisher
    const pubClient = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
    });

    // Redis subscriber
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) =>
        console.error("[Redis Publisher Error]", err)
    );

    subClient.on("error", (err) =>
        console.error("[Redis Subscriber Error]", err)
    );

    await Promise.all([
        pubClient.connect(),
        subClient.connect(),
    ]);

    io.adapter(createAdapter(pubClient, subClient));

    console.log("[Socket.IO] Redis adapter connected");

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