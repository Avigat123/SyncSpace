import { Server } from "socket.io";
import registerDocumentHandlers from "./document.socket.js";
import socketAuth from "./socketAuth.js";
import { setIO } from "./socketInstance.js";

export default function initializeSocket(server) {
    const io = new Server(server, {
        cors: {
            // Read CLIENT_URL at connection time (same hoisting fix as app.js).
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

    setIO(io);

    io.use(socketAuth);

    io.on("connection", (socket) => {
        console.log(`[socket] connected id=${socket.id} user=${socket.user?.name ?? "unknown"}`);

        registerDocumentHandlers(io, socket);
    });

    return io;
}