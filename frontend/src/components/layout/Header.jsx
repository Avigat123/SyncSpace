import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useTheme from "../../hooks/useTheme";
import useAuth from "../../hooks/useAuth";
import { logout } from "../../api/auth";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { user, setUser } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .replace(/\(You\)/g, "")
      .trim()
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const isEditor = location.pathname.startsWith("/document/");
  const searchParams = new URLSearchParams(location.search);
  const filter = searchParams.get("filter");

  let subtitle = "Workspace Overview";
  if (isEditor) {
    subtitle = "Document Workspace";
  } else if (filter === "trash") {
    subtitle = "Recently Deleted";
  } else if (filter === "recent") {
    subtitle = "Recent Documents";
  } else if (filter === "starred") {
    subtitle = "Starred Documents";
  } else if (filter === "owned") {
    subtitle = "My Documents";
  } else if (filter === "shared") {
    subtitle = "Shared with Me";
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface-bright/90 backdrop-blur-md border-b border-[#E8E8E5] z-40">
      <div className="h-16 w-full max-w-[1240px] mx-auto px-4 sm:px-space-xl flex items-center justify-between">
        {/* Left: Brand & Breadcrumb */}
        <div className="flex items-center gap-space-sm min-w-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 text-on-surface hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              S
            </div>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight">
              SyncSpace
            </span>
          </Link>

          <span className="material-symbols-outlined text-[16px] text-outline">
            chevron_right
          </span>

          <span className="font-label-md text-label-md text-on-surface-variant font-medium truncate">
            {subtitle}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-space-md">
          {/* Sync status badge */}
          <div className="hidden sm:flex items-center gap-space-xs bg-surface-container px-space-sm py-1 rounded-full border border-[#E8E8E5]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              All changes synced
            </span>
          </div>

          <div className="hidden sm:block h-4 w-px bg-outline-variant"></div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle dark mode"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* Account on Navbar */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-surface-container border border-[#E8E8E5] transition-colors cursor-pointer shadow-2xs"
              title="Account Settings"
            >
              <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center shrink-0">
                {getInitials(user?.name)}
              </div>
              <span className="font-label-md text-label-md text-on-surface font-semibold max-w-[100px] truncate hidden md:inline text-xs">
                {user?.name?.split(" ")[0] || "User"}
              </span>
              <span className="material-symbols-outlined text-outline text-[16px]">
                expand_more
              </span>
            </button>

            {/* Account Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-surface-bright border border-[#E8E8E5] rounded-xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2.5 border-b border-[#E8E8E5] mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {getInitials(user?.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                        {user?.name || "User"}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate text-xs">
                        {user?.email || ""}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-error hover:bg-error-container/40 font-label-md text-label-md transition-colors cursor-pointer text-left"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
