import express from "express";

import authMiddleware from "../middlewares/auth.middleware.js";

import { createDocument, getDocuments, getDocument, updateDocument, deleteDocument, shareDocument, restoreVersion, getDocumentVersions, removeCollaborator, updateCollaboratorRole } from "../controllers/document.controller.js";

import { createDocumentVersion } from "../controllers/document.controller.js";

import checkDocumentPermission from "../middlewares/documentPermission.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Document creation/listing
router.post("/", createDocument);
router.get("/", getDocuments);

// Single document
router.get(
    "/:id",
    checkDocumentPermission("viewer"),
    getDocument
);

router.put(
    "/:id",
    checkDocumentPermission("editor"),
    updateDocument
);

router.delete(
    "/:id",
    checkDocumentPermission("owner"),
    deleteDocument
);

// Sharing
router.post(
    "/:id/share",
    checkDocumentPermission("owner"),
    shareDocument
);

router.delete(
    "/:id/collaborators/:collaboratorId",
    checkDocumentPermission("owner"),
    removeCollaborator
);

router.patch(
    "/:id/collaborators/:collaboratorId",
    checkDocumentPermission("owner"),
    updateCollaboratorRole
);

// Version history
router.get(
    "/:id/history",
    checkDocumentPermission("viewer"),
    getDocumentVersions
);

router.post(
    "/:documentId/history/:versionId/restore",
    checkDocumentPermission("editor"),
    restoreVersion
);

router.post(
    "/:id/versions",
    checkDocumentPermission("editor"),
    createDocumentVersion
);

export default router;
