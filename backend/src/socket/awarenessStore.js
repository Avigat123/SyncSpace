import { Awareness } from "y-protocols/awareness";
import { getYDoc } from "./yjsStore.js";

const awarenessMap = new Map();

export async function getAwareness(documentId) {

    if (!awarenessMap.has(documentId)) {

        const ydoc = await getYDoc(documentId);

        awarenessMap.set(
            documentId,
            new Awareness(ydoc)
        );

    }

    return awarenessMap.get(documentId);

}

export function removeAwareness(documentId) {
    const awareness = awarenessMap.get(documentId);

    if (!awareness) return;

    awareness.destroy();
    awarenessMap.delete(documentId);
}