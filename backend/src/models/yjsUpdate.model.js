import mongoose from "mongoose";

const yjsUpdateSchema = new mongoose.Schema(
    {
        document: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Document",
            required: true,
            index: true,
        },

        generation: {
            type: Number,
            required: true,
            min: 0,
        },

        sequence: {
            type: Number,
            required: true,
            min: 1,
        },

        update: {
            type: Buffer,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

yjsUpdateSchema.index(
    {
        document: 1,
        generation: 1,
        sequence: 1,
    },
    {
        unique: true,
    }
);

const YjsUpdate = mongoose.model(
    "YjsUpdate",
    yjsUpdateSchema
);

export default YjsUpdate;