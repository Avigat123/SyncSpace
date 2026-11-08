import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
import {
  extractBlocksFromVersion,
  computeStructuredDiff,
} from "../../utils/diffUtils";

/* ==========================================================================
   Formatters and Helpers
   ========================================================================== */

function formatTimestamp(dateString) {
  if (!dateString) return "Live / Editing now";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Live / Editing now";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDate(dateString) {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Just now";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* ==========================================================================
   Rich Diff Renderers (Inline and Block)
   ========================================================================== */

function DiffToken({ token }) {
  const marks = token.marks || {};
  let content = token.text;

  let classes = "";
  if (marks.bold) classes += " font-bold";
  if (marks.italic) classes += " italic";
  if (marks.underline) classes += " underline";
  if (marks.code) classes += " font-mono bg-surface-container px-1 py-0.5 rounded text-[0.875em]";
  if (marks.subscript) classes += " text-[0.75em] align-sub";
  if (marks.superscript) classes += " text-[0.75em] align-super";

  if (token.type === "insert") {
    return (
      <ins
        className={`bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300 no-underline font-medium px-0.5 rounded transition-colors ${classes}`}
        title="Added in comparison target"
      >
        {content}
      </ins>
    );
  }

  if (token.type === "delete") {
    return (
      <del
        className={`bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 line-through px-0.5 rounded opacity-80 transition-colors ${classes}`}
        title="Deleted from base version"
      >
        {content}
      </del>
    );
  }

  if (marks.strike) {
    return <span className={`line-through ${classes}`}>{content}</span>;
  }

  if (marks.link) {
    return (
      <a
        href={marks.link}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-primary hover:underline ${classes}`}
      >
        {content}
      </a>
    );
  }

  return <span className={classes}>{content}</span>;
}

function DiffBlockItem({ block }) {
  const { type, level, order, status, tokens = [] } = block;

  let statusContainerClass = "";
  if (status === "added") {
    statusContainerClass = "bg-emerald-50/50 border-l-4 border-emerald-500 pl-3 py-1 my-1.5 rounded-r";
  } else if (status === "deleted") {
    statusContainerClass = "bg-rose-50/50 border-l-4 border-rose-400 pl-3 py-1 my-1.5 rounded-r opacity-90";
  } else if (status === "modified") {
    statusContainerClass = "border-l-4 border-amber-400/80 bg-amber-50/20 pl-3 py-1 my-1.5 rounded-r";
  }

  const renderedTokens = tokens.map((token, idx) => (
    <DiffToken key={idx} token={token} />
  ));

  if (type === "heading") {
    const HeadingTag = `h${Math.min(Math.max(level || 1, 1), 6)}`;
    const headingSizeClasses = {
      1: "text-2xl sm:text-3xl font-bold tracking-tight mb-3 mt-4 text-on-surface",
      2: "text-xl sm:text-2xl font-bold tracking-tight mb-2.5 mt-3 text-on-surface",
      3: "text-lg sm:text-xl font-semibold mb-2 mt-2.5 text-on-surface",
      4: "text-base sm:text-lg font-semibold mb-1.5 mt-2 text-on-surface",
      5: "text-sm sm:text-base font-semibold mb-1 mt-1.5 text-on-surface",
      6: "text-xs sm:text-sm font-semibold mb-1 mt-1 text-on-surface",
    }[level || 1];

    return (
      <div className={statusContainerClass}>
        <HeadingTag className={headingSizeClasses}>{renderedTokens}</HeadingTag>
      </div>
    );
  }

  if (type === "bulletListItem") {
    return (
      <div className={`${statusContainerClass} flex items-start gap-2.5 my-1 text-on-surface leading-relaxed`}>
        <span className="text-primary font-bold select-none">•</span>
        <div className="flex-1 min-w-0">{renderedTokens}</div>
      </div>
    );
  }

  if (type === "orderedListItem") {
    return (
      <div className={`${statusContainerClass} flex items-start gap-2 my-1 text-on-surface leading-relaxed`}>
        <span className="text-on-surface-variant font-mono text-sm font-semibold select-none w-5 text-right flex-shrink-0">
          {order || 1}.
        </span>
        <div className="flex-1 min-w-0">{renderedTokens}</div>
      </div>
    );
  }

  if (type === "blockquote") {
    return (
      <div className={statusContainerClass}>
        <blockquote className="border-l-4 border-outline-variant pl-4 py-1 italic my-2 text-on-surface-variant leading-relaxed">
          {renderedTokens}
        </blockquote>
      </div>
    );
  }

  if (type === "codeBlock") {
    return (
      <div className={statusContainerClass}>
        <pre className="bg-surface-container font-mono text-xs sm:text-sm p-3.5 rounded-lg my-2 overflow-x-auto border border-[#E8E8E5] text-on-surface leading-normal">
          <code>{renderedTokens}</code>
        </pre>
      </div>
    );
  }

  if (type === "horizontalRule") {
    return <hr className="my-4 border-t border-[#E8E8E5]" />;
  }

  // Default: paragraph
  return (
    <div className={statusContainerClass}>
      <p className="font-body-lg text-body-lg leading-relaxed mb-2.5 text-on-surface">
        {renderedTokens}
      </p>
    </div>
  );
}

/* ==========================================================================
   Side-by-Side Panel Renderer
   ========================================================================== */

function SideBySideView({ alignedRows = [], leftScrollRef, rightScrollRef, onLeftScroll, onRightScroll }) {
  if (alignedRows.length === 0) {
    return (
      <div className="py-20 text-center text-on-surface-variant font-body-sm">
        Both versions are identical. No differences found.
      </div>
    );
  }

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-hidden p-4">
      {/* Left Panel: Base Version */}
      <div className="flex flex-col h-full bg-surface-container-lowest border border-[#E8E8E5] rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-container-high border-b border-[#E8E8E5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              Base (Original)
            </span>
          </div>
          <span className="font-code-sm text-code-sm text-outline">
            Showing deletions & modifications
          </span>
        </div>
        <div
          ref={leftScrollRef}
          onScroll={onLeftScroll}
          className="flex-1 overflow-y-auto p-6 space-y-3"
        >
          {alignedRows.map((row, idx) => {
            if (row.status === "added") {
              // Target has an addition, so Base is empty placeholder
              return (
                <div
                  key={`left-spacer-${idx}`}
                  className="h-10 bg-surface-container-low/40 rounded border border-dashed border-[#E8E8E5] flex items-center justify-center text-xs text-outline italic"
                >
                  Block added in target
                </div>
              );
            }

            if (row.status === "deleted") {
              const tokens = row.tokens || [];
              return (
                <DiffBlockItem
                  key={`left-del-${idx}`}
                  block={{
                    ...row.baseBlock,
                    status: "deleted",
                    tokens,
                  }}
                />
              );
            }

            if (row.status === "modified") {
              // In Base view of modified block: show base tokens with deleted tokens highlighted
              const baseTokens = (row.tokens || []).filter((t) => t.type !== "insert");
              return (
                <DiffBlockItem
                  key={`left-mod-${idx}`}
                  block={{
                    ...row.baseBlock,
                    status: "modified",
                    tokens: baseTokens,
                  }}
                />
              );
            }

            // Unchanged
            return (
              <DiffBlockItem
                key={`left-eq-${idx}`}
                block={{
                  ...row.baseBlock,
                  status: "unchanged",
                  tokens: row.tokens,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Right Panel: Target Version */}
      <div className="flex flex-col h-full bg-surface-container-lowest border border-[#E8E8E5] rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-container-high border-b border-[#E8E8E5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              Comparison Target (Revised)
            </span>
          </div>
          <span className="font-code-sm text-code-sm text-outline">
            Showing additions & modifications
          </span>
        </div>
        <div
          ref={rightScrollRef}
          onScroll={onRightScroll}
          className="flex-1 overflow-y-auto p-6 space-y-3"
        >
          {alignedRows.map((row, idx) => {
            if (row.status === "deleted") {
              // Base had a deletion, so Target is empty placeholder
              return (
                <div
                  key={`right-spacer-${idx}`}
                  className="h-10 bg-surface-container-low/40 rounded border border-dashed border-[#E8E8E5] flex items-center justify-center text-xs text-outline italic"
                >
                  Block deleted from base
                </div>
              );
            }

            if (row.status === "added") {
              const tokens = row.tokens || [];
              return (
                <DiffBlockItem
                  key={`right-add-${idx}`}
                  block={{
                    ...row.targetBlock,
                    status: "added",
                    tokens,
                  }}
                />
              );
            }

            if (row.status === "modified") {
              // In Target view of modified block: show target tokens with added tokens highlighted
              const targetTokens = (row.tokens || []).filter((t) => t.type !== "delete");
              return (
                <DiffBlockItem
                  key={`right-mod-${idx}`}
                  block={{
                    ...row.targetBlock,
                    status: "modified",
                    tokens: targetTokens,
                  }}
                />
              );
            }

            // Unchanged
            return (
              <DiffBlockItem
                key={`right-eq-${idx}`}
                block={{
                  ...row.targetBlock,
                  status: "unchanged",
                  tokens: row.tokens,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Single Version Read-Only Preview (TipTap CRDT)
   ========================================================================== */

function SingleVersionPreview({ version, currentYDoc }) {
  const isLive = Boolean(version?.isLive);

  const { ydoc, hasYjs } = useMemo(() => {
    if (isLive && currentYDoc) {
      return { ydoc: currentYDoc, hasYjs: true };
    }

    const doc = new Y.Doc();
    let has = false;

    if (version?.yjsState) {
      let bytes = null;
      if (version.yjsState instanceof Uint8Array) {
        bytes = version.yjsState;
      } else if (version.yjsState?.data && Array.isArray(version.yjsState.data)) {
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
  }, [version, isLive, currentYDoc]);

  useEffect(() => {
    return () => {
      if (!isLive && ydoc) {
        ydoc.destroy();
      }
    };
  }, [ydoc, isLive]);

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

/* ==========================================================================
   Main VersionHistory Component
   ========================================================================== */

export default function VersionHistory({
  documentId,
  isOpen,
  onClose,
  onVersionRestored,
  canEdit = true,
  currentYDoc = null,
  currentTitle = "",
}) {
  const [savedVersions, setSavedVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Live draft update trigger state
  const [liveUpdateTick, setLiveUpdateTick] = useState(0);

  // Single view selection
  const [selectedVersion, setSelectedVersion] = useState(null);

  // Compare mode state
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareModeType, setCompareModeType] = useState("inline"); // "inline" | "side-by-side"
  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Restore state & confirmation dialog
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Toast / status
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info");

  // Filter
  const [namedOnly, setNamedOnly] = useState(false);

  // Create Snapshot Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [versionNameInput, setVersionNameInput] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [createError, setCreateError] = useState("");

  // Synchronized scroll refs
  const leftScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const isSyncingScrollRef = useRef(false);

  // 1. Listen for real-time live updates on currentYDoc
  useEffect(() => {
    if (!currentYDoc) return;

    const handleYDocUpdate = () => {
      setLiveUpdateTick((t) => t + 1);
    };

    currentYDoc.on("update", handleYDocUpdate);
    return () => {
      currentYDoc.off("update", handleYDocUpdate);
    };
  }, [currentYDoc]);

  // 2. Fetch saved versions from server
  const fetchVersions = useCallback(async () => {
    if (!documentId) return;
    try {
      setLoading(true);
      setError("");
      const response = await getDocumentVersions(documentId);
      const list = response.versions || [];
      setSavedVersions(list);
    } catch (err) {
      setError(err.message || "Failed to load version history");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    fetchVersions();
  }, [isOpen, documentId, fetchVersions]);

  // 3. Construct unified timeline with Current Draft ALWAYS as first entry
  const liveDraftEntry = useMemo(() => {
    return {
      _id: "live-draft",
      isLive: true,
      title: currentTitle || "Untitled Document",
      createdAt: null,
      editedBy: { name: "Current Collaborators" },
      updateTick: liveUpdateTick,
    };
  }, [currentTitle, liveUpdateTick]);

  const timelineEntries = useMemo(() => {
    const historical = namedOnly
      ? savedVersions.filter((v) => v.title && v.title.trim() !== "")
      : savedVersions;

    return [liveDraftEntry, ...historical];
  }, [liveDraftEntry, savedVersions, namedOnly]);

  // 4. Default selections on initial load
  useEffect(() => {
    if (!selectedVersion && timelineEntries.length > 0) {
      setSelectedVersion(timelineEntries[0]); // Default inspect Current Draft
    }
    if (!selectedTarget && timelineEntries.length > 0) {
      setSelectedTarget(timelineEntries[0]); // Default Target: Current Draft
    }
    if (!selectedBase && timelineEntries.length > 1) {
      setSelectedBase(timelineEntries[1]); // Default Base: Latest saved snapshot
    }
  }, [timelineEntries, selectedVersion, selectedTarget, selectedBase]);

  // 5. Compute structured diff when comparison is active
  const diffResult = useMemo(() => {
    if (!isCompareMode || !selectedBase || !selectedTarget) {
      return null;
    }

    if (selectedBase._id === selectedTarget._id) {
      return {
        diffBlocks: [],
        alignedRows: [],
        summary: { additions: 0, deletions: 0, modifications: 0, totalBlocksA: 0, totalBlocksB: 0 },
      };
    }

    const blocksA = extractBlocksFromVersion(selectedBase, currentYDoc);
    const blocksB = extractBlocksFromVersion(selectedTarget, currentYDoc);

    return computeStructuredDiff(blocksA, blocksB);
  }, [isCompareMode, selectedBase, selectedTarget, currentYDoc, liveUpdateTick]);

  // Synchronized scroll handlers
  const handleLeftScroll = useCallback(() => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, []);

  const handleRightScroll = useCallback(() => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, []);

  // Comparison controls
  const handleSwapVersions = () => {
    const temp = selectedBase;
    setSelectedBase(selectedTarget);
    setSelectedTarget(temp);
  };

  const handleClearComparison = () => {
    setIsCompareMode(false);
  };

  const handleSelectTimelineEntry = (entry) => {
    if (isCompareMode) {
      // In compare mode: if entry is already base or target, do nothing
      if (selectedTarget?._id === entry._id) {
        return;
      }
      if (selectedBase?._id === entry._id) {
        return;
      }
      // Replace base by default or user can swap
      setSelectedBase(entry);
    } else {
      setSelectedVersion(entry);
    }
  };

  // Create Version Snapshot
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
        if (isCompareMode) {
          setSelectedBase(response.version);
        }
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

  // Restore Version Confirmation Trigger
  const promptRestore = (version) => {
    if (!version || version.isLive || restoring) return;
    setVersionToRestore(version);
    setShowRestoreModal(true);
  };

  // Confirm Restore
  const handleConfirmRestore = async () => {
    if (!versionToRestore || versionToRestore.isLive || restoring) return;

    setRestoring(true);
    setStatusMessage("");

    try {
      await restoreVersion(documentId, versionToRestore._id);
      setStatusType("success");
      setStatusMessage("Version restored successfully!");
      setShowRestoreModal(false);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface animate-in fade-in duration-200">
      {/* Top Inspection & Comparison Control Bar */}
      <header className="w-full bg-surface-container-high px-4 sm:px-space-lg py-3 shadow-xs flex flex-wrap items-center justify-between gap-space-md z-30 border-b border-[#E8E8E5]">
        <div className="flex items-center gap-space-md min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">
              {isCompareMode ? "compare" : "history"}
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                {isCompareMode ? "Version Comparison" : "Version History"}
              </span>

              {isCompareMode ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  Comparing 2 Revisions
                </span>
              ) : selectedVersion?.isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-label-sm text-label-sm font-semibold shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Current Draft (Live)
                </span>
              ) : selectedVersion ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-sm text-label-sm shadow-xs border border-[#E8E8E5]">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Snapshot: {formatTimestamp(selectedVersion.createdAt)}
                </span>
              ) : null}
            </div>

            <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-outline">
                info
              </span>
              {isCompareMode
                ? "Compare changes between any two document milestones or live edits."
                : "Select snapshots to inspect previous states or restore historical versions."}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-space-sm flex-wrap flex-shrink-0">
          {statusMessage && (
            <span
              className={`font-label-md text-label-md font-medium px-2 py-1 rounded ${
                statusType === "error"
                  ? "bg-error-container text-on-error-container"
                  : statusType === "success"
                  ? "bg-tertiary-container/40 text-tertiary"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {statusMessage}
            </span>
          )}

          {/* Mode Toggle: Compare vs Single View */}
          <button
            type="button"
            onClick={() => {
              if (!isCompareMode) {
                setIsCompareMode(true);
                if (!selectedTarget && timelineEntries.length > 0) {
                  setSelectedTarget(timelineEntries[0]);
                }
                if (!selectedBase && timelineEntries.length > 1) {
                  setSelectedBase(timelineEntries[1]);
                }
              } else {
                setIsCompareMode(false);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-md text-label-md border transition-all cursor-pointer ${
              isCompareMode
                ? "bg-primary text-on-primary border-primary shadow-xs"
                : "bg-surface-container-lowest hover:bg-surface text-on-surface border-[#E8E8E5] shadow-xs"
            }`}
            title={isCompareMode ? "Exit comparison mode" : "Compare two versions"}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isCompareMode ? "view_agenda" : "compare_arrows"}
            </span>
            <span>{isCompareMode ? "Comparing" : "Compare"}</span>
          </button>

          {/* Manual Snapshot Save Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setCreateError("");
                setShowCreateModal(true);
              }}
              className="flex items-center gap-space-xs bg-surface-container-lowest hover:bg-surface text-on-surface px-3 py-1.5 rounded-lg font-label-md text-label-md shadow-xs border border-[#E8E8E5] transition-colors cursor-pointer"
              title="Save a named revision checkpoint"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">
                bookmark_add
              </span>
              <span className="hidden sm:inline">Save Version</span>
            </button>
          )}

          {/* Restore Button (Only for historical saved versions, NEVER Current Draft) */}
          {!isCompareMode && selectedVersion && !selectedVersion.isLive && canEdit && (
            <button
              type="button"
              onClick={() => promptRestore(selectedVersion)}
              disabled={restoring}
              className="flex items-center gap-space-xs bg-primary hover:bg-primary/90 text-on-primary px-3 py-1.5 rounded-lg font-label-md text-label-md shadow-sm transition-all cursor-pointer disabled:opacity-60"
              title="Restore this saved version to active draft"
            >
              <span className="material-symbols-outlined text-[18px]">
                restore
              </span>
              <span>Restore this version</span>
            </button>
          )}

          {/* Close / Return Button */}
          <div className="h-5 w-px bg-outline-variant mx-1"></div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-space-xs bg-surface-container-lowest hover:bg-surface text-on-surface px-3 py-1.5 rounded-lg font-label-md text-label-md shadow-xs border border-[#E8E8E5] transition-colors cursor-pointer"
            title="Return to live editor"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
            <span>Done</span>
          </button>
        </div>
      </header>

      {/* Comparison Tool Bar (Visible in Comparison Mode) */}
      {isCompareMode && (
        <div className="w-full bg-surface-container-low px-4 sm:px-space-lg py-2.5 border-b border-[#E8E8E5] flex flex-wrap items-center justify-between gap-3 shadow-xs">
          {/* Base vs Target Selectors & Swap */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Base Selector */}
            <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1.5 rounded-lg border border-[#E8E8E5] shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Base:
              </span>
              <select
                value={selectedBase?._id || ""}
                onChange={(e) => {
                  const found = timelineEntries.find((v) => v._id === e.target.value);
                  if (found) setSelectedBase(found);
                }}
                className="bg-transparent text-on-surface font-label-sm text-label-sm font-semibold focus:outline-none cursor-pointer pr-1"
              >
                {timelineEntries.map((v) => (
                  <option
                    key={`base-${v._id}`}
                    value={v._id}
                    disabled={selectedTarget?._id === v._id}
                  >
                    {v.isLive
                      ? "● Current Draft (Live)"
                      : `${v.title || "Snapshot"} (${formatTimestamp(v.createdAt)})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              type="button"
              onClick={handleSwapVersions}
              className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer border border-[#E8E8E5]"
              title="Swap Base and Comparison Target"
            >
              <span className="material-symbols-outlined text-[18px]">
                swap_horiz
              </span>
            </button>

            {/* Target Selector */}
            <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1.5 rounded-lg border border-[#E8E8E5] shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Target:
              </span>
              <select
                value={selectedTarget?._id || ""}
                onChange={(e) => {
                  const found = timelineEntries.find((v) => v._id === e.target.value);
                  if (found) setSelectedTarget(found);
                }}
                className="bg-transparent text-on-surface font-label-sm text-label-sm font-semibold focus:outline-none cursor-pointer pr-1"
              >
                {timelineEntries.map((v) => (
                  <option
                    key={`target-${v._id}`}
                    value={v._id}
                    disabled={selectedBase?._id === v._id}
                  >
                    {v.isLive
                      ? "● Current Draft (Live)"
                      : `${v.title || "Snapshot"} (${formatTimestamp(v.createdAt)})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Restore Target Button if it's a historical snapshot */}
            {selectedTarget && !selectedTarget.isLive && canEdit && (
              <button
                type="button"
                onClick={() => promptRestore(selectedTarget)}
                disabled={restoring}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-label-sm text-label-sm shadow-xs transition-colors cursor-pointer"
                title="Restore this target revision"
              >
                <span className="material-symbols-outlined text-[16px]">
                  restore
                </span>
                <span>Restore Target</span>
              </button>
            )}
          </div>

          {/* Diff Summary Bar & View Mode Toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Diff Summary Stats */}
            {diffResult?.summary && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-container-lowest border border-[#E8E8E5] shadow-xs font-label-sm text-label-sm">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  +{diffResult.summary.additions} additions
                </span>
                <span className="text-outline">•</span>
                <span className="font-medium text-rose-700 dark:text-rose-400">
                  -{diffResult.summary.deletions} deletions
                </span>
                <span className="text-outline">•</span>
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  ~{diffResult.summary.modifications} modified
                </span>
              </div>
            )}

            {/* View Mode Toggle: Inline Diff vs Side-by-Side */}
            <div className="flex items-center bg-surface-container-lowest p-0.5 rounded-lg border border-[#E8E8E5] shadow-xs">
              <button
                type="button"
                onClick={() => setCompareModeType("inline")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-label-sm text-label-sm transition-all cursor-pointer ${
                  compareModeType === "inline"
                    ? "bg-primary text-on-primary font-medium shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  view_stream
                </span>
                <span>Inline Diff</span>
              </button>

              <button
                type="button"
                onClick={() => setCompareModeType("side-by-side")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-label-sm text-label-sm transition-all cursor-pointer ${
                  compareModeType === "side-by-side"
                    ? "bg-primary text-on-primary font-medium shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  view_column
                </span>
                <span>Side-by-Side</span>
              </button>
            </div>

            {/* Clear Comparison */}
            <button
              type="button"
              onClick={handleClearComparison}
              className="p-1 rounded-lg text-outline hover:text-on-surface transition-colors cursor-pointer"
              title="Clear Comparison"
            >
              <span className="material-symbols-outlined text-[20px]">
                close
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Main Split Layout: Center Preview / Diff Stage + Right Timeline Drawer */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Center Stage */}
        <div className="flex-1 flex justify-center py-space-md sm:py-space-xl px-2 sm:px-4 overflow-y-auto bg-surface">
          {isCompareMode ? (
            /* Comparison Modes */
            compareModeType === "side-by-side" ? (
              <div className="w-full max-w-[1400px] h-full flex flex-col">
                <SideBySideView
                  alignedRows={diffResult?.alignedRows || []}
                  leftScrollRef={leftScrollRef}
                  rightScrollRef={rightScrollRef}
                  onLeftScroll={handleLeftScroll}
                  onRightScroll={handleRightScroll}
                />
              </div>
            ) : (
              /* Inline Diff Mode */
              <div className="w-full max-w-[880px] bg-surface-container-lowest border border-[#E8E8E5] shadow-sm rounded-xl p-6 sm:p-12 relative flex flex-col gap-space-lg min-h-[700px]">
                {/* Inline Diff Header */}
                <div className="flex items-center justify-between pb-space-sm border-b border-[#E8E8E5]">
                  <div className="flex items-center gap-space-sm">
                    <span className="px-2.5 py-1 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm font-medium">
                      INLINE STRUCTURED DIFF
                    </span>
                    <span className="font-label-sm text-label-sm text-outline">
                      {selectedBase?.isLive ? "Live Draft" : formatTimestamp(selectedBase?.createdAt)}
                      {" → "}
                      {selectedTarget?.isLive ? "Live Draft" : formatTimestamp(selectedTarget?.createdAt)}
                    </span>
                  </div>
                  {diffResult?.summary && (
                    <div className="flex items-center gap-2 font-label-sm text-label-sm">
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        +{diffResult.summary.additions}
                      </span>
                      <span className="text-rose-700 dark:text-rose-400 font-semibold">
                        -{diffResult.summary.deletions}
                      </span>
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">
                        ~{diffResult.summary.modifications}
                      </span>
                    </div>
                  )}
                </div>

                {/* Diff Content Blocks */}
                {selectedBase?._id === selectedTarget?._id ? (
                  <div className="py-20 text-center text-on-surface-variant font-body-sm">
                    Base and Comparison Target are the same revision. Select different versions to see changes.
                  </div>
                ) : diffResult?.diffBlocks && diffResult.diffBlocks.length > 0 ? (
                  <div className="space-y-2">
                    {diffResult.diffBlocks.map((block) => (
                      <DiffBlockItem key={block.id} block={block} />
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center text-on-surface-variant font-body-sm">
                    No differences found between selected versions.
                  </div>
                )}
              </div>
            )
          ) : (
            /* Single Version Inspection Mode */
            <div className="w-full max-w-[880px] bg-surface-container-lowest border border-[#E8E8E5] shadow-sm rounded-xl p-6 sm:p-12 relative flex flex-col gap-space-lg min-h-[700px]">
              {selectedVersion ? (
                <>
                  <div className="flex items-center justify-between pb-space-sm border-b border-[#E8E8E5]">
                    <div className="flex items-center gap-space-sm">
                      {selectedVersion.isLive ? (
                        <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-code-sm text-code-sm font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          LIVE DRAFT
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm font-medium">
                          SNAPSHOT
                        </span>
                      )}
                      <span className="font-label-sm text-label-sm text-outline">
                        {formatFullDate(selectedVersion.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-tertiary">
                      <span className="material-symbols-outlined text-[16px]">
                        check_circle
                      </span>
                      <span>
                        {selectedVersion.isLive ? "Live synchronized" : "Snapshot verified"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">
                      {selectedVersion.title || "Untitled Document"}
                    </h1>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {selectedVersion.isLive
                        ? "Current active document with live collaborator edits."
                        : `Saved by ${selectedVersion.editedBy?.name || "Collaborator"}`}
                    </p>
                  </div>

                  {/* Rich TipTap CRDT Preview */}
                  <div className="pt-space-md">
                    <SingleVersionPreview
                      key={selectedVersion._id}
                      version={selectedVersion}
                      currentYDoc={currentYDoc}
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
          )}
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
                {timelineEntries.length} total
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
            ) : (
              timelineEntries.map((version, index) => {
                const isLive = Boolean(version.isLive);
                const isSelected = !isCompareMode && selectedVersion?._id === version._id;
                const isBase = isCompareMode && selectedBase?._id === version._id;
                const isTarget = isCompareMode && selectedTarget?._id === version._id;

                const authorName = isLive
                  ? "Live Collaborators"
                  : version.editedBy?.name || "Collaborator";

                return (
                  <div
                    key={version._id}
                    onClick={() => handleSelectTimelineEntry(version)}
                    className={`relative rounded-xl p-space-md bg-surface-container-lowest border transition-all cursor-pointer ${
                      isTarget
                        ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                        : isBase
                        ? "border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                        : isSelected
                        ? "border-primary ring-2 ring-primary/20 shadow-sm"
                        : "border-[#E8E8E5] hover:border-primary/40 hover:bg-surface-bright"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-space-sm">
                      <div className="flex items-center gap-2">
                        {isLive ? (
                          <span className="px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Draft
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                              index === 1
                                ? "bg-tertiary-container/30 text-tertiary"
                                : "bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            {version.title && version.title.trim() !== ""
                              ? "Named"
                              : `Version ${timelineEntries.length - index}`}
                          </span>
                        )}
                      </div>

                      <span className="font-label-sm text-label-sm text-outline">
                        {formatTimestamp(version.createdAt)}
                      </span>
                    </div>

                    <div className="font-headline-sm text-headline-sm text-on-surface pt-space-xs truncate">
                      {isLive
                        ? currentTitle || "Current Draft"
                        : version.title || `Snapshot ${index}`}
                    </div>

                    <div className="flex items-center justify-between pt-space-sm mt-space-xs border-t border-[#E8E8E5]/60">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary text-[10px] font-bold flex items-center justify-center">
                          {isLive ? "●" : getInitials(authorName)}
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                          {authorName}
                        </span>
                      </div>

                      {/* Badges in compare mode or single inspect */}
                      {isCompareMode ? (
                        <div className="flex items-center gap-1">
                          {isBase && (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-label-sm text-label-sm font-semibold">
                              Base [A]
                            </span>
                          )}
                          {isTarget && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-label-sm text-label-sm font-semibold">
                              Target [B]
                            </span>
                          )}
                        </div>
                      ) : (
                        isSelected && (
                          <span className="text-primary font-label-sm text-label-sm font-semibold">
                            Selected
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* Restore Confirmation Dialog Modal */}
      {showRestoreModal && versionToRestore && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest border border-[#E8E8E5] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[24px]">
                  restore
                </span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Restore this version?
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {formatFullDate(versionToRestore.createdAt)}
                </p>
              </div>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              Restoring will replace the current draft with this historical snapshot. All active collaborators will be updated immediately.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setVersionToRestore(null);
                }}
                disabled={restoring}
                className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-label-md text-label-md bg-primary hover:bg-primary/90 text-on-primary shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {restoring ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Restoring…</span>
                  </>
                ) : (
                  <span>Confirm Restore</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
