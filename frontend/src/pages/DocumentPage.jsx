import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "../components/editor/Editor";
import useDocument from "../hooks/useDocument";
import socket from "../services/socket";
import { shareDocument, removeCollaborator } from "../api/document.js";
import useAuth from "../hooks/useAuth.js";

function DocumentPage() {
    const { documentId } = useParams();

    const { document, loading, error, refreshDocument } = useDocument(documentId);
    console.log("COLLABORATORS:", document?.collaborators);

    const [editorKey, setEditorKey] = useState(0);
    const [title, setTitle] = useState("");

    const [shareEmail, setShareEmail] = useState("");
    const [shareRole, setShareRole] = useState("viewer");
    const [sharing, setSharing] = useState(false);
    const [shareMessage, setShareMessage] = useState("");

    const { user } = useAuth();

    const isOwner = document?.owner?.toString() === user?._id?.toString();

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
        if (document) {
            setTitle(document.title);
        }
    }, [document]);

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

    if (loading) {
        return <div>Loading document...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (!document) {
        return <div>Document not found.</div>;
    }

    return (
        <div>
            <h1>{title || document.title}</h1>
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
                                <small>Role: {collaborator.role}</small>
                                {isOwner && (
                                    <button onClick={() => handleRemoveCollaborator(collaborator.user._id)}>
                                        Remove access
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <Editor key={editorKey} documentId={documentId} />
        </div>
    );
}

export default DocumentPage;
