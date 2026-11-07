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

export const createDocumentVersion = (documentId, title) =>
    request(`/documents/${documentId}/versions`, {
        method: "POST",
        body: JSON.stringify(title ? { title } : {}),
    });

export const restoreVersion = (documentId, versionId) =>
    request(`/documents/${documentId}/history/${versionId}/restore`, {
        method: "POST",
    });

export const removeCollaborator = (documentId, collaboratorId) =>
    request(`/documents/${documentId}/collaborators/${collaboratorId}`, {
        method: "DELETE",
    });

export const updateCollaboratorRole = (documentId, collaboratorId, role) =>
    request(`/documents/${documentId}/collaborators/${collaboratorId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
    });

export const getTrashDocuments = () =>
    request("/documents/trash");

export const restoreDocumentFromTrash = (documentId) =>
    request(`/documents/${documentId}/restore`, {
        method: "POST",
    });

export const permanentDeleteDocument = (documentId) =>
    request(`/documents/${documentId}/permanent`, {
        method: "DELETE",
    });

export const emptyTrash = () =>
    request("/documents/trash/empty", {
        method: "DELETE",
    });
