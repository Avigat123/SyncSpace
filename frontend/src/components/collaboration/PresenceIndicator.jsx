import { useEffect, useState } from "react";

export default function PresenceIndicator({ awareness }) {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        if (!awareness) return;

        const updateUsers = () => {
            const states = Array.from(awareness.getStates().values());

            const collaborators = states
                .map((state) => state.user)
                .filter(Boolean);

            setUsers(collaborators);
        };

        updateUsers();

        awareness.on("change", updateUsers);

        return () => {
            awareness.off("change", updateUsers);
        };
    }, [awareness]);

    return (
        <div className="presence-indicator">
            {users.map((user) => (
                <div
                    className="presence-user"
                    key={user.id}
                    title={user.name}
                    style={{ backgroundColor: user.color || "#6366f1" }}
                >
                    {user.name?.charAt(0).toUpperCase()}
                </div>
            ))}
        </div>
    );
}