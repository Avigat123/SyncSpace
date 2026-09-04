import { useEffect, useState } from "react";
import { getDocument } from "../api/document.js";

export default function useDocument(documentId) {
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!documentId) {
            setDocument(null);
            setLoading(false);
            return;
        }

        const fetchDocument = async () => {
            setLoading(true);
            setError("");

            try {
                const response = await getDocument(documentId);
                setDocument(response.document);
            } catch (err) {
                setError(err.message || "Failed to load document");
            } finally {
                setLoading(false);
            }
        };

        fetchDocument();
    }, [documentId]);

    return {
        document,
        loading,
        error,
    };
}