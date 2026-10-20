import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDocuments, createDocument } from "../api/document.js";
import useAuth from "../hooks/useAuth.js";

function DashboardPage() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);
    const { user } = useAuth();
    const userId = user?._id;

    useEffect(() => {
        const fetchDocuments = async () => {
            try {
                const response = await getDocuments();
                setDocuments(response.documents);
            } catch (err) {
                setError(err.message || "Failed to load documents");
            } finally {
                setLoading(false);
            }
        };

        fetchDocuments();
    }, []);

    const handleCreateDocument = async () => {
        setCreating(true);
        setError("");

        try {
            const response = await createDocument("Untitled Document");

            navigate(`/document/${response.document._id}`);
        } catch (err) {
            setError(err.message || "Failed to create document");
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return <div>Loading documents...</div>;
    }

    return (
        <div style={{ maxWidth: 800, margin: "40px auto" }}>
            <h1>SyncSpace Dashboard</h1>

            <button onClick={handleCreateDocument} disabled={creating}>
                {creating ? "Creating..." : "New Document"}
            </button>

            {error && (<p style={{ color: "red" }}>{error}</p>)}

            <div style={{ marginTop: 30 }}>
                {documents.length === 0 ? (<p>No documents yet.</p>) : (
                    documents.map((document) => (
                        <div
                            key={document._id}
                            onClick={() =>
                                navigate(`/document/${document._id}`)
                            }
                            style={{
                                padding: 15,
                                border: "1px solid #ccc",
                                marginBottom: 10,
                                cursor: "pointer",
                            }}
                        >
                            <h3>{document.title}</h3>
                            <p>{document.owner == userId ? "Owned by you" : "Shared with you"}</p>
                            <small>Updated: {new Date(document.updatedAt).toLocaleString()}</small>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default DashboardPage;