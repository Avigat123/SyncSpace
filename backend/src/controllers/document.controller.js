import asyncHandler from "../utils/asyncHandler.js";
import * as documentService from "../services/document.service.js";
import User from "../models/user.model.js";
import Document from "../models/document.model.js";
import Version from "../models/version.model.js";
import ApiError from "../utils/ApiError.js";
import { getIO } from "../socket/socketInstance.js";

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

    await documentService.deleteDocument(
        req.params.id
    );

    res.json({
        success: true,
        message: "Document deleted",
    });
});

export const shareDocument = asyncHandler(async (req, res) => {

    const { id } = req.params;
    const { email, role } = req.body;

    const document = req.document;

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    if (document.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Only the owner can share this document");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user._id.toString() === document.owner.toString()) {
        throw new ApiError(400, "Owner already has access");
    }

    if (!["editor", "viewer"].includes(role)) {
        throw new ApiError(400, "Invalid role");
    }

    const alreadyCollaborator = document.collaborators.find(
        collaborator => collaborator.user.toString() === user._id.toString()
    );

    if (alreadyCollaborator) {
        throw new ApiError(400, "User already has access");
    }

    document.collaborators.push({
        user: user._id,
        role,
    });

    await document.save();

    res.status(200).json({
        success: true,
        message: "Document shared successfully",
        document,
    });

});


export const getDocumentVersions = asyncHandler(async (req, res) => {

    const versions = await Version.find({
        document: req.params.id,
    })
        .populate("editedBy", "name email")
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        versions,
    });

});


export const restoreVersion = asyncHandler(async (req, res) => {
    const version = await Version.findById(req.params.versionId);

    if (!version) {
        throw new ApiError(404, "Version not found");
    }

    const document = await Document.findById(req.params.documentId);

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    if (version.document.toString() !== document._id.toString()) {
        throw new ApiError(
            400,
            "Version does not belong to this document"
        );
    }

    document.content = version.content;
    document.title = version.title;

    await document.save();

    const io = getIO();

    io.to(document._id.toString()).emit(
        "document-restored",
        {
            title: document.title,
            content: document.content,
        }
    );

    res.status(200).json({
        success: true,
        message: "Document restored successfully",
    });
});