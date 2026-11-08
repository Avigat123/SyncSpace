import { useState } from "react";
import {
  shareDocument,
  removeCollaborator,
  updateCollaboratorRole,
} from "../../api/document";
import { getInitials } from "../../utils/helpers";

export default function ShareDialog({
  isOpen,
  onClose,
  document,
  isOwner,
  onDocumentUpdated,
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [copied, setCopied] = useState(false);

  if (!isOpen || !document) return null;

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim() || inviting) return;

    setInviting(true);
    setMessage({ text: "", type: "" });

    try {
      const response = await shareDocument(document._id, email.trim(), role);
      setMessage({
        text: response.message || "Invitation sent successfully!",
        type: "success",
      });
      setEmail("");
      if (onDocumentUpdated) await onDocumentUpdated();
    } catch (err) {
      setMessage({
        text: err.message || "Failed to invite collaborator",
        type: "error",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (collaboratorId, newRole) => {
    if (newRole === "remove") {
      handleRemove(collaboratorId);
      return;
    }

    setMessage({ text: "", type: "" });
    try {
      const response = await updateCollaboratorRole(
        document._id,
        collaboratorId,
        newRole
      );
      setMessage({
        text: response.message || "Collaborator role updated",
        type: "success",
      });
      if (onDocumentUpdated) await onDocumentUpdated();
    } catch (err) {
      setMessage({
        text: err.message || "Failed to update role",
        type: "error",
      });
    }
  };

  const handleRemove = async (collaboratorId) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this collaborator's access?"
    );
    if (!confirmed) return;

    setMessage({ text: "", type: "" });
    try {
      const response = await removeCollaborator(document._id, collaboratorId);
      setMessage({
        text: response.message || "Collaborator removed",
        type: "success",
      });
      if (onDocumentUpdated) await onDocumentUpdated();
    } catch (err) {
      setMessage({
        text: err.message || "Failed to remove collaborator",
        type: "error",
      });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const owner = document.owner || {};
  const collaborators = document.collaborators || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[620px] bg-surface-container-lowest rounded-xl shadow-2xl border border-[#E8E8E5] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-5 flex items-start justify-between bg-surface-bright border-b border-[#E8E8E5]/80">
          <div className="flex items-start gap-space-md min-w-0 pr-space-md">
            <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary flex-shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[22px]">
                description
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                  Share Settings
                </span>
                <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  Collaborative Room
                </span>
              </div>
              <h2
                className="font-headline-md text-headline-md text-on-surface tracking-tight truncate mt-0.5"
                title={`Share "${document.title}"`}
              >
                Share “{document.title || "Untitled Document"}”
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="px-6 py-5 flex flex-col gap-space-lg overflow-y-auto max-h-[calc(85vh-160px)]">
          {/* Status Message */}
          {message.text && (
            <div
              className={`p-3 rounded-lg text-body-sm flex items-center gap-2 ${
                message.type === "error"
                  ? "bg-error-container text-on-error-container"
                  : "bg-tertiary-container/20 text-tertiary border border-tertiary/20"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {message.type === "error" ? "error" : "check_circle"}
              </span>
              <span>{message.text}</span>
            </div>
          )}

          {/* Section 1: Invite Collaborators Input */}
          {isOwner && (
            <form onSubmit={handleInvite} className="flex flex-col gap-space-xs">
              <label
                htmlFor="invite-email"
                className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between"
              >
                <span>Invite people to collaborate</span>
                <span className="font-label-sm text-label-sm text-outline font-normal">
                  Press Enter to invite
                </span>
              </label>

              <div className="flex items-center gap-space-xs bg-surface-container-low p-1.5 rounded-lg border border-[#E8E8E5] focus-within:bg-surface-container-lowest focus-within:border-primary transition-all">
                <div className="flex items-center gap-space-xs pl-space-sm flex-1 min-w-0 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px] text-outline">
                    group_add
                  </span>
                  <input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address (e.g. maya@syncspace.io)..."
                    className="w-full bg-transparent font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none py-1"
                    required
                  />
                </div>

                {/* Role Select */}
                <div className="relative flex items-center">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="appearance-none font-label-md text-label-md bg-surface-container-high text-on-surface hover:bg-surface-container-highest pl-3.5 pr-7 py-1.5 rounded-md cursor-pointer transition-colors focus:outline-none text-center font-medium leading-none"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[16px]">
                    expand_more
                  </span>
                </div>

                {/* Invite Button */}
                <button
                  type="submit"
                  disabled={inviting || !email.trim()}
                  className="bg-primary hover:bg-primary/90 disabled:opacity-60 text-on-primary font-label-md text-label-md px-space-lg py-1.5 rounded-md flex items-center gap-1 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  {inviting ? "Inviting…" : "Invite"}
                </button>
              </div>
            </form>
          )}

          {/* Section 2: General Access / Link Sharing */}
          <div className="bg-surface-container-low rounded-xl p-space-md border border-[#E8E8E5] flex flex-col gap-space-sm">
            <div className="flex items-center justify-between gap-space-md">
              <div className="flex items-center gap-space-md min-w-0">
                <div className="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    public
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-headline-sm text-headline-sm text-on-surface truncate leading-tight">
                    Direct Workspace Link
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    Anyone invited can access with this link
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className={`group inline-flex items-center gap-space-xs px-space-md py-1.5 rounded-md transition-all font-label-md text-label-md cursor-pointer border ${
                  copied
                    ? "bg-tertiary-container/30 text-tertiary border-tertiary/30"
                    : "bg-surface-container-lowest text-primary border-[#E8E8E5] hover:bg-primary hover:text-on-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copied ? "check" : "link"}
                </span>
                <span>{copied ? "Link copied!" : "Copy link"}</span>
              </button>
            </div>
          </div>

          {/* Section 3: Collaborators List */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between pb-space-xs border-b border-[#E8E8E5]/60 mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                Active Members ({1 + collaborators.length})
              </span>
              <span className="font-code-sm text-code-sm text-tertiary flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Real-time sync active
              </span>
            </div>

            <div className="flex flex-col divide-y divide-[#E8E8E5]/60">
              {/* Document Owner */}
              <div className="py-2.5 flex items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-md min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center">
                      {getInitials(owner.name || "Owner")}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest"></span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                        {owner.name || "Document Owner"}
                      </span>
                      {isOwner && (
                        <span className="font-label-sm text-label-sm text-outline">
                          (You)
                        </span>
                      )}
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {owner.email || ""}
                    </span>
                  </div>
                </div>

                <span className="font-label-sm text-label-sm bg-surface-container-high text-on-surface px-space-sm py-1 rounded font-medium">
                  Owner
                </span>
              </div>

              {/* Collaborators */}
              {collaborators.map((collaborator) => {
                const cUser = collaborator.user || {};
                const cId = cUser._id || collaborator._id;
                const cName = cUser.name || "Collaborator";
                const cEmail = cUser.email || "";

                return (
                  <div
                    key={cId}
                    className="py-2.5 flex items-center justify-between gap-space-sm hover:bg-surface-container-low/40 rounded px-1 transition-colors"
                  >
                    <div className="flex items-center gap-space-md min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center">
                          {getInitials(cName)}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest"></span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                          {cName}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                          {cEmail}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-space-xs">
                      {isOwner ? (
                        <div className="relative flex items-center">
                          <select
                            value={collaborator.role}
                            onChange={(e) =>
                              handleRoleChange(cUser._id, e.target.value)
                            }
                            className="appearance-none font-label-md text-label-md bg-surface-container-high text-on-surface hover:bg-surface-container-highest pl-3.5 pr-7 py-1 rounded cursor-pointer transition-colors focus:outline-none text-center font-medium leading-none"
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                            <option value="remove" className="text-error font-medium">
                              Remove access
                            </option>
                          </select>
                          <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[16px]">
                            expand_more
                          </span>
                        </div>
                      ) : (
                        <span className="font-label-sm text-label-sm bg-surface-container text-on-surface-variant px-space-sm py-1 rounded capitalize text-center">
                          {collaborator.role}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {collaborators.length === 0 && (
                <div className="py-6 text-center text-on-surface-variant font-body-sm text-body-sm">
                  No other collaborators have been invited yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-surface-bright border-t border-[#E8E8E5]/80 flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            Granular access controls enabled
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface px-space-xl py-1.5 rounded-lg font-label-md text-label-md shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

