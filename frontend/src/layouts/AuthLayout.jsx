import { Outlet } from "react-router-dom";

function AuthLayout() {
    return (
        <div>
            <header>
                <h2>SyncSpace</h2>
            </header>

            <main>
                <Outlet />
            </main>
        </div>
    );
}

export default AuthLayout;