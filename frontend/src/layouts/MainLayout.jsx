import { Outlet, useNavigate } from "react-router-dom";
import { logout } from "../api/auth.js";
import useAuth from "../hooks/useAuth";

function MainLayout() {
    const navigate = useNavigate();
    const { setUser } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
            setUser(null);
            navigate("/login", { replace: true });
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return (
        <div>
            <header>
                <h2>SyncSpace</h2>

                <button onClick={handleLogout}>
                    Logout
                </button>
            </header>

            <main>
                <Outlet />
            </main>
        </div>
    );
}

export default MainLayout;