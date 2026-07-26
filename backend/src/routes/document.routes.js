import express from "express";

import authMiddleware from "../middlewares/auth.middleware.js";

import { createDocument, getDocuments, getDocument, updateDocument, deleteDocument } from "../controllers/document.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", createDocument);

router.get("/", getDocuments);

router.get("/:id", getDocument);

router.put("/:id", updateDocument);

router.delete("/:id", deleteDocument);

export default router;