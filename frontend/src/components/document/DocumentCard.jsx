export default function DocumentCard({
  document,
  userId,
  viewMode = "list",
  onOpen,
  isStarred,
  onToggleStar,
  onDelete,
}) {
  const isOwner =
    (document.owner?._id || document.owner)?.toString() === userId?.toString();

  const currentCollaborator = document.collaborators?.find((c) => {
    const cId = c.user?._id || c.user;
    return cId?.toString() === userId?.toString();
  });

  const role = isOwner
    ? "Owner"
    : currentCollaborator?.role
      ? currentCollaborator.role.charAt(0).toUpperCase() +
      currentCollaborator.role.slice(1)
      : "Viewer";

  const ownerName = isOwner
    ? "You"
    : document.owner?.name || "Team Member";

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  if (viewMode === "grid") {
    return (
      <div
        onClick={() => onOpen(document._id)}
        className="group relative flex flex-col justify-between p- space-md bg-surface-container-lowest border border-[#E8E8E5] hover:border-primary/40 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer min-h-[170px]"
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary-fixed/40 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">
                description
              </span>
            </div>
            <div className="flex items-center gap-1">
              {isOwner && onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(document);
                  }}
                  className="p-1 rounded-lg text-outline hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  title="Move to Trash"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    delete
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(document._id);
                }}
                className={`p-1 rounded-lg transition-colors ${isStarred
                  ? "text-amber-500"
                  : "text-outline hover:text-on-surface"
                  }`}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: isStarred ? "'FILL' 1" : "'FILL' 0" }}
                >
                  star
                </span>
              </button>
            </div>
          </div>

          <h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors line-clamp-2 mb-1">
            {document.title || "Untitled Document"}
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {isOwner ? "Created by you" : `Shared by ${ownerName}`}
          </p>
        </div>

        <div className="pt-3 border-t border-[#E8E8E5] flex items-center justify-between mt-3 text-on-surface-variant font-label-sm text-label-sm">
          <span className="truncate">
            {formatRelativeTime(document.updatedAt)}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium font-code-sm ${role === "Owner"
              ? "bg-primary-fixed/50 text-on-primary-fixed-variant"
              : "bg-surface-container text-on-surface-variant"
              }`}
          >
            {role}
          </span>
        </div>
      </div>
    );
  }

  // List view (Table row)
  return (
    <tr
      onClick={() => onOpen(document._id)}
      className="group hover:bg-surface-container-low/70 transition-colors cursor-pointer border-b border-[#E8E8E5]/60 last:border-0"
    >
      <td className="py-space-md px-space-md rounded-l-lg">
        <div className="flex items-center gap-space-sm min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-fixed/40 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
            <span className="material-symbols-outlined text-[18px]">
              description
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface truncate group-hover:text-primary transition-colors">
                {document.title || "Untitled Document"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(document._id);
                }}
                className={`p-0.5 rounded transition-colors ${isStarred ? "text-amber-500" : "text-outline/40 hover:text-outline"
                  }`}
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  style={{ fontVariationSettings: isStarred ? "'FILL' 1" : "'FILL' 0" }}
                >
                  star
                </span>
              </button>
            </div>
          </div>
        </div>
      </td>

      <td className="py-space-md px-space-md">
        <div className="flex items-center gap-space-xs">
          <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary font-bold text-[10px] flex items-center justify-center flex-shrink-0">
            {getInitials(ownerName)}
          </div>
          <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
            {ownerName}
          </span>
        </div>
      </td>

      <td className="py-space-md px-space-md">
        <div className="flex flex-col">
          <span className="font-body-sm text-body-sm text-on-surface font-medium">
            {formatRelativeTime(document.updatedAt)}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            by {ownerName}
          </span>
        </div>
      </td>

      <td className="py-space-md px-space-md">
        <div className="flex items-center -space-x-1.5">
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary font-bold text-[10px] flex items-center justify-center ring-2 ring-surface-container-lowest">
              {getInitials(ownerName)}
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-surface-container-lowest"></span>
          </div>
          {document.collaborators?.slice(0, 2).map((collab, idx) => {
            const cName = collab.user?.name || "Collaborator";
            return (
              <div key={idx} className="relative">
                <div className="w-6 h-6 rounded-full bg-secondary text-on-secondary font-bold text-[10px] flex items-center justify-center ring-2 ring-surface-container-lowest">
                  {getInitials(cName)}
                </div>
              </div>
            );
          })}
          {document.collaborators?.length > 2 && (
            <div className="w-6 h-6 rounded-full bg-surface-container-high ring-2 ring-surface-container-lowest flex items-center justify-center text-[10px] font-semibold text-on-surface-variant">
              +{document.collaborators.length - 2}
            </div>
          )}
        </div>
      </td>

      <td className="py-space-md px-space-md">
        <span
          className={`font-code-sm text-code-sm px-2 py-0.5 rounded-full font-medium ${role === "Owner"
            ? "bg-primary-fixed/50 text-on-primary-fixed-variant"
            : "bg-surface-container text-on-surface-variant"
            }`}
        >
          {role}
        </span>
      </td>

      <td className="py-space-md px-space-md text-right rounded-r-lg">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isOwner && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(document);
              }}
              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-outline hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Move to Trash"
            >
              <span className="material-symbols-outlined text-[18px]">
                delete
              </span>
            </button>
          )}
          <button
            type="button"
            className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
            title="Open Document"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_forward
            </span>
          </button>
        </div>
      </td>
    </tr>
  );
}

