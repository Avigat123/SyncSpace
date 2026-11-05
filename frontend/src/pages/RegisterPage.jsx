import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../api/auth.js";

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(name, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight mb-1">
          Create account
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Start collaborating with your team in real time
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-error-container text-on-error-container text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block font-label-md text-label-md text-on-surface mb-1.5"
          >
            Full Name
          </label>
          <div className="relative">
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Alex Chen"
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-[#E8E8E5] text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="block font-label-md text-label-md text-on-surface mb-1.5"
          >
            Work Email
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="alex@syncspace.io"
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-[#E8E8E5] text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block font-label-md text-label-md text-on-surface mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-[#E8E8E5] text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-on-primary py-2.5 px-4 rounded-lg font-label-md text-label-md shadow-sm transition-all cursor-pointer"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
              <span>Creating account…</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#E8E8E5] text-center">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-label-md text-primary hover:underline"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
