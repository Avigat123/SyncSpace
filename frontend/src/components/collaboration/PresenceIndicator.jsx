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
                    color: getUserColor(id),
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

    const visibleUsers = users.slice(0, 4);
    const remaining = users.length - visibleUsers.length;

    return (
        <div className="presence-indicator">
            <div className="presence-avatars">
                {visibleUsers.map((user) => (
                    <div
                        className="presence-user"
                        key={user.id}
                        title={user.name}
                        style={{ backgroundColor: user.color }}
                    >
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                ))}

                {remaining > 0 && (
                    <div
                        className="presence-user presence-overflow"
                        title={`${remaining} more collaborators`}
                    >
                        +{remaining}
                    </div>
                )}
            </div>

            <span className="presence-count">
                {users.length} {users.length === 1 ? "person" : "people"} online
            </span>
        </div>
    );
}