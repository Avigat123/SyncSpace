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

export const getDocumentById = async (documentId, userId) => {

    const document = await Document.findOne({
        _id: documentId,
        owner: userId,
    });

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    return document;
};

export const updateDocument = async (documentId, userId, data) => {

    const document = await Document.findOneAndUpdate(
        {
            _id: documentId,
            owner: userId,
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

export const deleteDocument = async (documentId, userId) => {

    const document = await Document.findOneAndDelete({
        _id: documentId,
        owner: userId,
    });

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    return document;
};