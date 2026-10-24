import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "../components/editor/Editor";
import useDocument from "../hooks/useDocument";
import socket from "../services/socket";
import { shareDocument, removeCollaborator, updateCollaboratorRole, updateDocument } from "../api/document.js";
import useAuth from "../hooks/useAuth.js";

function DocumentPage() {
    const { documentId } = useParams();

    const { document, loading, error, refreshDocument } = useDocument(documentId);
    console.log("COLLABORATORS:", document?.collaborators);

    const [editorKey, setEditorKey] = useState(0);
    const [title, setTitle] = useState("");
    const [originalTitle, setOriginalTitle] = useState("");

    const [shareEmail, setShareEmail] = useState("");
    const [shareRole, setShareRole] = useState("viewer");
    const [sharing, setSharing] = useState(false);
    const [shareMessage, setShareMessage] = useState("");
    const [accessRevoked, setAccessRevoked] = useState(false);
    const [roleOverride, setRoleOverride] = useState(null);

    const [savingTitle, setSavingTitle] = useState(false);
    const [titleMessage, setTitleMessage] = useState("");




    const { user } = useAuth();

    const isOwner = document?.owner?.toString() === user?._id?.toString();

    const currentCollaborator = document?.collaborators?.find(
        (collaborator) => {
            const collaboratorUserId = collaborator.user?._id ?? collaborator.user;
            return collaboratorUserId?.toString() === user?._id?.toString();
        }
    );

    const currentRole = isOwner ? "owner" : roleOverride ?? currentCollaborator?.role ?? "viewer";

    useEffect(() => {
        if (!documentId) return;

        const handleDocumentRestored = (payload) => {
            if (payload.documentId !== documentId) return;

            setTitle(payload.title);
            setEditorKey((key) => key + 1);
        };

        socket.on("document-restored", handleDocumentRestored);

        return () => {
            socket.off("document-restored", handleDocumentRestored);
        };
    }, [documentId]);

    useEffect(() => {
        const handleAccessRevoked = (payload) => {
            if (payload.documentId !== documentId) return;

            setAccessRevoked(true);
        };

        socket.on("access-revoked", handleAccessRevoked);

        return () => {
            socket.off("access-revoked", handleAccessRevoked);
        };
    }, [documentId]);

    useEffect(() => {
        if (document) {
            setTitle(document.title);
            setOriginalTitle(document.title);
        }
    }, [document]);

    useEffect(() => {
        const handleRoleUpdated = (payload) => {
            if (payload.documentId !== documentId) return;

            setRoleOverride(payload.role);
        };

        socket.on("collaborator-role-updated", handleRoleUpdated);

        return () => {
            socket.off("collaborator-role-updated", handleRoleUpdated);
        };
    }, [documentId]);

    useEffect(() => {
        const handleTitleUpdated = (payload) => {
            if (payload.documentId !== documentId) {
                return;
            }
            setTitle(payload.title);
        };

        socket.on("document-title-updated", handleTitleUpdated);

        return () => {
            socket.off("document-title-updated", handleTitleUpdated);
        };
    }, [documentId]);

    const handleShare = async (event) => {
        event.preventDefault();

        setSharing(true);
        setShareMessage("");

        try {
            const response = await shareDocument(documentId, shareEmail, shareRole);

            await refreshDocument();

            setShareMessage(response.message);
            setShareEmail("");

        } catch (err) {
            setShareMessage(err.message || "Failed to share document");
        } finally {
            setSharing(false);
        }
    };

    const handleRemoveCollaborator = async (collaboratorId) => {
        const confirmed = window.confirm(
            "Are you sure you want to remove this collaborator?"
        );

        if (!confirmed) return;

        setShareMessage("");

        try {
            const response = await removeCollaborator(
                documentId,
                collaboratorId
            );

            await refreshDocument();

            setShareMessage(response.message);
        } catch (err) {
            setShareMessage(
                err.message || "Failed to remove collaborator"
            );
        }
    };

    const handleRoleChange = async (collaboratorId, newRole) => {
        const collaborator = document.collaborators.find((item) => item.user._id.toString() === collaboratorId.toString());

        if (!collaborator) {
            return;
        }

        const oldRole = collaborator.role;

        if (oldRole === newRole) {
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to change this collaborator's role from ${oldRole} to ${newRole}?`
        );

        if (!confirmed) {
            await refreshDocument();
            return;
        }

        setShareMessage("");

        try {
            const response = await updateCollaboratorRole(documentId, collaboratorId, newRole);
            await refreshDocument();
            setShareMessage(response.message);
        } catch (err) {
            await refreshDocument();
            setShareMessage(err.message || "Failed to update role");
        }
    };

    const handleTitleSave = async (event) => {
        event.preventDefault();

        const trimmedTitle = title.trim();

        if (!trimmedTitle) {
            setTitleMessage("Title cannot be empty");
            return;
        }

        if (trimmedTitle === document.title) {
            setTitleMessage("Title is unchanged");
            return;
        }

        setSavingTitle(true);
        setTitleMessage("");

        try {
            await updateDocument(documentId, {
                title: trimmedTitle,
            });

            await refreshDocument();
            setOriginalTitle(trimmedTitle);
            setTitle(trimmedTitle);

            setTitleMessage("Title updated successfully");
        } catch (err) {
            setTitleMessage(err.message || "Failed to update title");
        } finally {
            setSavingTitle(false);
        }
    };

    const handleTitleKeyDown = (event) => {
        if (event.key === "Escape") {
            setTitle(originalTitle);
            setTitleMessage("");
        }
    };

    if (loading) {
        return <div>Loading document...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (!document) {
        return <div>Document not found.</div>;
    }

    if (accessRevoked) {
        return (
            <div>
                <h2>Access revoked</h2>
                <p>
                    Your access to this document has been removed.
                </p>
            </div>
        );
    }

    return (
        <div>
            {currentRole !== "viewer" ? (
                <form onSubmit={handleTitleSave}>
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        onKeyDown={handleTitleKeyDown}
                        placeholder="Document title"
                        maxLength={100}
                        required
                    />

                    <button type="submit" disabled={savingTitle}>
                        {savingTitle ? "Saving..." : "Save title"}
                    </button>

                    {titleMessage && <p>{titleMessage}</p>}
                </form>
            ) : (
                <h1>{document.title}</h1>
            )}
            <form onSubmit={handleShare}>
                <h3>Share document</h3>
                <input
                    type="email"
                    placeholder="Collaborator's email"
                    value={shareEmail}
                    onChange={(event) => setShareEmail(event.target.value)}
                    required
                />

                <select
                    value={shareRole}
                    onChange={(event) => setShareRole(event.target.value)}
                >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                </select>

                <button type="submit" disabled={sharing}>
                    {sharing ? "Sharing..." : "Share"}
                </button>

                {shareMessage && <p>{shareMessage}</p>}
            </form>


            {/* People with access */}
            <div>
                <h3>People with access</h3>

                {document.collaborators?.length === 0 ? (
                    <p>No collaborators yet.</p>
                ) : (
                    document.collaborators.map((collaborator) => {
                        const user = collaborator.user;
                        const key = collaborator._id || user?._id || user;
                        const name = user?.name;
                        const email = user?.email;

                        return (
                            <div key={key}>
                                <p>{name || "Collaborator"} {email ? `(${email})` : ""}</p>
                                {isOwner ? (<select value={collaborator.role} onChange={(event) => handleRoleChange(collaborator.user._id, event.target.value)} >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                </select>
                                ) : (<small>Role: {collaborator.role}</small>)}
                                {isOwner && (<button onClick={() => handleRemoveCollaborator(collaborator.user._id)}>
                                    Remove access
                                </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <Editor
                key={editorKey}
                documentId={documentId}
                role={currentRole}
            />
        </div>
    );
}

export default DocumentPage;
