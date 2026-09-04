import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../api/auth.js";

function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await login(email, password);
            // Cookie is now set by the backend response.
            // Navigate to the dashboard so the socket will connect after login.
            navigate("/dashboard");
        } catch (err) {
            setError(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
            <h1>SyncSpace Login</h1>

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                    <label htmlFor="email">Email</label>
                    <br />
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>

                <div style={{ marginBottom: 12 }}>
                    <label htmlFor="password">Password</label>
                    <br />
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>

                {error && (
                    <p style={{ color: "red", marginBottom: 8 }}>{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    style={{ width: "100%", padding: 10 }}
                >
                    {loading ? "Signing in…" : "Sign In"}
                </button>
            </form>

            <p style={{ marginTop: 16 }}>
                No account? <Link to="/register">Register</Link>
            </p>
        </div>
    );
}

export default LoginPage;