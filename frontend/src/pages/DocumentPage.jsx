import { useParams } from "react-router-dom";
import Editor from "../components/editor/Editor";

function DocumentPage() {
    const { documentId } = useParams();

    return (
        <div>
            <h1>SyncSpace Editor</h1>

            <Editor documentId={documentId} />
        </div>
    );
}

export default DocumentPage;