import { Server } from "socket.io";
import registerDocumentHandlers from "./document.socket.js";
import socketAuth from "./socketAuth.js";



export default function initializeSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true,
        },
    });

    io.use(socketAuth);
    
    io.on("connection", (socket) => {
        console.log("User connected");
        
        registerDocumentHandlers(io, socket);
        
        socket.on("disconnect", () => {
            console.log("User disconnected");
        });
    });
    


    return io;
}