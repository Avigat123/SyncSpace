import { useEffect, useState } from "react";
import { getUserColor } from "../../collaboration/extensions";

export default function PresenceIndicator({ awareness }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!awareness) return;

    const updateUsers = () => {
      const uniqueUsers = new Map();

      awareness.getStates().forEach((state) => {
        const user = state.user;
        if (!user) return;

        const id = String(user.id || user._id || "");
        if (!id) return;

        uniqueUsers.set(id, {
          id,
          name: user.name || "Anonymous",
          color: user.color || getUserColor(id),
        });
      });

      setUsers(Array.from(uniqueUsers.values()));
    };

    updateUsers();
    awareness.on("change", updateUsers);

    return () => {
      awareness.off("change", updateUsers);
    };
  }, [awareness]);

  const visibleUsers = users.slice(0, 5);
  const remaining = users.length - visibleUsers.length;

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="flex items-center gap-space-sm">
      <div className="flex items-center -space-x-1.5 pl-1">
        {visibleUsers.map((user) => (
          <div
            key={user.id}
            className="relative group cursor-pointer"
            title={`${user.name} (Online)`}
          >
            <div
              className="w-7 h-7 rounded-full text-white flex items-center justify-center font-label-sm text-label-sm font-semibold shadow-xs ring-2 ring-surface select-none"
              style={{ backgroundColor: user.color }}
            >
              {getInitials(user.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-surface animate-pulse" />
          </div>
        ))}

        {remaining > 0 && (
          <div
            className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-code-sm text-[11px] font-semibold ring-2 ring-surface shadow-xs"
            title={`${remaining} more online`}
          >
            +{remaining}
          </div>
        )}
      </div>

      <span className="hidden sm:inline font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
        {users.length} {users.length === 1 ? "active" : "active"}
      </span>
    </div>
  );
}
