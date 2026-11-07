import { io } from "socket.io-client";

const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    transports: ["polling", "websocket"],
});

socket.on("connect", () => {
    console.log("🟢 SOCKET CONNECTED");
    console.log("Socket ID:", socket.id);
});

socket.on("connect_error", (error) => {
    console.error("🔴 SOCKET CONNECTION ERROR");
    console.error("Message:", error.message);
});

socket.on("disconnect", (reason) => {
    console.log("🟡 SOCKET DISCONNECTED");
    console.log("Reason:", reason);
});

export default socket;
