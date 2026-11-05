import Document from "../models/document.model.js";
import ApiError from "../utils/ApiError.js";
import Version from "../models/version.model.js";
import YjsUpdate from "../models/yjsUpdate.model.js";
import { removeYDoc } from "../socket/yjsStore.js";
import { saveTimers, incrementDocumentGeneration, withDocumentWriteLock } from "../socket/store.js";
import { removeAwareness } from "../socket/awarenessStore.js";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30-day retention period

export const createDocument = async (title, ownerId) => {
    const document = await Document.create({
        title,
        owner: ownerId,
    });

    return document;
};

export const getUserDocuments = async (userId) => {
    return await Document.find({
        isDeleted: { $ne: true },
        $or: [
            { owner: userId },
            { "collaborators.user": userId },
        ],
    }).sort({
        updatedAt: -1,
    });
};

export const getDocumentById = async (documentId) => {
    const document = await Document.findOne({
        _id: documentId,
        isDeleted: { $ne: true },
    }).populate(
        "collaborators.user",
        "name email"
    );

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    return document;
};

export const updateDocument = async (documentId, data) => {
    const document = await Document.findOneAndUpdate(
        {
            _id: documentId,
            isDeleted: { $ne: true },
        },
        data,
        {
            new: true,
            runValidators: true,
        }
    );

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    return document;
};

export const removeCollaborator = async (documentId, collaboratorId) => {
    const document = await Document.findOne({
        _id: documentId,
        isDeleted: { $ne: true },
    });

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    const collaboratorExists = document.collaborators.some(
        (collaborator) => collaborator.user.toString() === collaboratorId
    );

    if (!collaboratorExists) {
        throw new ApiError(404, "Collaborator not found");
    }

    document.collaborators = document.collaborators.filter(
        (collaborator) => collaborator.user.toString() !== collaboratorId
    );

    await document.save();

    return document;
};

export const updateCollaboratorRole = async (documentId, collaboratorId, role) => {
    const document = await Document.findOne({
        _id: documentId,
        isDeleted: { $ne: true },
    });

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    const collaborator = document.collaborators.find(
        (item) => item.user.toString() === collaboratorId
    );

    if (!collaborator) {
        throw new ApiError(404, "Collaborator not found");
    }
    collaborator.role = role;

    await document.save();

    return document;
};

/**
 * Soft delete document (Move to Trash)
 * Preserves content, Yjs snapshots, updates, and version history.
 */
export const deleteDocument = async (documentId, userId) => {
    return withDocumentWriteLock(documentId, async () => {
        const document = await Document.findOne({
            _id: documentId,
            isDeleted: { $ne: true },
        });

        if (!document) {
            throw new ApiError(404, "Document not found");
        }

        // Invalidate pending saves from the previous generation.
        incrementDocumentGeneration(documentId);

        // Cancel pending debounced save.
        const timer = saveTimers.get(documentId);
        if (timer) {
            clearTimeout(timer);
            saveTimers.delete(documentId);
        }

        // Remove live awareness state
        removeAwareness(documentId);

        // Remove cached Yjs document from memory
        const ydoc = removeYDoc(documentId);
        if (ydoc) {
            ydoc.destroy();
        }

        // Soft delete: flag as deleted without removing versions or updates
        document.isDeleted = true;
        document.deletedAt = new Date();
        document.deletedBy = userId;
        await document.save();

        return document;
    });
};

/**
 * Get Trashed documents for user
 * Prunes expired items exceeding 30-day retention window
 */
export const getTrashDocuments = async (userId) => {
    const cutoffDate = new Date(Date.now() - RETENTION_MS);

    // Prune documents older than 30 days
    const expiredDocs = await Document.find({
        owner: userId,
        isDeleted: true,
        deletedAt: { $lt: cutoffDate },
    });

    for (const expDoc of expiredDocs) {
        await Version.deleteMany({ document: expDoc._id });
        await YjsUpdate.deleteMany({ document: expDoc._id });
        await expDoc.deleteOne();
    }

    // Retrieve active trashed documents
    return await Document.find({
        owner: userId,
        isDeleted: true,
        deletedAt: { $gte: cutoffDate },
    }).sort({
        deletedAt: -1,
    });
};

/**
 * Restore document from Trash
 */
export const restoreDocument = async (documentId, userId) => {
    const document = await Document.findOne({
        _id: documentId,
        owner: userId,
        isDeleted: true,
    });

    if (!document) {
        throw new ApiError(404, "Document not found in Trash");
    }

    document.isDeleted = false;
    document.deletedAt = null;
    document.deletedBy = null;
    await document.save();

    return document;
};

/**
 * Permanently delete a single document from Trash
 */
export const permanentDeleteDocument = async (documentId, userId) => {
    return withDocumentWriteLock(documentId, async () => {
        const document = await Document.findOne({
            _id: documentId,
            owner: userId,
        });

        if (!document) {
            throw new ApiError(404, "Document not found");
        }

        incrementDocumentGeneration(documentId);
        const timer = saveTimers.get(documentId);
        if (timer) {
            clearTimeout(timer);
            saveTimers.delete(documentId);
        }

        removeAwareness(documentId);
        const ydoc = removeYDoc(documentId);
        if (ydoc) {
            ydoc.destroy();
        }

        await Version.deleteMany({ document: documentId });
        await YjsUpdate.deleteMany({ document: documentId });
        await document.deleteOne();

        return document;
    });
};

/**
 * Empty all Trash for user
 */
export const emptyTrash = async (userId) => {
    const trashedDocs = await Document.find({
        owner: userId,
        isDeleted: true,
    });

    for (const doc of trashedDocs) {
        const docId = doc._id.toString();
        incrementDocumentGeneration(docId);
        const timer = saveTimers.get(docId);
        if (timer) {
            clearTimeout(timer);
            saveTimers.delete(docId);
        }

        removeAwareness(docId);
        const ydoc = removeYDoc(docId);
        if (ydoc) {
            ydoc.destroy();
        }

        await Version.deleteMany({ document: doc._id });
        await YjsUpdate.deleteMany({ document: doc._id });
        await doc.deleteOne();
    }

    return { deletedCount: trashedDocs.length };
};
