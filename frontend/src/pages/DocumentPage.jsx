import { useParams } from "react-router-dom";
import Editor from "../components/editor/Editor";
import useDocument from "../hooks/useDocument";

function DocumentPage() {
    const { documentId } = useParams();

    const {
        document,
        loading,
        error,
    } = useDocument(documentId);

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
            <h1>{document.title}</h1>

            <Editor documentId={documentId} />
        </div>
    );
}

export default DocumentPage;