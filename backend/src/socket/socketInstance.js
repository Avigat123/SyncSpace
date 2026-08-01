let io = null;

export function setIO(socketIO) {

    if (io) {
        throw new Error("Socket.IO is already initialized.");
    }

    io = socketIO;
}

export function getIO() {

    if (!io) {
        throw new Error("Socket.IO has not been initialized.");
    }

    return io;
}