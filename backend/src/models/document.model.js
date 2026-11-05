import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        content: {
            type: String,
            default: "",
        },

        yjsState: {
            type: Buffer,
            default: null,
        },

        generation: {
            type: Number,
            default: 0,
            min: 0,
        },

        updateSequence: {
            type: Number,
            default: 0,
            min: 0,
        },

        snapshotSequence: {
            type: Number,
            default: 0,
            min: 0,
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        collaborators: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                role: {
                    type: String,
                    enum: ["editor", "viewer"],
                    default: "viewer",
                },
            },
        ],

    },
    {
        timestamps: true,
    }
);

const Document = mongoose.model("Document", documentSchema);

export default Document;
