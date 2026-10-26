import Document from "../models/document.model.js";
import ApiError from "../utils/ApiError.js";
import Version from "../models/version.model.js";
import { removeYDoc } from "../socket/yjsStore.js";
import { saveTimers, getDocumentGeneration, incrementDocumentGeneration, withDocumentWriteLock, } from "../socket/store.js";

export const createDocument = async (title, ownerId) => {
    const document = await Document.create({
        title,
        owner: ownerId,
    });

    return document;
};

export const getUserDocuments = async (userId) => {
    return await Document.find({
        $or: [
            { owner: userId },
            { "collaborators.user": userId },
        ],
    }).sort({
        updatedAt: -1,
    });
};

export const getDocumentById = async (documentId) => {
    const document = await Document.findById(documentId).populate(
        "collaborators.user",
        "name email"
    );

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    return document;
};

export const updateDocument = async (documentId, data) => {
    const document = await Document.findByIdAndUpdate(
        documentId,
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
    const document = await Document.findById(documentId);

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    const collaboratorExists = document.collaborators.some((collaborator) => collaborator.user.toString() === collaboratorId);

    if (!collaboratorExists) {
        throw new ApiError(404, "Collaborator not found");
    }

    document.collaborators = document.collaborators.filter((collaborator) => collaborator.user.toString() !== collaboratorId);

    await document.save();

    return document;
};

export const updateCollaboratorRole = async (documentId, collaboratorId, role) => {
    const document = await Document.findById(documentId);

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    const collaborator = document.collaborators.find((item) => item.user.toString() === collaboratorId);

    if (!collaborator) {
        throw new ApiError(404, "Collaborator not found");
    }
    collaborator.role = role;

    await document.save();

    return document;
};

export const deleteDocument = async (documentId) => {
    return withDocumentWriteLock(documentId, async () => {
        const document = await Document.findById(documentId);

        if (!document) {
            throw new ApiError(404, "Document not found");
        }

        // Invalidate pending saves from the previous generation.
        incrementDocumentGeneration(documentId);

        // Cancel the pending debounced save.
        const timer = saveTimers.get(documentId);

        if (timer) {
            clearTimeout(timer);
            saveTimers.delete(documentId);
        }

        // Remove the cached Yjs document.
        const ydoc = removeYDoc(documentId);

        if (ydoc) {
            ydoc.destroy();
        }

        // Delete the document's version history.
        await Version.deleteMany({ document: documentId });

        // Finally, delete the document itself.
        await document.deleteOne();

        return document;
    });
};