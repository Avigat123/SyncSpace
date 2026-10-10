
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "../components/editor/Editor";
import useDocument from "../hooks/useDocument";
import socket from "../services/socket";

function DocumentPage() {
    const { documentId } = useParams();

    const { document, loading, error } = useDocument(documentId);

    const [editorKey, setEditorKey] = useState(0);
    const [title, setTitle] = useState("");

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
            <Editor key={editorKey} documentId={documentId} />
        </div>
    );
}

export default DocumentPage;
