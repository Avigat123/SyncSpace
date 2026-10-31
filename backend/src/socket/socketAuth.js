import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";

const socketAuth = async (socket, next) => {
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

        // Fetch the real User document so socket.user._id (Mongoose ObjectId)
        // is available — mirrors auth.middleware.js for HTTP routes.
        const user = await User.findById(
            decoded.userId ?? decoded.id
        ).select("-password");

        if (!user) {
            return next(new ApiError(401, "User not found"));
        }

        socket.user = user;

        next();
    } catch (error) {
        next(new ApiError(401, "Invalid token"));
    }
};

export default socketAuth;