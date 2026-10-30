/**
 * Stores debounced save timers for each document.
 * Key: documentId
 * Value: NodeJS Timeout
 */
export const saveTimers = new Map();

/**
 * Stores currently active users for each document.
 * Key: documentId
 * Value: [
 *   {
 *     socketId,
 *     userId,
 *     name
 *   }
 * ]
 */
export const activeUsers = new Map();


/**
 * Tracks the current generation of each document.
 * Incremented whenever a version is restored.
 * Key: documentId
 * Value: generation number
 */
export const documentGenerations = new Map();

export function getDocumentGeneration(documentId) {
    return documentGenerations.get(documentId) ?? 0;
}

export function incrementDocumentGeneration(documentId) {
    const nextGeneration = getDocumentGeneration(documentId) + 1;

    documentGenerations.set(documentId, nextGeneration);

    return nextGeneration;
}


/**
 * Serializes database writes per document.
 * Different documents can still be written concurrently.
 */
const documentWriteQueues = new Map();

export function withDocumentWriteLock(documentId, operation) {
    const previousWrite = documentWriteQueues.get(documentId) ?? Promise.resolve();

    const currentWrite = previousWrite
        .catch(() => { })
        .then(operation);

    documentWriteQueues.set(documentId, currentWrite);

    return currentWrite.finally(() => {
        // Remove only if this is still the latest queued write.
        if (documentWriteQueues.get(documentId) === currentWrite) {
            documentWriteQueues.delete(documentId);
        }
    });
}

export function cleanupDocumentState(documentId) {
    // Cancel pending autosave
    const timer = saveTimers.get(documentId);

    if (timer) {
        clearTimeout(timer);
        saveTimers.delete(documentId);
    }

    // Remove active users
    activeUsers.delete(documentId);

    // Remove document generation
    documentGenerations.delete(documentId);
}