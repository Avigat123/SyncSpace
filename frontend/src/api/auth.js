import request from "./axios.js";

export const login = (email, password) =>
    request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });

export const register = (name, email, password) =>
    request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
    });

export const logout = () =>
    request("/auth/logout", { method: "POST" });

export const getCurrentUser = () =>
    request("/auth/me");
