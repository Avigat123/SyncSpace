import { useEffect, useState, useMemo, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import {
  Subscript,
  Superscript,
  TextStyle,
  TextAlign,
} from "../../collaboration/formattingExtensions";
import {
  getDocumentVersions,
  restoreVersion,
  createDocumentVersion,
} from "../../api/document";
import { getInitials } from "../../utils/helpers";

function VersionPreviewContent({ version }) {
  const { ydoc, hasYjs } = useMemo(() => {
    const doc = new Y.Doc();
    let has = false;

    if (version?.yjsState) {
      let bytes = null;
      if (version.yjsState instanceof Uint8Array) {
        bytes = version.yjsState;
      } else if (
        version.yjsState?.data &&
        Array.isArray(version.yjsState.data)
      ) {
        bytes = new Uint8Array(version.yjsState.data);
      } else if (Array.isArray(version.yjsState)) {
        bytes = new Uint8Array(version.yjsState);
      }

      if (bytes && bytes.length > 0) {
        try {
          Y.applyUpdate(doc, bytes);
          has = true;
        } catch (e) {
          console.error("Failed to decode Yjs state for preview:", e);
        }
      }
    }

    return { ydoc: doc, hasYjs: has };
  }, [version?.yjsState]);

  useEffect(() => {
    return () => {
      ydoc.destroy();
    };
  }, [ydoc]);

  const extensions = useMemo(() => {
    return [
      StarterKit.configure({
        undoRedo: false,
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Subscript,
      Superscript,
      TextStyle,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      ...(hasYjs ? [Collaboration.configure({ document: ydoc })] : []),
    ];
  }, [hasYjs, ydoc]);

  const editor = useEditor(
    {
      editable: false,
      extensions,
      content: !hasYjs && version?.content ? version.content : undefined,
    },
    [version?._id, hasYjs, ydoc]
  );

  if (!hasYjs && !version?.content) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center p-8 text-on-surface-variant font-body-sm italic">
        <span className="material-symbols-outlined text-[36px] text-outline mb-2">
          hourglass_empty
        </span>
        <p>Binary CRDT snapshot captured at this revision point.</p>
        <p className="text-xs text-outline mt-1">
          No readable preview content available for this historical snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="prose prose-slate max-w-none focus:outline-none min-h-[300px] text-on-surface font-body-lg text-body-lg leading-relaxed">
      <EditorContent editor={editor} />
    </div>
  );
}

export default function VersionHistory({
  documentId,
  isOpen,
  onClose,
  onVersionRestored,
  canEdit = true,
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info"); // 'info' | 'success' | 'error'
  const [namedOnly, setNamedOnly] = useState(false);

  // Modal state for manual version creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [versionNameInput, setVersionNameInput] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchVersions = useCallback(async () => {
    if (!documentId) return;
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
  }, [documentId]);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    let isMounted = true;

    const loadVersions = async () => {
      try {
        const response = await getDocumentVersions(documentId);
        if (isMounted) {
          const list = response.versions || [];
          setVersions(list);
          if (list.length > 0) {
            setSelectedVersion(list[0]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load version history");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadVersions();

    return () => {
      isMounted = false;
    };
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleCreateVersion = async (e) => {
    e?.preventDefault();
    if (creatingVersion) return;

    setCreatingVersion(true);
    setCreateError("");

    try {
      const title = versionNameInput.trim() || undefined;
      const response = await createDocumentVersion(documentId, title);

      setStatusType("success");
      setStatusMessage("Snapshot saved successfully!");
      setShowCreateModal(false);
      setVersionNameInput("");

      // Refresh version list and auto-select newly created snapshot
      await fetchVersions();

      if (response?.version) {
        setSelectedVersion(response.version);
      }

      setTimeout(() => {
        setStatusMessage("");
      }, 3500);
    } catch (err) {
      setCreateError(err.message || "Failed to create version snapshot");
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleRestore = async (version) => {
    if (!version || restoring) return;

    const confirmed = window.confirm(
      `Are you sure you want to restore the version from ${new Date(
        version.createdAt
      ).toLocaleString()}? This will replace the current draft.`
    );
    if (!confirmed) return;

    setRestoring(true);
    setStatusMessage("");

    try {
      await restoreVersion(documentId, version._id);
      setStatusType("success");
      setStatusMessage("Version restored successfully!");
      if (onVersionRestored) {
        await onVersionRestored();
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setStatusType("error");
      setStatusMessage(err.message || "Failed to restore version");
    } finally {
      setRestoring(false);
    }
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
            <span className="material-symbols-outlined text-[20px]">
              history
            </span>
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
          {statusMessage && (
            <span
              className={`font-label-md text-label-md font-medium ${
                statusType === "error"
                  ? "text-error"
                  : statusType === "success"
                  ? "text-tertiary"
                  : "text-on-surface-variant"
              }`}
            >
              {statusMessage}
            </span>
          )}

          {/* Manual Snapshot Save Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setCreateError("");
                setShowCreateModal(true);
              }}
              className="flex items-center gap-space-xs bg-surface-container-lowest hover:bg-surface text-on-surface px-space-md py-1.5 rounded-lg font-label-md text-label-md shadow-xs border border-[#E8E8E5] transition-colors cursor-pointer"
              title="Save a named revision checkpoint"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">
                bookmark_add
              </span>
              <span>Save Version</span>
            </button>
          )}

          {selectedVersion && canEdit && (
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

                {/* Rich Read-Only TipTap CRDT Preview */}
                <div className="pt-space-md">
                  <VersionPreviewContent
                    key={selectedVersion._id}
                    version={selectedVersion}
                  />
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
                          {index === 0
                            ? "Latest Snapshot"
                            : `Version ${filteredVersions.length - index}`}
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

      {/* Create Version Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest border border-[#E8E8E5] rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  bookmark_add
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Save Version Snapshot
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setVersionNameInput("");
                  setCreateError("");
                }}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Create a revision checkpoint of the current document across all active collaborators.
            </p>

            <form onSubmit={handleCreateVersion} className="space-y-4">
              <div>
                <label
                  htmlFor="snapshot-name"
                  className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5"
                >
                  Snapshot Name (Optional)
                </label>
                <input
                  id="snapshot-name"
                  type="text"
                  value={versionNameInput}
                  onChange={(e) => setVersionNameInput(e.target.value)}
                  placeholder="e.g. Design review v1, Sprint 4 notes"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E8E5] bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {createError && (
                <div className="p-2.5 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setVersionNameInput("");
                    setCreateError("");
                  }}
                  className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingVersion}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-label-md text-label-md bg-primary hover:bg-primary/90 text-on-primary shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {creatingVersion ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Create Snapshot</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
