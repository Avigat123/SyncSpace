
import dotenv from "dotenv";
import mongoose from "mongoose";
import * as Y from "yjs";

import connectDB from "./src/config/db.js";
import { loadYDoc } from "./src/services/yjs.service.js";
import { compactYjsDocument } from "./src/services/yjsCompaction.service.js";

dotenv.config();

const documentId = "6ac2c9d277bfb6fc4726cd86";

try {
    await connectDB();

    // Load document before compaction.
    const beforeDoc = await loadYDoc(documentId);
    const beforeState = Y.encodeStateAsUpdate(beforeDoc);
    const beforeVector = Y.encodeStateVector(beforeDoc);

    console.log("Before compaction:", {
        stateSize: beforeState.length,
        stateVectorSize: beforeVector.length,
    });

    beforeDoc.destroy();

    // Execute compaction.
    const result = await compactYjsDocument(documentId);
    console.log("Compaction result:", result);

    // Recover document after compaction.
    const afterDoc = await loadYDoc(documentId);
    const afterState = Y.encodeStateAsUpdate(afterDoc);
    const afterVector = Y.encodeStateVector(afterDoc);

    console.log("After compaction:", {
        stateSize: afterState.length,
        stateVectorSize: afterVector.length,
    });

    console.log(
        "State vector preserved:",
        Buffer.from(beforeVector).equals(Buffer.from(afterVector))
    );

    console.log(
        "Encoded state preserved:",
        Buffer.from(beforeState).equals(Buffer.from(afterState))
    );

    afterDoc.destroy();

    // Inspect database counters and remaining update records.
    const document = await mongoose.connection
        .collection("documents")
        .findOne({ _id: new mongoose.Types.ObjectId(documentId) });

    const remainingUpdates = await mongoose.connection
        .collection("yjsupdates")
        .countDocuments({
            document: new mongoose.Types.ObjectId(documentId),
            generation: 0,
        });

    console.log("Database verification:", {
        updateSequence: document.updateSequence,
        snapshotSequence: document.snapshotSequence,
        remainingUpdates,
    });

} catch (error) {
    console.error("Compaction test failed:", error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
