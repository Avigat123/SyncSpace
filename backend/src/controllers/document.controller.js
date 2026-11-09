import asyncHandler from "../utils/asyncHandler.js";
import * as documentService from "../services/document.service.js";
import User from "../models/user.model.js";
import Document from "../models/document.model.js";
import Version from "../models/version.model.js";
import ApiError from "../utils/ApiError.js";
import { getIO } from "../socket/socketInstance.js";
import { publishDocumentRestore } from "../socket/yjsRedis.js";
import { createVersion } from "../services/version.service.js";
import { getYDoc } from "../socket/yjsStore.js";
import { restoreVersionState } from "../services/versionRestore.service.js";

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

    // Notify everyone currently viewing this document.
    const io = getIO();

    io.to(req.params.id).emit("document-title-updated", {
        documentId: req.params.id,
        title: document.title,
    });

    res.json({
        success: true,
        document,
    });
});

export const deleteDocument = asyncHandler(async (req, res) => {
    const documentId = req.params.id;

    // Delete the document (soft delete / move to trash)
    await documentService.deleteDocument(documentId, req.user._id);

    const io = getIO();

    // Notify everyone currently viewing this document.
    io.to(documentId).emit("document-deleted", {
        documentId,
        message: "This document has been moved to trash by its owner.",
    });

    // Disconnect sockets from the deleted document's room.
    const documentRoom = io.sockets.adapter.rooms.get(documentId);

    if (documentRoom) {
        for (const socketId of documentRoom) {
            const activeSocket = io.sockets.sockets.get(socketId);

            if (activeSocket) {
                activeSocket.disconnect(true);
            }
        }
    }

    res.status(200).json({
        success: true,
        message: "Document moved to trash",
    });
});

export const getTrashDocuments = asyncHandler(async (req, res) => {
    const documents = await documentService.getTrashDocuments(req.user._id);
    res.json({
        success: true,
        documents,
    });
});

export const restoreDocument = asyncHandler(async (req, res) => {
    const document = await documentService.restoreDocument(req.params.id, req.user._id);
    res.json({
        success: true,
        message: "Document restored successfully",
        document,
    });
});

export const permanentDeleteDocument = asyncHandler(async (req, res) => {
    await documentService.permanentDeleteDocument(req.params.id, req.user._id);
    res.json({
        success: true,
        message: "Document permanently deleted",
    });
});

export const emptyTrash = asyncHandler(async (req, res) => {
    const result = await documentService.emptyTrash(req.user._id);
    res.json({
        success: true,
        message: "Trash emptied successfully",
        deletedCount: result.deletedCount,
    });
});

export const shareDocument = asyncHandler(async (req, res) => {

    const { id } = req.params;
    const { email, role } = req.body;

    const document = req.document;

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    const ownerId = (document.owner?._id || document.owner).toString();

    if (ownerId !== req.user._id.toString()) {
        throw new ApiError(403, "Only the owner can share this document");
    }

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user._id.toString() === ownerId) {
        throw new ApiError(400, "Owner already has access");
    }

    if (!["editor", "viewer"].includes(role)) {
        throw new ApiError(400, "Invalid role");
    }

    const alreadyCollaborator = document.collaborators.find(
        collaborator => (collaborator.user?._id || collaborator.user).toString() === user._id.toString()
    );

    if (alreadyCollaborator) {
        throw new ApiError(400, "User already has access");
    }

    document.collaborators.push({
        user: user._id,
        role,
    });

    await document.save();

    await document.populate(
        "collaborators.user",
        "name email"
    );

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
    const documentId = req.params.documentId || req.params.id;
    const { versionId } = req.params;

    const { document, generation } = await restoreVersionState(
        documentId,
        versionId
    );

    // Notify other backend instances through Redis.
    await publishDocumentRestore(documentId, generation);

    // Notify connected clients through Socket.IO.
    const io = getIO();

    io.to(documentId).emit("document-restored", {
        documentId,
        title: document.title,
        generation,
    });

    res.status(200).json({
        success: true,
        message: "Document restored successfully",
        document: {
            _id: document._id,
            title: document.title,
        },
    });
});


export const createDocumentVersion = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title } = req.body || {};

    const ydoc = await getYDoc(id);

    const version = await createVersion(
        id,
        ydoc,
        req.user._id,
        title
    );

    await version.populate("editedBy", "name email");

    res.status(201).json({
        success: true,
        version,
    });
});


export const removeCollaborator = asyncHandler(async (req, res) => {
    const { id, collaboratorId } = req.params;

    // 1. Remove access from the database first.
    await documentService.removeCollaborator(id, collaboratorId);

    // 2. Find active sockets for this collaborator on this document.
    const io = getIO();
    const documentRoom = io.sockets.adapter.rooms.get(id);

    if (documentRoom) {
        for (const socketId of documentRoom) {
            const activeSocket = io.sockets.sockets.get(socketId);

            if (activeSocket && activeSocket.user._id.toString() === collaboratorId) {
                // Tell frontend
                activeSocket.emit("access-revoked", {
                    documentId: id,
                    message: "Your access to this document has been removed.",
                });

                // Disconnect collaborator's active socket.
                activeSocket.disconnect(true);
            }
        }
    }

    res.status(200).json({
        success: true,
        message: "Collaborator access removed",
    });
});


export const updateCollaboratorRole = asyncHandler(async (req, res) => {
    const { id, collaboratorId } = req.params;
    const { role } = req.body;
    // Only Viewer and Editor roles are allowed.
    if (!["viewer", "editor"].includes(role)) {
        throw new ApiError(400, "Invalid role");
    }
    // 1. Update the collaborator's role in the database.
    await documentService.updateCollaboratorRole(id, collaboratorId, role);

    // 2. Notify the collaborator's active sockets and update server-cached role.
    const io = getIO();
    const documentRoom = io.sockets.adapter.rooms.get(id);

    if (documentRoom) {
        for (const socketId of documentRoom) {
            const activeSocket = io.sockets.sockets.get(socketId);
            if (activeSocket && activeSocket.user._id.toString() === collaboratorId) {
                activeSocket.documentRole = role; // Immediately update cached socket role on server
                activeSocket.emit("collaborator-role-updated", { documentId: id, role });
            }
        }
    }

    res.status(200).json({
        success: true,
        message: `Collaborator role updated to ${role}`,
    });
});