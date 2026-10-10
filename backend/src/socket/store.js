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