import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useTheme from "../../hooks/useTheme";
import { getInitials } from "../../utils/helpers";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const currentFilter = searchParams.get("filter") || "all";
  const isDashboard = location.pathname === "/dashboard";

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navLinks = [
    {
      group: "Workspace",
      items: [
        {
          label: "Dashboard",
          icon: "grid_view",
          to: "/dashboard",
          active: isDashboard && currentFilter === "all",
        },
        {
          label: "My Documents",
          icon: "description",
          to: "/dashboard?filter=owned",
          active: isDashboard && currentFilter === "owned",
        },
        {
          label: "Shared with Me",
          icon: "group",
          to: "/dashboard?filter=shared",
          active: isDashboard && currentFilter === "shared",
        },
      ],
    },
    {
      group: "Library",
      items: [
        {
          label: "Recent",
          icon: "schedule",
          to: "/dashboard?filter=recent",
          active: isDashboard && currentFilter === "recent",
        },
        {
          label: "Starred",
          icon: "star",
          to: "/dashboard?filter=starred",
          active: isDashboard && currentFilter === "starred",
        },
        {
          label: "Trash",
          icon: "delete",
          to: "/dashboard?filter=trash",
          active: isDashboard && currentFilter === "trash",
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-on-surface/20 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-surface-container-low border-r border-[#E8E8E5] z-50 flex flex-col justify-between select-none transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand header */}
          <div className="h-16 px-space-lg flex items-center justify-between border-b border-[#E8E8E5]">
            <Link to="/dashboard" className="flex items-center gap-space-sm min-w-0" onClick={onClose}>
              <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                S
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight truncate leading-none">
                  SyncSpace
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate mt-1 leading-none">
                  Your team's ideas, in sync
                </span>
              </div>
            </Link>

            {/* Close button on mobile */}
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1 text-on-surface-variant hover:text-on-surface rounded-lg"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Quick search button */}
          <div className="p-space-md">
            <button
              type="button"
              onClick={() => {
                const searchInput = document.getElementById("dashboard-search-input");
                if (searchInput) {
                  searchInput.focus();
                } else {
                  navigate("/dashboard");
                }
              }}
              className="w-full flex items-center justify-between px-space-md py-space-sm rounded-lg bg-surface-container-lowest border border-[#E8E8E5] text-on-surface-variant hover:text-on-surface hover:bg-surface transition-all shadow-[0_1px_2px_rgba(25,25,24,0.03)] cursor-pointer"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[18px]">search</span>
                <span className="font-body-sm text-body-sm">Quick search</span>
              </div>
              <kbd className="font-code-sm text-code-sm bg-surface-container px-space-xs py-0.5 rounded border border-[#E8E8E5] text-on-surface-variant">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-space-sm space-y-space-xs overflow-y-auto">
            {navLinks.map((section, idx) => (
              <div key={section.group} className={idx > 0 ? "pt-space-md" : ""}>
                <div className="px-space-md py-space-xs">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                    {section.group}
                  </span>
                </div>
                <div className="space-y-0.5 mt-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={onClose}
                      className={`flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-colors ${
                        item.active
                          ? "bg-surface-container-highest text-on-surface font-semibold"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {item.icon}
                      </span>
                      <span className="font-body-md text-body-md">
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* User profile footer */}
        <div className="relative p-space-sm border-t border-[#E8E8E5] bg-surface-container-low">
          {showUserMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-surface-container-lowest border border-[#E8E8E5] rounded-xl shadow-lg p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-2 border-b border-[#E8E8E5] mb-1">
                <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                  {user?.name || "User"}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {user?.email || ""}
                </p>
              </div>

              {/* Theme toggle row in user menu */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-on-surface hover:bg-surface-container font-label-md text-label-md transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-outline">
                    {isDark ? "light_mode" : "dark_mode"}
                  </span>
                  <span>{isDark ? "Light theme" : "Dark theme"}</span>
                </div>
                <span className="font-code-sm text-code-sm text-outline capitalize">
                  {isDark ? "Dark" : "Light"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-error hover:bg-error-container/40 font-label-md text-label-md transition-colors cursor-pointer text-left mt-1"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>Sign out</span>
              </button>
            </div>
          )}

          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center justify-between p-space-sm rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-md text-label-md text-on-surface font-semibold truncate leading-tight">
                  {user?.name || "Alex Chen"}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate leading-tight">
                  {user?.email || "alex@syncspace.io"}
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-outline text-[18px]">
              unfold_more
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
