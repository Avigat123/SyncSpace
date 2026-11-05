import { useEffect, useState } from "react";
import { getDocumentVersions, restoreVersion } from "../../api/document";

export default function VersionHistory({
  documentId,
  isOpen,
  onClose,
  onVersionRestored,
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [namedOnly, setNamedOnly] = useState(false);

  useEffect(() => {
    if (!isOpen || !documentId) return;

    const fetchVersions = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getDocumentVersions(documentId);
        const list = response.versions || [];
        setVersions(list);
        if (list.length > 0) {
          setSelectedVersion(list[0]);
        }
      } catch (err) {
        setError(err.message || "Failed to load version history");
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleRestore = async (version) => {
    if (!version || restoring) return;

    const confirmed = window.confirm(
      `Are you sure you want to restore the version from ${new Date(
        version.createdAt
      ).toLocaleString()}? This will replace the current draft.`
    );
    if (!confirmed) return;

    setRestoring(true);
    setRestoreMessage("");

    try {
      await restoreVersion(documentId, version._id);
      setRestoreMessage("Version restored successfully!");
      if (onVersionRestored) {
        await onVersionRestored();
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setRestoreMessage(err.message || "Failed to restore version");
    } finally {
      setRestoring(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredVersions = namedOnly
    ? versions.filter((v) => v.title && v.title.trim() !== "")
    : versions;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface animate-in fade-in duration-200">
      {/* Top Inspection Control Bar */}
      <div className="w-full bg-surface-container-high px-4 sm:px-space-lg py-3 shadow-xs flex flex-wrap items-center justify-between gap-space-md z-30 border-b border-[#E8E8E5]">
        <div className="flex items-center gap-space-md min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">history</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                {selectedVersion
                  ? `Viewing snapshot from ${formatTimestamp(
                      selectedVersion.createdAt
                    )}`
                  : "Version History"}
              </span>
              {selectedVersion?.editedBy && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-sm text-label-sm shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  {selectedVersion.editedBy.name || "Collaborator"}
                </span>
              )}
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-outline">
                info
              </span>
              Restoring will replace the current draft. All changes are revisioned.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-space-sm flex-shrink-0">
          {restoreMessage && (
            <span className="font-label-md text-label-md text-tertiary font-medium">
              {restoreMessage}
            </span>
          )}

          {selectedVersion && (
            <button
              type="button"
              onClick={() => handleRestore(selectedVersion)}
              disabled={restoring}
              className="flex items-center gap-space-xs bg-primary hover:bg-primary/90 text-on-primary px-space-md py-1.5 rounded-lg font-label-md text-label-md shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                {restoring ? "refresh" : "restore"}
              </span>
              <span>{restoring ? "Restoring…" : "Restore this version"}</span>
            </button>
          )}

          <div className="h-5 w-px bg-outline-variant mx-1"></div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-space-xs bg-surface-container-lowest hover:bg-surface text-on-surface px-space-md py-1.5 rounded-lg font-label-md text-label-md shadow-xs border border-[#E8E8E5] transition-colors cursor-pointer"
            title="Return to live editor"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
            <span>Done</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Center Preview + Right Timeline Drawer */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Center Version Preview Stage */}
        <div className="flex-1 flex justify-center py-space-xl px-4 overflow-y-auto bg-surface">
          <div className="w-full max-w-[820px] bg-surface-container-lowest border border-[#E8E8E5] shadow-sm rounded-xl p-6 sm:p-12 relative flex flex-col gap-space-lg min-h-[700px]">
            {selectedVersion ? (
              <>
                <div className="flex items-center justify-between pb-space-sm border-b border-[#E8E8E5]">
                  <div className="flex items-center gap-space-sm">
                    <span className="px-2.5 py-1 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm font-medium">
                      SNAPSHOT
                    </span>
                    <span className="font-label-sm text-label-sm text-outline">
                      {formatTimestamp(selectedVersion.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-tertiary">
                    <span className="material-symbols-outlined text-[16px]">
                      check_circle
                    </span>
                    <span>Snapshot verified</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">
                    {selectedVersion.title || "Untitled Document"}
                  </h1>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Saved by {selectedVersion.editedBy?.name || "Collaborator"}
                  </p>
                </div>

                {/* Content preview */}
                <div className="pt-space-md text-on-surface font-body-lg text-body-lg leading-relaxed whitespace-pre-wrap">
                  {selectedVersion.content ? (
                    typeof selectedVersion.content === "string" ? (
                      selectedVersion.content
                    ) : (
                      JSON.stringify(selectedVersion.content, null, 2)
                    )
                  ) : (
                    <p className="italic text-outline">
                      Binary CRDT snapshot captured at this revision point.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <span className="material-symbols-outlined text-[40px] text-outline mb-2">
                  history_toggle_drop_down
                </span>
                <p className="font-headline-sm text-headline-sm text-on-surface mb-1">
                  Select a version to inspect
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Browse previous snapshots from the timeline on the right.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Drawer: Version History Timeline */}
        <aside className="w-full lg:w-96 flex-shrink-0 bg-surface-container-low border-t lg:border-t-0 lg:border-l border-[#E8E8E5] flex flex-col justify-between shadow-lg z-20 h-auto lg:h-full max-h-[45vh] lg:max-h-full">
          {/* Drawer Header */}
          <div className="p-space-md sm:p-space-lg pb-space-sm flex flex-col gap-space-sm border-b border-[#E8E8E5]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px] text-primary">
                  schedule
                </span>
                <span className="font-headline-md text-headline-md text-on-surface">
                  Timeline
                </span>
              </div>
              <span className="font-code-sm text-code-sm bg-surface-container px-2 py-0.5 rounded text-outline">
                {filteredVersions.length} total
              </span>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-space-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={namedOnly}
                  onChange={(e) => setNamedOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-0 cursor-pointer accent-primary"
                />
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Named versions only
                </span>
              </label>
            </div>
          </div>

          {/* Timeline List */}
          <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-sm">
            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Loading snapshots…
                </span>
              </div>
            ) : error ? (
              <div className="p-3 bg-error-container text-on-error-container rounded-lg text-body-sm">
                {error}
              </div>
            ) : filteredVersions.length === 0 ? (
              <div className="py-8 text-center text-on-surface-variant font-body-sm text-body-sm">
                No previous snapshots found for this document yet. Snapshots are
                generated as edits progress.
              </div>
            ) : (
              filteredVersions.map((version, index) => {
                const isSelected = selectedVersion?._id === version._id;
                const authorName = version.editedBy?.name || "Collaborator";

                return (
                  <div
                    key={version._id}
                    onClick={() => setSelectedVersion(version)}
                    className={`relative rounded-xl p-space-md bg-surface-container-lowest border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 shadow-sm"
                        : "border-[#E8E8E5] hover:border-primary/40 hover:bg-surface-bright"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-space-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                            index === 0
                              ? "bg-tertiary-container/30 text-tertiary"
                              : "bg-surface-container text-on-surface-variant"
                          }`}
                        >
                          {index === 0 ? "Latest Snapshot" : `Version ${filteredVersions.length - index}`}
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-outline">
                        {formatTimestamp(version.createdAt)}
                      </span>
                    </div>

                    <div className="font-headline-sm text-headline-sm text-on-surface pt-space-xs truncate">
                      {version.title || `Snapshot ${index + 1}`}
                    </div>

                    <div className="flex items-center justify-between pt-space-sm mt-space-xs border-t border-[#E8E8E5]/60">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary text-[10px] font-bold flex items-center justify-center">
                          {getInitials(authorName)}
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                          {authorName}
                        </span>
                      </div>

                      {isSelected && (
                        <span className="text-primary font-label-sm text-label-sm font-semibold">
                          Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

