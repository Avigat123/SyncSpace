//frontend's document API boundary:

import request from "./axios.js";

export const createDocument = (title) =>
    request("/documents", {
        method: "POST",
        body: JSON.stringify({ title }),
    });

export const getDocuments = () =>
    request("/documents");

export const getDocument = (documentId) =>
    request(`/documents/${documentId}`);

export const updateDocument = (documentId, data) =>
    request(`/documents/${documentId}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });

export const deleteDocument = (documentId) =>
    request(`/documents/${documentId}`, {
        method: "DELETE",
    });

export const shareDocument = (documentId, email, role) =>
    request(`/documents/${documentId}/share`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
    });

export const getDocumentVersions = (documentId) =>
    request(`/documents/${documentId}/history`);

export const restoreVersion = (documentId, versionId) =>
    request(
        `/documents/${documentId}/history/${versionId}/restore`,
        {
            method: "POST",
        }
    );