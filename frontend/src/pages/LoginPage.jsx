import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";

function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect directly to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!password) {
      setError("Please enter your password");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = email.trim().length > 0 && password.length >= 6;

  return (
    <div className="w-full max-w-[430px] bg-white text-gray-900 rounded-[26px] sm:rounded-[30px] p-6 sm:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.32)] relative">
      {/* Brand Logo Header: SYNCSPACE [ID] */}
      <div className="flex items-center justify-center gap-1.5 mb-7">
        <span className="font-supercell-bd text-xl sm:text-2xl tracking-wide text-black uppercase">
          SYNCSPACE
        </span>
        <span className="bg-black text-white font-supercell-bd text-xs sm:text-sm px-2.5 py-0.5 rounded-lg tracking-wider">
          ID
        </span>
      </div>

      {/* Stepper Bar */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <span className="font-supercell-bd text-base sm:text-lg font-bold text-black tracking-tight">
            Log in
          </span>
          <span className="font-supercell-bd text-base sm:text-lg font-bold text-[#8d95a1]">
            Verify
          </span>
        </div>
        <div className="relative w-full h-5 sm:h-6 rounded-full bg-gradient-to-r from-[#2176ff] via-[#00c0f0] to-[#2dd4bf] flex items-center px-1 shadow-inner">
          <div className="w-4 h-4 sm:w-4.5 sm:h-4.5 bg-white rounded-full shadow-md shrink-0 ml-0.5" />
        </div>
      </div>

      {/* Title & Description */}
      <div className="text-center mb-6">
        <h1 className="font-supercell-bd text-xl sm:text-2xl whitespace-pre-wrap text-heading-black text-pretty tracking-tight mb-2">
          Log in to <span>SyncSpace</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#555555] font-medium leading-relaxed max-w-xs mx-auto">
          Enter your email and password to access your collaborative workspace.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-red-500 shrink-0">
            error
          </span>
          <span className="break-words font-medium">{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            required
            placeholder="Enter your email"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200/90 text-gray-900 text-sm sm:text-base placeholder:text-gray-400 shadow-[0_2px_6px_rgba(0,0,0,0.05)] hover:shadow-sm focus:shadow-md focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50 transition-all font-sans"
          />
        </div>

        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            required
            minLength={6}
            placeholder="Enter your password"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200/90 text-gray-900 text-sm sm:text-base placeholder:text-gray-400 shadow-[0_2px_6px_rgba(0,0,0,0.05)] hover:shadow-sm focus:shadow-md focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50 transition-all font-sans"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-3">
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className={`w-full py-3.5 px-6 rounded-full font-supercell-bd uppercase tracking-wider text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              !isFormValid || loading
                ? "bg-[#c4dcfe] text-white cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md hover:shadow-lg cursor-pointer active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>LOGGING IN…</span>
              </>
            ) : (
              <span>LOG IN</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setEmail("");
              setPassword("");
              setError("");
            }}
            className="w-full py-3.5 px-6 rounded-full font-supercell-bd uppercase tracking-wider text-xs sm:text-sm border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer text-center"
          >
            CANCEL
          </button>
        </div>
      </form>

      {/* Bottom Switch Link */}
      <div className="mt-6 text-center">
        <Link
          to="/register"
          className="text-xs sm:text-sm font-semibold text-blue-600 hover:underline hover:text-blue-700 transition-colors"
        >
          Want to register a SyncSpace ID?
        </Link>
      </div>
    </div>
  );
}

export default LoginPage;
