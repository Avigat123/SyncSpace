import Document from "../models/document.model.js";
import ApiError from "../utils/ApiError.js";

export const createDocument = async (title, ownerId) => {
    const document = await Document.create({
        title,
        owner: ownerId,
    });

    return document;
};

export const getUserDocuments = async (userId) => {
    return await Document.find({ owner: userId }).sort({
        updatedAt: -1,
    });
};

export const getDocumentById = async (documentId) => {
    const document = await Document.findById(documentId);

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

export const deleteDocument = async (documentId) => {
    const document = await Document.findByIdAndDelete(documentId);

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    return document;
};