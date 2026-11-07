import { createContext, useEffect, useState, useCallback } from "react";
import {
    login as apiLogin,
    register as apiRegister,
    logout as apiLogout,
    getCurrentUser,
} from "../api/auth.js";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

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

    // Centralized login method: updates user state immediately upon success
    const login = useCallback(async (email, password) => {
        const response = await apiLogin(email, password);
        if (response?.user) {
            setUser(response.user);
        }
        return response;
    }, []);

    // Centralized register method: updates user state immediately upon success
    const register = useCallback(async (name, email, password) => {
        const response = await apiRegister(name, email, password);
        if (response?.user) {
            setUser(response.user);
        }
        return response;
    }, []);

    // Centralized logout method: clears user state
    const logout = useCallback(async () => {
        try {
            await apiLogout();
        } finally {
            setUser(null);
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
