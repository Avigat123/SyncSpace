
import { useCallback, useEffect, useState } from "react";
import { getDocument } from "../api/document.js";

export default function useDocument(documentId) {
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const refreshDocument = useCallback(async () => {
        if (!documentId) {
            setDocument(null);
            setLoading(false);
            return;
        }

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
    }, [documentId]);

    useEffect(() => {
        refreshDocument();
    }, [refreshDocument]);

    return {
        document,
        loading,
        error,
        refreshDocument,
    };
}
