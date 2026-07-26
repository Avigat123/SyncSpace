import User from "../models/user.model.js";
import generateToken from "../utils/generateToken.js";
import ApiError from "../utils/ApiError.js";

export const registerUser = async (userData) => {
    const { name, email, password } = userData;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw new ApiError(
            409,
            "User already exists"
        );
    }

    const user = await User.create({
        name,
        email,
        password,
    });

    const userResponse = await User.findById(user._id).select("-password");

    const token = generateToken(user._id);

    return {
        user: userResponse,
        token,
    };
};

export const loginUser = async (email, password) => {
    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(
            404,
            "Invalid email or password"
        );
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
        throw new ApiError(
            401,
            "Invalid email or password"
        );
    }

    const token = generateToken(user._id);

    const userResponse = await User.findById(user._id).select("-password");

    return {
        user: userResponse,
        token,
    };
};