import express from "express";

import authMiddleware from "../middlewares/auth.middleware.js";

import { createDocument, getDocuments, getDocument, updateDocument, deleteDocument, shareDocument } from "../controllers/document.controller.js";
import checkDocumentPermission from "../middlewares/documentPermission.middleware.js";
const router = express.Router();

router.use(authMiddleware);

router.post("/", createDocument);

router.get("/", getDocuments);

router.get("/:id", getDocument);

router.put("/:id", updateDocument);

router.delete("/:id", deleteDocument);

router.post("/:id/share", shareDocument);

router.get("/:id", checkDocumentPermission("viewer"), getDocument);

router.put("/:id", checkDocumentPermission("editor"), updateDocument);

router.delete("/:id", checkDocumentPermission("owner"), deleteDocument);

router.post("/:id/share", checkDocumentPermission("owner"), shareDocument);

router.get("/:id/history", checkDocumentPermission("viewer"), getDocumentVersions);

router.post("/:documentId/history/:versionId/restore", checkDocumentPermission("editor"), restoreVersion);

export default router;