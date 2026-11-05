import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Editor from "../components/editor/Editor";
import PresenceIndicator from "../components/collaboration/PresenceIndicator";
import ShareDialog from "../components/document/ShareDialog";
import VersionHistory from "../components/document/VersionHistory";
import useDocument from "../hooks/useDocument";
import socket from "../services/socket";
import { updateDocument, deleteDocument } from "../api/document.js";
import useAuth from "../hooks/useAuth.js";

function DocumentPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { document, loading, error, refreshDocument } = useDocument(documentId);

  const [editorKey, setEditorKey] = useState(0);
  const [title, setTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleMessage, setTitleMessage] = useState("");

  const [accessRevoked, setAccessRevoked] = useState(false);
  const [roleOverride, setRoleOverride] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [awareness, setAwareness] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const isOwner =
    (document?.owner?._id || document?.owner)?.toString() ===
    user?._id?.toString();

  const currentCollaborator = document?.collaborators?.find((collaborator) => {
    const collaboratorUserId =
      collaborator.user?._id ?? collaborator.user;
    return collaboratorUserId?.toString() === user?._id?.toString();
  });

  const currentRole = isOwner
    ? "owner"
    : roleOverride ?? currentCollaborator?.role ?? "viewer";

  // Handle version restored
  useEffect(() => {
    if (!documentId) return;

    const handleDocumentRestored = (payload) => {
      if (payload.documentId !== documentId) return;
      setTitle(payload.title);
      setEditorKey((key) => key + 1);
      refreshDocument();
    };

    socket.on("document-restored", handleDocumentRestored);
    return () => {
      socket.off("document-restored", handleDocumentRestored);
    };
  }, [documentId, refreshDocument]);

  // Handle access revoked
  useEffect(() => {
    if (!documentId) return;

    const handleAccessRevoked = (payload) => {
      if (payload.documentId !== documentId) return;
      setAccessRevoked(true);
    };

    socket.on("access-revoked", handleAccessRevoked);
    return () => {
      socket.off("access-revoked", handleAccessRevoked);
    };
  }, [documentId]);

  // Sync initial title from document
  useEffect(() => {
    if (document) {
      setTitle(document.title || "Untitled Document");
      setOriginalTitle(document.title || "Untitled Document");
    }
  }, [document]);

  // Handle live role update
  useEffect(() => {
    if (!documentId) return;

    const handleRoleUpdated = (payload) => {
      if (payload.documentId !== documentId) return;
      setRoleOverride(payload.role);
    };

    socket.on("collaborator-role-updated", handleRoleUpdated);
    return () => {
      socket.off("collaborator-role-updated", handleRoleUpdated);
    };
  }, [documentId]);

  // Handle title update across clients in real-time
  useEffect(() => {
    if (!documentId) return;

    const handleTitleUpdated = (payload) => {
      if (payload.documentId !== documentId) return;
      setTitle(payload.title);
      setOriginalTitle(payload.title);
    };

    socket.on("document-title-updated", handleTitleUpdated);
    return () => {
      socket.off("document-title-updated", handleTitleUpdated);
    };
  }, [documentId]);

  // Handle document deleted
  useEffect(() => {
    if (!documentId) return;

    const handleDocumentDeleted = (payload) => {
      if (payload.documentId !== documentId) return;
      window.alert(payload.message || "This document has been deleted.");
      navigate("/dashboard");
    };

    socket.on("document-deleted", handleDocumentDeleted);
    return () => {
      socket.off("document-deleted", handleDocumentDeleted);
    };
  }, [documentId, navigate]);

  // Title update handler
  const handleTitleBlurOrSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle === originalTitle || currentRole === "viewer") {
      setTitle(originalTitle);
      return;
    }

    setSavingTitle(true);
    setTitleMessage("");

    try {
      await updateDocument(documentId, { title: trimmedTitle });
      setOriginalTitle(trimmedTitle);
      setTitleMessage("Saved");
      setTimeout(() => setTitleMessage(""), 2000);
    } catch (err) {
      setTitleMessage(err.message || "Failed to update title");
      setTitle(originalTitle);
    } finally {
      setSavingTitle(false);
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      setTitle(originalTitle);
      e.target.blur();
    }
  };

  const handleDeleteDocument = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this document and its entire version history? This cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteDocument(documentId);
      navigate("/dashboard");
    } catch (err) {
      alert(err.message || "Failed to delete document");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Loading document and collaboration state…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg mx-auto my-16 p-6 rounded-xl bg-surface-container-lowest border border-error/20 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">error</span>
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
          Unable to open document
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
          {error}
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md text-label-md shadow-xs hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  if (accessRevoked) {
    return (
      <div className="w-full max-w-md mx-auto my-16 p-8 rounded-xl bg-surface-container-lowest border border-[#E8E8E5] shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">lock</span>
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
          Access Revoked
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
          Your access to this document has been removed by the owner.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md text-label-md shadow-xs"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="w-full max-w-md mx-auto my-16 p-8 rounded-xl bg-surface-container-lowest border border-[#E8E8E5] text-center">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
          Document Not Found
        </h2>
        <Link to="/dashboard" className="text-primary hover:underline font-label-md text-label-md">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const collaboratorCount = 1 + (document.collaborators?.length || 0);

  return (
    <div className="w-full flex flex-col relative min-h-screen">
      {/* Internal Editor Context Header */}
      <section className="sticky top-16 z-30 w-full bg-surface-bright/95 backdrop-blur-md border-b border-[#E8E8E5] px-4 sm:px-space-xl py-space-sm flex flex-col md:flex-row items-center justify-between gap-space-sm">
        {/* Left: Context & Document Title */}
        <div className="flex items-center gap-space-md min-w-0 w-full md:w-auto">
          <Link
            to="/dashboard"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors flex-shrink-0"
            title="Back to Dashboard"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
          </Link>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs text-outline font-label-sm text-label-sm tracking-wide">
              <span>SyncSpace</span>
              <span>/</span>
              <span className="text-on-surface-variant font-medium capitalize">
                {currentRole} Access
              </span>
              {titleMessage && (
                <>
                  <span>•</span>
                  <span className="text-tertiary font-medium">{titleMessage}</span>
                </>
              )}
            </div>

            <div className="group flex items-center gap-space-xs">
              {currentRole !== "viewer" ? (
                <form onSubmit={handleTitleBlurOrSubmit} className="flex items-center">
                  <input
                    aria-label="Document Title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleTitleBlurOrSubmit}
                    onKeyDown={handleTitleKeyDown}
                    disabled={savingTitle}
                    className="bg-transparent font-headline-md text-headline-md text-on-surface focus:outline-none focus:bg-surface-container-lowest px-1 py-0.5 rounded-lg w-56 sm:w-80 md:w-96 truncate border border-transparent focus:border-[#E8E8E5]"
                  />
                </form>
              ) : (
                <h1 className="font-headline-md text-headline-md text-on-surface px-1 py-0.5 truncate max-w-sm">
                  {document.title}
                </h1>
              )}
              {currentRole !== "viewer" && (
                <span className="material-symbols-outlined text-[16px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                  edit
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center-Right: Sync status, Active Avatars & Action Triggers */}
        <div className="flex items-center gap-2 sm:gap-space-md w-full md:w-auto justify-end flex-wrap">
          {/* Real-time Yjs Sync Indicator */}
          <div className="hidden lg:flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-low text-on-surface-variant border border-[#E8E8E5]/60">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
            </span>
            <span className="font-label-sm text-label-sm">
              Saved via Yjs Socket
            </span>
          </div>

          {/* Collaborator Presence Indicators */}
          {awareness && <PresenceIndicator awareness={awareness} />}

          {/* Version History Button */}
          <button
            type="button"
            onClick={() => setShowVersionHistory(true)}
            className="flex items-center gap-space-xs px-2.5 sm:px-space-md py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant transition-colors border border-[#E8E8E5] cursor-pointer"
            title="Inspect Revisions & Diff Restore"
          >
            <span className="material-symbols-outlined text-[16px]">
              history
            </span>
            <span className="font-label-sm text-label-sm hidden sm:inline">
              History
            </span>
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => setShowShareDialog(true)}
            className="flex items-center gap-space-xs bg-primary-container hover:bg-primary text-on-primary px-3 sm:px-space-md py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[16px]">lock</span>
            <span>Share ({collaboratorCount})</span>
          </button>

          {/* Owner Actions (Delete) */}
          {isOwner && (
            <button
              type="button"
              onClick={handleDeleteDocument}
              disabled={deleting}
              className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 transition-colors cursor-pointer"
              title="Delete Document"
            >
              <span className="material-symbols-outlined text-[18px]">
                delete
              </span>
            </button>
          )}
        </div>
      </section>

      {/* Editor Main Canvas */}
      <div className="w-full flex-1">
        <Editor
          key={editorKey}
          documentId={documentId}
          role={currentRole}
          onAwarenessChange={setAwareness}
        />
      </div>

      {/* Share Dialog Modal */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        document={document}
        isOwner={isOwner}
        onDocumentUpdated={refreshDocument}
      />

      {/* Version History Panel */}
      <VersionHistory
        documentId={documentId}
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        onVersionRestored={refreshDocument}
      />
    </div>
  );
}

export default DocumentPage;
