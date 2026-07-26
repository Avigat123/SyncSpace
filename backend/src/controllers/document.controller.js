import asyncHandler from "../utils/asyncHandler.js";

import * as documentService from "../services/document.service.js";

export const createDocument = asyncHandler(async (req, res) => {

    const document = await documentService.createDocument(
        req.body.title,
        req.user._id
    );

    res.status(201).json({
        success: true,
        document,
    });
});

export const getDocuments = asyncHandler(async (req, res) => {

    const documents = await documentService.getUserDocuments(
        req.user._id
    );

    res.json({
        success: true,
        documents,
    });
});

export const getDocument = asyncHandler(async (req, res) => {

    const document = await documentService.getDocumentById(
        req.params.id
    );

    res.json({
        success: true,
        document,
    });
});

export const updateDocument = asyncHandler(async (req, res) => {

    const document = await documentService.updateDocument(
        req.params.id,
        req.body
    );

    res.json({
        success: true,
        document,
    });
});

export const deleteDocument = asyncHandler(async (req, res) => {

    await documentService.deleteDocument(req.params.id);

    res.json({
        success: true,
        message: "Document deleted",
    });
});