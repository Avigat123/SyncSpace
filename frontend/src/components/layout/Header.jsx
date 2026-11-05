import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useTheme from "../../hooks/useTheme";
import { createDocument } from "../../api/document";

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [creating, setCreating] = useState(false);

  const isEditor = location.pathname.startsWith("/document/");

  const handleCreateDocument = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const response = await createDocument("Untitled Document");
      if (response?.document?._id) {
        navigate(`/document/${response.document._id}`);
      }
    } catch (err) {
      console.error("Failed to create document from header:", err);
    } finally {
      setCreating(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface-bright/90 backdrop-blur-md border-b border-[#E8E8E5] z-40">
      <div className="h-16 w-full px-4 sm:px-space-lg flex items-center justify-between">
        {/* Left: Mobile hamburger & Breadcrumb */}
        <div className="flex items-center gap-space-sm min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-1.5 -ml-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg"
            aria-label="Open sidebar"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>

          <div className="flex items-center gap-space-xs sm:gap-space-sm text-on-surface-variant truncate">
            <Link
              to="/dashboard"
              className="font-body-sm text-body-sm hover:text-on-surface cursor-pointer hidden sm:inline"
            >
              SyncSpace
            </Link>
            <span className="material-symbols-outlined text-[16px] text-outline hidden sm:inline">
              chevron_right
            </span>
            <span className="font-label-md text-label-md text-on-surface font-medium truncate">
              {isEditor ? "Document Workspace" : "Workspace Overview"}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-space-lg">
          {/* Sync badge */}
          <div className="hidden md:flex items-center gap-space-xs bg-surface-container px-space-sm py-1 rounded-full border border-[#E8E8E5]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              All changes synced
            </span>
          </div>

          <div className="hidden md:block h-4 w-px bg-outline-variant"></div>

          {/* Quick tool buttons */}
          <div className="flex items-center gap-0.5">
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

            <button
              type="button"
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors hidden sm:block"
              title="Settings"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </button>
          </div>

          {/* New Document Button */}
          <button
            type="button"
            onClick={handleCreateDocument}
            disabled={creating}
            className="flex items-center gap-space-xs bg-primary-container hover:bg-primary text-on-primary px-3 sm:px-space-md py-1.5 sm:py-space-sm rounded-lg transition-colors shadow-[0_1px_2px_rgba(25,25,24,0.03)] cursor-pointer text-xs sm:text-sm font-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span className="font-label-md text-label-md">
              {creating ? "Creating…" : "New Document"}
            </span>
          </button>

          {/* User profile avatar */}
          <div
            className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center flex-shrink-0 cursor-pointer shadow-xs ml-0.5"
            title={user?.name || "User"}
          >
            {getInitials(user?.name)}
          </div>
        </div>
      </div>
    </header>
  );
}
