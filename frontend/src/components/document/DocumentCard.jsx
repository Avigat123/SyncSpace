import { useState, useMemo } from "react";
import { getInitials, formatRelativeTime } from "../../utils/helpers";

export default function DocumentCard({
  document,
  userId,
  viewMode = "list",
  onOpen,
  isStarred,
  onToggleStar,
  onDelete,
}) {
  const [showMembersModal, setShowMembersModal] = useState(false);

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

  // Build clean team members list with full names, emails, and roles
  const allTeamMembers = useMemo(() => {
    const list = [];
    if (document.owner) {
      const ownerObj = typeof document.owner === "object" ? document.owner : {};
      list.push({
        _id: ownerObj._id || document.owner,
        name: isOwner ? `${ownerObj.name || "You"} (You)` : (ownerObj.name || "Owner"),
        email: ownerObj.email || "",
        role: "Owner",
        isOwner: true,
      });
    }

    if (document.collaborators && Array.isArray(document.collaborators)) {
      document.collaborators.forEach((c) => {
        const u = typeof c.user === "object" ? c.user : {};
        const isSelf = (u._id || c.user)?.toString() === userId?.toString();
        list.push({
          _id: u._id || c._id || c.user,
          name: isSelf ? `${u.name || "You"} (You)` : (u.name || "Collaborator"),
          email: u.email || "",
          role: c.role ? (c.role.charAt(0).toUpperCase() + c.role.slice(1)) : "Editor",
          isOwner: false,
        });
      });
    }

    return list;
  }, [document.owner, document.collaborators, isOwner, userId]);

  const collaboratorsCount = document.collaborators?.length || 0;

  // Grid view
  if (viewMode === "grid") {
    return (
      <>
        <div
          onClick={() => onOpen(document._id)}
          className="group relative flex flex-col justify-between p-5 bg-surface-container-lowest border border-[#E8E8E5] hover:border-primary/50 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer min-h-[210px]"
        >
          {/* Top section: Icon + Actions */}
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-fixed/40 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary-container group-hover:text-on-primary transition-colors shadow-xs">
                <span className="material-symbols-outlined text-[22px]">
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
                    className="p-1.5 rounded-lg text-outline hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
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
                  className={`p-1.5 rounded-lg transition-colors ${isStarred
                    ? "text-amber-500"
                    : "text-outline hover:text-on-surface"
                    }`}
                  title={isStarred ? "Remove Star" : "Add Star"}
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

            {/* Document Title */}
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-2 mb-1">
              {document.title || "Untitled Document"}
            </h3>

            {/* Owner subtitle */}
            <p className="font-body-sm text-body-sm text-on-surface-variant text-xs">
              {isOwner ? "Created by you" : `Shared by ${ownerName}`}
            </p>

            {/* Collaborators interactive row */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowMembersModal(true);
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container/60 hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-medium transition-colors cursor-pointer"
              title="Click to view all team members and their roles"
            >
              <span className="material-symbols-outlined text-[15px] text-primary">group</span>
              <span>
                {allTeamMembers.length === 1
                  ? "Only you"
                  : `${allTeamMembers.length} team members`}
              </span>
            </div>
          </div>

          {/* Bottom section: Modified Date & Role Badge */}
          <div className="pt-3 border-t border-[#E8E8E5] flex items-center justify-between mt-4 text-on-surface-variant font-label-sm text-label-sm">
            <span className="flex items-center gap-1 text-xs truncate">
              <span className="material-symbols-outlined text-[14px] text-outline">schedule</span>
              {formatRelativeTime(document.updatedAt)}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-code-sm ${role === "Owner"
                ? "bg-primary-fixed/50 text-on-primary-fixed-variant"
                : "bg-surface-container text-on-surface-variant"
                }`}
            >
              {role}
            </span>
          </div>
        </div>

        {/* Team Members Modal */}
        {showMembersModal && renderMembersModal()}
      </>
    );
  }

  // List view (Table row)
  return (
    <>
      <tr
        onClick={() => onOpen(document._id)}
        className="group hover:bg-surface-container-low/70 transition-colors cursor-pointer border-b border-[#E8E8E5]/60 last:border-0"
      >
        {/* Document Name */}
        <td className="py-space-md px-space-md rounded-l-lg">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary-fixed/40 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">
                description
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-sm text-headline-sm text-on-surface truncate group-hover:text-primary transition-colors font-medium">
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
              {/* <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-code-sm text-code-sm bg-surface-container px-1.5 py-0.2 rounded text-on-surface-variant text-[11px]">
                  SyncSpace Doc
                </span>
              </div> */}
            </div>
          </div>
        </td>

        {/* Owner */}
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

        {/* Last Modified */}
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

        {/* Collaborators & Team Member Names */}
        <td className="py-space-md px-space-md">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowMembersModal(true);
            }}
            className="inline-flex items-center gap-2 p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer group/members"
            title="Click to view all collaborator names & roles"
          >
            {/* Avatars stack */}
            <div className="flex items-center -space-x-1.5">
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary font-bold text-[10px] flex items-center justify-center ring-2 ring-surface-container-lowest">
                  {getInitials(ownerName)}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-surface-container-lowest"></span>
              </div>
              {document.collaborators?.slice(0, 2).map((collab, idx) => {
                const u = typeof collab.user === "object" ? collab.user : {};
                const cName = u.name || "Collaborator";
                return (
                  <div key={idx} className="relative" title={`${cName} (${collab.role})`}>
                    <div className="w-6 h-6 rounded-full bg-secondary text-on-secondary font-bold text-[10px] flex items-center justify-center ring-2 ring-surface-container-lowest">
                      {getInitials(cName)}
                    </div>
                  </div>
                );
              })}
              {collaboratorsCount > 2 && (
                <div className="w-6 h-6 rounded-full bg-surface-container-high ring-2 ring-surface-container-lowest flex items-center justify-center text-[10px] font-semibold text-on-surface-variant">
                  +{collaboratorsCount - 2}
                </div>
              )}
            </div>

            {/* Team member names / count label */}
            <span className="text-xs text-on-surface-variant group-hover/members:text-primary group-hover/members:underline font-medium truncate max-w-[120px]">
              {collaboratorsCount === 0
                ? "Only you"
                : `${collaboratorsCount} ${collaboratorsCount === 1 ? "collaborator" : "collaborators"}`}
            </span>
          </div>
        </td>

        {/* Access Role */}
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

        {/* Quick Actions */}
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

      {/* Team Members Modal */}
      {showMembersModal && renderMembersModal()}
    </>
  );

  // Helper to render the Team Members modal
  function renderMembersModal() {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={(e) => {
          e.stopPropagation();
          setShowMembersModal(false);
        }}
      >
        <div
          className="bg-surface-bright rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E8E8E5] space-y-4 animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E8E8E5]">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">group</span>
                <span>Team Members ({allTeamMembers.length})</span>
              </div>
              <h3 className="text-base font-bold text-on-surface truncate mt-1">
                {document.title || "Untitled Document"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowMembersModal(false)}
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="divide-y divide-[#E8E8E5] max-h-72 overflow-y-auto pr-1">
            {allTeamMembers.map((member, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ${member.isOwner
                        ? "bg-primary-container text-on-primary"
                        : "bg-surface-container-high text-on-surface"
                      }`}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {member.name}
                    </p>
                    {member.email && (
                      <p className="text-xs text-on-surface-variant truncate">
                        {member.email}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${member.isOwner
                      ? "bg-primary-fixed/50 text-on-primary-fixed-variant"
                      : member.role === "Editor"
                        ? "bg-secondary-fixed/50 text-on-secondary-fixed-variant"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                >
                  {member.role}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowMembersModal(false)}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-on-surface bg-surface-container hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}
