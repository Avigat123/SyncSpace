/**
 * SyncSpace — Durable Client-Side Pending Update Storage (IndexedDB)
 *
 * Persists outgoing collaborative Yjs updates before network transmission.
 * Retains updates in IndexedDB until server confirms durable MongoDB persistence (yjs-ack).
 * Recovers pending updates on document reopen / tab restore / network reconnect.
 * Discards outdated generations on version restore.
 * Provides in-memory fallback if IndexedDB is blocked, private, or unavailable.
 */

const DB_NAME = "syncspace_collaboration_db";
const DB_VERSION = 1;
const STORE_NAME = "pending_updates";

// In-memory fallback map if IndexedDB is not available: id -> entry
const memoryFallbackStore = new Map();
let isIdbSupported = null;
let dbPromise = null;

/**
 * Checks if IndexedDB is supported in the current environment.
 */
function checkIdbSupport() {
    if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
        return false;
    }
    return true;
}

/**
 * Opens or returns the cached IndexedDB connection.
 * @returns {Promise<IDBDatabase | null>}
 */
function getDb() {
    if (isIdbSupported === false) {
        return Promise.resolve(null);
    }

    if (!checkIdbSupport()) {
        isIdbSupported = false;
        return Promise.resolve(null);
    }

    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve) => {
        try {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                    store.createIndex("documentId", "documentId", { unique: false });
                    store.createIndex("documentId_generation", ["documentId", "generation"], { unique: false });
                    store.createIndex("createdAt", "createdAt", { unique: false });
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                isIdbSupported = true;

                db.onversionchange = () => {
                    db.close();
                    dbPromise = null;
                };

                resolve(db);
            };

            request.onerror = (event) => {
                console.warn("[IndexedDBStorage] Failed to open IndexedDB, falling back to in-memory store:", event.target.error);
                isIdbSupported = false;
                resolve(null);
            };
        } catch (err) {
            console.warn("[IndexedDBStorage] Exception opening IndexedDB, falling back to memory:", err);
            isIdbSupported = false;
            resolve(null);
        }
    });

    return dbPromise;
}

/**
 * Persists an outgoing Yjs update to durable storage.
 * Awaits full IndexedDB transaction completion (tx.oncomplete) before resolving true.
 *
 * @param {Object} params
 * @param {string} params.documentId
 * @param {string} params.updateId
 * @param {number|null} params.generation
 * @param {Uint8Array} params.update
 * @returns {Promise<boolean>}
 */
export async function savePendingUpdate({ documentId, updateId, generation, update }) {
    if (!documentId || !updateId || !update) return false;

    const id = `${documentId}:${updateId}`;
    const binary = update instanceof Uint8Array ? update : new Uint8Array(update);
    const entry = {
        id,
        documentId,
        updateId,
        generation: generation ?? null,
        update: binary,
        createdAt: Date.now(),
    };

    const db = await getDb();
    if (!db) {
        // Fallback store when IndexedDB is unavailable or blocked
        memoryFallbackStore.set(id, entry);
        return true;
    }

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            tx.oncomplete = () => {
                memoryFallbackStore.set(id, entry);
                resolve(true);
            };

            tx.onerror = (e) => {
                console.warn("[IndexedDBStorage] Transaction error persisting pending update:", e.target?.error);
                resolve(false);
            };

            tx.onabort = (e) => {
                console.warn("[IndexedDBStorage] Transaction aborted persisting pending update:", e.target?.error);
                resolve(false);
            };

            store.put(entry);
        } catch (err) {
            console.warn("[IndexedDBStorage] Transaction exception saving update:", err);
            resolve(false);
        }
    });
}

/**
 * Removes an acknowledged update from durable storage.
 * Awaits transaction completion.
 *
 * @param {string} documentId
 * @param {string} updateId
 * @returns {Promise<boolean>}
 */
export async function removePendingUpdate(documentId, updateId) {
    if (!documentId || !updateId) return false;

    const id = `${documentId}:${updateId}`;
    memoryFallbackStore.delete(id);

    const db = await getDb();
    if (!db) return true;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            tx.oncomplete = () => {
                resolve(true);
            };

            tx.onerror = (e) => {
                console.warn("[IndexedDBStorage] Transaction error deleting acknowledged update:", e.target?.error);
                resolve(false);
            };

            tx.onabort = (e) => {
                console.warn("[IndexedDBStorage] Transaction aborted deleting acknowledged update:", e.target?.error);
                resolve(false);
            };

            store.delete(id);
        } catch (err) {
            console.warn("[IndexedDBStorage] Transaction exception deleting update:", err);
            resolve(false);
        }
    });
}

/**
 * Retrieves all pending updates for a document.
 * Filters out and purges any updates from older generations.
 *
 * @param {string} documentId
 * @param {number|null} currentGeneration
 * @returns {Promise<Array<{ id: string, updateId: string, generation: number|null, update: Uint8Array, createdAt: number }>>}
 */
export async function getPendingUpdatesForDocument(documentId, currentGeneration = null) {
    if (!documentId) return [];

    let entries = [];
    const db = await getDb();

    if (!db) {
        // Retrieve from in-memory fallback
        for (const entry of memoryFallbackStore.values()) {
            if (entry.documentId === documentId) {
                entries.push(entry);
            }
        }
    } else {
        entries = await new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, "readonly");
                const store = tx.objectStore(STORE_NAME);
                const index = store.index("documentId");
                const req = index.getAll(IDBKeyRange.only(documentId));

                req.onsuccess = () => {
                    resolve(req.result || []);
                };
                req.onerror = (e) => {
                    console.warn("[IndexedDBStorage] Error getting pending updates by documentId:", e.target.error);
                    resolve([]);
                };
            } catch (err) {
                console.warn("[IndexedDBStorage] Transaction exception getting updates:", err);
                resolve([]);
            }
        });
    }

    const validEntries = [];
    const staleIdsToDelete = [];

    for (const entry of entries) {
        // Generation guard: If currentGeneration is established and entry generation is older,
        // it belongs to a pre-restore generation and must be discarded.
        if (
            currentGeneration !== null &&
            entry.generation !== null &&
            entry.generation < currentGeneration
        ) {
            staleIdsToDelete.push(entry.id);
            continue;
        }

        const binary = entry.update instanceof Uint8Array ? entry.update : new Uint8Array(entry.update);
        validEntries.push({
            id: entry.id,
            updateId: entry.updateId,
            generation: entry.generation,
            update: binary,
            createdAt: entry.createdAt || 0,
        });
    }

    // Purge stale entries from previous generations
    if (staleIdsToDelete.length > 0) {
        for (const staleId of staleIdsToDelete) {
            memoryFallbackStore.delete(staleId);
        }

        if (db) {
            try {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                for (const staleId of staleIdsToDelete) {
                    store.delete(staleId);
                }
            } catch (err) {
                console.warn("[IndexedDBStorage] Error purging stale generation updates:", err);
            }
        }
        console.log(`[IndexedDBStorage] Purged ${staleIdsToDelete.length} stale generation updates for doc ${documentId}`);
    }

    // Sort strictly in ascending FIFO order by creation time
    validEntries.sort((a, b) => a.createdAt - b.createdAt);

    return validEntries;
}

/**
 * Clears all pending updates for a document (e.g., when document is restored or deleted).
 *
 * @param {string} documentId
 * @returns {Promise<void>}
 */
export async function clearPendingUpdatesForDocument(documentId) {
    if (!documentId) return;

    for (const [key, entry] of memoryFallbackStore.entries()) {
        if (entry.documentId === documentId) {
            memoryFallbackStore.delete(key);
        }
    }

    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const index = store.index("documentId");
            const req = index.openKeyCursor(IDBKeyRange.only(documentId));

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => {
                console.warn("[IndexedDBStorage] Error clearing doc updates:", e.target?.error);
                resolve();
            };
            tx.onabort = () => resolve();

            req.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };
        } catch (err) {
            console.warn("[IndexedDBStorage] Error clearing doc updates:", err);
            resolve();
        }
    });
}

/**
 * Clears all pending updates in the entire database (e.g., on logout).
 *
 * @returns {Promise<void>}
 */
export async function clearAllPendingUpdates() {
    memoryFallbackStore.clear();

    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();

            store.clear();
        } catch {
            resolve();
        }
    });
}

/**
 * Returns true if IndexedDB is supported and active.
 */
export function isIndexedDBAvailable() {
    return isIdbSupported === true;
}

