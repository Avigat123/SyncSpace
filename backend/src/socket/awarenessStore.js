import { Awareness } from "y-protocols/awareness";
import { getYDoc } from "./yjsStore.js";

const awarenessMap = new Map();

export function getAwareness(documentId) {

    if (!awarenessMap.has(documentId)) {

        const ydoc = getYDoc(documentId);

        awarenessMap.set(
            documentId,
            new Awareness(ydoc)
        );

    }

    return awarenessMap.get(documentId);

}

export function removeAwareness(documentId) {
    awarenessMap.delete(documentId);
}