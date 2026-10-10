import Document from "../models/document.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

const checkDocumentPermission = (requiredRole) => {
    return asyncHandler(async (req, res, next) => {
        const id = req.params.id || req.params.documentId;
        const document = await Document.findById(id);

        if(!document){
            throw new ApiError(404, "Document not found");
        }
        
        if(document.owner.toString() === req.user._id.toString()){
            req.document = document;
            return next();
        }

        //If the user isn't the owner, look in the collaborators array.
        const collaborator = document.collaborators.find(
            c => c.user.toString() === req.user._id.toString()
        );  

        //If no collaborator, then no access
        if (!collaborator) {
            throw new ApiError(403, "Access denied");
        }

        const permissionLevels = {
            viewer: 1,
            editor: 2,
            owner: 3,
        };

        if ( permissionLevels[collaborator.role] < permissionLevels[requiredRole] ) {
            throw new ApiError(403, "Insufficient permissions");
        }

        req.document = document;
        next();
    });
};

export default checkDocumentPermission;