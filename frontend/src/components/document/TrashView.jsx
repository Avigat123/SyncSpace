import { useState, useEffect } from "react";
import {
  getTrashDocuments,
  restoreDocumentFromTrash,
  permanentDeleteDocument,
  emptyTrash,
} from "../../api/document";

export default function TrashView({ onDocumentRestored, onBack }) {
  const [trashedDocs, setTrashedDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null); // id or 'empty'

  // Modal dialog states
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const fetchTrash = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTrashDocuments();
      setTrashedDocs(response?.documents || []);
    } catch (err) {
      console.error("Failed to fetch trash:", err);
      setError(err.message || "Failed to load recently deleted documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (docId) => {
    setActionInProgress(docId);
    try {
      await restoreDocumentFromTrash(docId);
      setTrashedDocs((prev) => prev.filter((d) => d._id !== docId));
      if (onDocumentRestored) {
        onDocumentRestored();
      }
    } catch (err) {
      alert(err.message || "Failed to restore document");
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePermanentDelete = async (docId) => {
    setActionInProgress(docId);
    try {
      await permanentDeleteDocument(docId);
      setTrashedDocs((prev) => prev.filter((d) => d._id !== docId));
      setConfirmDeleteDoc(null);
    } catch (err) {
      alert(err.message || "Failed to permanently delete document");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleEmptyTrash = async () => {
    setActionInProgress("empty");
    try {
      await emptyTrash();
      setTrashedDocs([]);
      setShowEmptyConfirm(false);
    } catch (err) {
      alert(err.message || "Failed to empty trash");
    } finally {
      setActionInProgress(null);
    }
  };

  const getDaysRemaining = (deletedAt) => {
    if (!deletedAt) return 30;
    const deletedTime = new Date(deletedAt).getTime();
    const expiresAt = deletedTime + 30 * 24 * 60 * 60 * 1000;
    const remainingMs = expiresAt - Date.now();
    const days = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Recently";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E5]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-[#E8E8E5] transition-colors cursor-pointer"
              title="Back to Documents"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
                Recently Deleted
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                {trashedDocs.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
              Documents in Trash are retained for 30 days before being permanently deleted.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container border border-[#E8E8E5] rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to Documents</span>
            </button>
          )}

          {trashedDocs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEmptyConfirm(true)}
              disabled={actionInProgress !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/60 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete_forever</span>
              <span>Empty Trash</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-3"></div>
          <p className="text-sm text-on-surface-variant">Loading deleted documents...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchTrash}
            className="px-3 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && trashedDocs.length === 0 && (
        <div className="py-16 px-4 text-center rounded-2xl border border-dashed border-[#E8E8E5] bg-surface-container/20">
          <div className="w-14 h-14 mx-auto rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
            <span className="material-symbols-outlined text-3xl">auto_delete</span>
          </div>
          <h3 className="text-base font-semibold text-on-surface">Trash is empty</h3>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 max-w-sm mx-auto">
            Documents you delete will show up here for 30 days before being permanently removed.
          </p>
        </div>
      )}

      {/* Document list */}
      {!loading && !error && trashedDocs.length > 0 && (
        <div className="bg-surface-bright rounded-2xl border border-[#E8E8E5] shadow-xs overflow-hidden">
          <div className="divide-y divide-[#E8E8E5]">
            {trashedDocs.map((doc) => {
              const daysLeft = getDaysRemaining(doc.deletedAt);
              const isRestoring = actionInProgress === doc._id;

              return (
                <div
                  key={doc._id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-container/30 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/40 flex items-center justify-center text-red-500 dark:text-red-400 shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[20px]">
                        article
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-on-surface truncate">
                        {doc.title || "Untitled Document"}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-on-surface-variant">
                        <span>Deleted {formatDate(doc.deletedAt)}</span>
                        <span>•</span>
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            daysLeft <= 3
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            schedule
                          </span>
                          {daysLeft === 1
                            ? "1 day left before permanent deletion"
                            : `${daysLeft} days left`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore(doc._id)}
                      disabled={actionInProgress !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Restore document"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        restore_from_trash
                      </span>
                      {isRestoring ? "Restoring..." : "Restore"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteDoc(doc)}
                      disabled={actionInProgress !== null}
                      className="p-1.5 text-on-surface-variant hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete permanently"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete_forever
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Single Document Permanently */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-bright rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E8E8E5] space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                Delete Permanently?
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5">
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-on-surface">
                  "{confirmDeleteDoc.title || "Untitled Document"}"
                </span>
                ? This will permanently erase all versions, updates, and collaborative history. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDoc(null)}
                disabled={actionInProgress !== null}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePermanentDelete(confirmDeleteDoc._id)}
                disabled={actionInProgress !== null}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                {actionInProgress === confirmDeleteDoc._id
                  ? "Deleting..."
                  : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Empty Trash */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-bright rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E8E8E5] space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                Empty Trash?
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5">
                Are you sure you want to empty the Trash? All{" "}
                <span className="font-semibold text-on-surface">
                  {trashedDocs.length} {trashedDocs.length === 1 ? "document" : "documents"}
                </span>{" "}
                will be permanently deleted immediately along with their complete version histories. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEmptyConfirm(false)}
                disabled={actionInProgress !== null}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmptyTrash}
                disabled={actionInProgress !== null}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                {actionInProgress === "empty" ? "Emptying..." : "Empty Trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

