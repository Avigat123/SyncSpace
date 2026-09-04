import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";

const socketAuth = (socket, next) => {
    try {
        const token = socket.handshake.headers.cookie
            ?.split("; ")
            .find(cookie => cookie.startsWith("token="))
            ?.split("=")[1];

        if (!token) {
            return next(new ApiError(401, "Authentication required"));
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        socket.user = decoded;

        next();
    } catch (error) {
        next(new ApiError(401, "Invalid token"));
    }
};

export default socketAuth;