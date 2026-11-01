
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const collectionName = "yjsupdates";
const indexName = "document_1_generation_1_sequence_1";

try {
    await mongoose.connect(process.env.MONGODB_URI);

    const collection = mongoose.connection.collection(collectionName);

    // Check for duplicate sequence entries first.
    const duplicates = await collection.aggregate([
        {
            $group: {
                _id: {
                    document: "$document",
                    generation: "$generation",
                    sequence: "$sequence",
                },
                count: { $sum: 1 },
            },
        },
        {
            $match: { count: { $gt: 1 } },
        },
    ]).toArray();

    if (duplicates.length > 0) {
        console.log("Duplicate entries found. Index not modified.");
        console.log(duplicates);
        process.exitCode = 1;
    } else {
        // Remove the existing non-unique index.
        await collection.dropIndex(indexName);

        // Recreate it as a unique compound index.
        await collection.createIndex(
            {
                document: 1,
                generation: 1,
                sequence: 1,
            },
            {
                unique: true,
                name: indexName,
            }
        );

        console.log("Unique compound index created successfully!");

        const indexes = await collection.indexes();
        console.log(JSON.stringify(indexes, null, 2));
    }

} catch (error) {
    console.error("Index update failed:", error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
