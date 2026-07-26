import { registerUser, loginUser } from "../services/auth.service.js";
import asyncHandler from "../utils/asyncHandler.js";  // used async handler to avoid using try catch again and again 

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = asyncHandler(async (req, res) => {

    const { user, token } = await registerUser(req.body);

    res.cookie("token", token, cookieOptions);

    res.status(201).json({
        success: true,
        message: "User registered successfully",
        user,
    });
});

export const login = asyncHandler(async (req, res) => {

    const { email, password } = req.body;

    const { user, token } = await loginUser(email, password);

    res.cookie("token", token, cookieOptions);

    res.status(200).json({
        success: true,
        message: "Login successful",
        user,
    });
});

export const logout = asyncHandler(async (req, res) => {
    res.clearCookie("token", cookieOptions);

    res.json({
        success: true,
        message: "Logged out successfully",
    });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        user: req.user,
    });
});