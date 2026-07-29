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