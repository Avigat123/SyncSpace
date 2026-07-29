import dotenv from "dotenv";
dotenv.config();
import http from "http";
import initializeSocket from "./socket/index.js"; import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initializeSocket(server);

const startServer = async () => {
    try {
        await connectDB();

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error(error);
    }
};

startServer();