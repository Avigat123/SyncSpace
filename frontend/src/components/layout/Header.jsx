import { Link, useLocation } from "react-router-dom";
import useTheme from "../../hooks/useTheme";

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const isEditor = location.pathname.startsWith("/document/");

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
        </div>
      </div>
    </header>
  );
}
