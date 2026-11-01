import { createClient } from "redis";
import { randomUUID } from "crypto";
import * as Y from "yjs";
import { getYDoc, removeYDoc } from "./yjsStore.js";
import { getSharedDocumentGeneration, saveTimers } from "./store.js";
import { removeAwareness } from "./awarenessStore.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const yjsPublisher = createClient({
    url: redisUrl,
});

export const yjsSubscriber = createClient({
    url: redisUrl,
});

yjsPublisher.on("error", (err) => {
    console.log("[Yjs Redis Publisher]", err);
})

yjsSubscriber.on("error", (err) => {
    console.log("[Yjs Redis Subscriber]", err);
})

export async function connectYjsRedis() {
    await Promise.all([
        yjsPublisher.connect(),
        yjsSubscriber.connect(),
    ]);

    console.log("[Yjs Redis] Publisher and subscriber connected");
}

const YJS_CHANNEL = "syncspace:yjs:updates";

const INSTANCE_ID = randomUUID();

// Publish a local Yjs update to other backend instances.
export async function publishYjsUpdate(documentId, update, generation) {
    const payload = {
        origin: INSTANCE_ID,
        documentId,
        generation,
        update: Buffer.from(update).toString("base64"),
    };

    await yjsPublisher.publish(
        YJS_CHANNEL,
        JSON.stringify(payload)
    );
}

// Subscribe to updates from other backend instances.
export async function subscribeToYjsUpdates() {
    await yjsSubscriber.subscribe(YJS_CHANNEL, async (message) => {
        try {
            const payload = JSON.parse(message);

            // Ignore updates published by this instance.
            if (payload.origin === INSTANCE_ID) return;

            const { documentId, generation, update } = payload;

            // Check the authoritative generation in MongoDB.
            const currentGeneration = await getSharedDocumentGeneration(documentId);

            if (currentGeneration === null || generation !== currentGeneration) {
                console.log("[Yjs Redis] Rejected stale update:", {
                    documentId,
                    receivedGeneration: generation,
                    currentGeneration,
                });

                return;
            }

            const ydoc = await getYDoc(documentId);

            // Check again in case a restore happened while loading.
            const latestGeneration = await getSharedDocumentGeneration(documentId);

            if (generation !== latestGeneration) return;

            const binaryUpdate = Buffer.from(update, "base64");

            // Apply the update to this backend's local Y.Doc.
            Y.applyUpdate(ydoc, binaryUpdate, "redis");


            console.log(`[Yjs Redis] Applied and broadcast remote update for ${documentId}`);

        } catch (error) {
            console.error("[Yjs Redis] Update error:", error);
        }
    });

    console.log("[Yjs Redis] Subscribed to update channel");
}

const RESTORE_CHANNEL = "syncspace:yjs:restores";

// Publish a version restoration to other backend instances.
export async function publishDocumentRestore(documentId, generation) {
    const payload = {
        origin: INSTANCE_ID,
        documentId,
        generation,
    };

    await yjsPublisher.publish(
        RESTORE_CHANNEL,
        JSON.stringify(payload)
    );

    console.log(
        `[Yjs Redis] Published restore notification for ${documentId}`
    );
}

// Listen for version restorations from other backend instances.
export async function subscribeToYjsRestores() {
    await yjsSubscriber.subscribe(RESTORE_CHANNEL, async (message) => {
        try {
            const payload = JSON.parse(message);

            // Ignore restorations initiated by this instance.
            if (payload.origin === INSTANCE_ID) return;

            const { documentId, generation } = payload;

            // Confirm that this notification matches MongoDB.
            const currentGeneration =
                await getSharedDocumentGeneration(documentId);

            if (currentGeneration === null ||
                generation !== currentGeneration) {
                return;
            }

            // Remove old awareness state first.
            removeAwareness(documentId);

            // Invalidate the old cached Y.Doc.
            const oldYDoc = removeYDoc(documentId);

            if (oldYDoc) {
                oldYDoc.destroy();
            }

            // Cancel pending persistence from the old document state.
            const timer = saveTimers.get(documentId);

            if (timer) {
                clearTimeout(timer);
                saveTimers.delete(documentId);
            }

            console.log(
                `[Yjs Redis] Invalidated cached document after restore: ${documentId}`
            );

        } catch (error) {
            console.error("[Yjs Redis] Restore notification error:", error);
        }
    });

    console.log("[Yjs Redis] Subscribed to restore channel");
}