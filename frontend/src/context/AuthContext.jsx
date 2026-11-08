import { createContext, useEffect, useState, useCallback } from "react";
import {
    login as apiLogin,
    register as apiRegister,
    logout as apiLogout,
    getCurrentUser,
} from "../api/auth.js";
import socket from "../services/socket";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

const AUTH_SYNC_KEY = "syncspace:auth_sync";

function broadcastAuthSync(event) {
    if (typeof window === "undefined") return;

    try {
        if (typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel("syncspace_auth");
            channel.postMessage(event);
            channel.close();
        }
    } catch {
        // BroadcastChannel unavailable
    }

    try {
        localStorage.setItem(
            AUTH_SYNC_KEY,
            JSON.stringify({ ...event, _t: Date.now() })
        );
    } catch {
        // Storage unavailable
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial session restoration from HTTP-only cookie via /auth/me
    useEffect(() => {
        let isMounted = true;

        const fetchUser = async () => {
            try {
                const response = await getCurrentUser();
                if (isMounted) {
                    setUser(response?.user || null);
                }
            } catch {
                if (isMounted) {
                    setUser(null);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchUser();

        return () => {
            isMounted = false;
        };
    }, []);

    // Cross-tab authentication synchronization
    useEffect(() => {
        let channel = null;

        const handleAuthEvent = (data) => {
            if (!data || !data.type) return;

            if (data.type === "LOGOUT") {
                setUser(null);
                try {
                    socket.disconnect();
                } catch {
                    // Ignore disconnect error
                }
            } else if (data.type === "LOGIN" && data.user) {
                setUser(data.user);
            }
        };

        try {
            if (typeof BroadcastChannel !== "undefined") {
                channel = new BroadcastChannel("syncspace_auth");
                channel.onmessage = (e) => {
                    handleAuthEvent(e.data);
                };
            }
        } catch {
            // Ignore BroadcastChannel errors
        }

        const handleStorage = (e) => {
            if (e.key === AUTH_SYNC_KEY && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    handleAuthEvent(parsed);
                } catch {
                    // Ignore parse errors
                }
            }
        };

        const handleUnauthorized = () => {
            setUser(null);
            try {
                socket.disconnect();
            } catch {
                // Ignore disconnect error
            }
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener("syncspace:unauthorized", handleUnauthorized);

        return () => {
            if (channel) {
                channel.close();
            }
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("syncspace:unauthorized", handleUnauthorized);
        };
    }, []);

    // Centralized login method: updates user state immediately upon success and notifies other tabs
    const login = useCallback(async (email, password) => {
        const response = await apiLogin(email, password);
        if (response?.user) {
            setUser(response.user);
            broadcastAuthSync({ type: "LOGIN", user: response.user });
        }
        return response;
    }, []);

    // Centralized register method: updates user state immediately upon success and notifies other tabs
    const register = useCallback(async (name, email, password) => {
        const response = await apiRegister(name, email, password);
        if (response?.user) {
            setUser(response.user);
            broadcastAuthSync({ type: "LOGIN", user: response.user });
        }
        return response;
    }, []);

    // Centralized logout method: clears user state, disconnects socket, and notifies other tabs
    const logout = useCallback(async () => {
        try {
            await apiLogout();
        } finally {
            setUser(null);
            try {
                socket.disconnect();
            } catch {
                // Ignore disconnect error
            }
            broadcastAuthSync({ type: "LOGOUT" });
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                setUser,
                loading,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export default AuthContext;
