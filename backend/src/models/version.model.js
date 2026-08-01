import mongoose from "mongoose";

const versionSchema = new mongoose.Schema(
    {
        document: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Document",
            required: true,
        },

        content: {
            type: String,
            required: true,
        },

        title: {
            type: String,
            required: true,
        },

        editedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        createdAt: {
            type: Date,
            default: Date.now,
        },
    }
);

export default mongoose.model("Version", versionSchema);