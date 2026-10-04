import { Awareness } from "y-protocols/awareness";

export function createAwareness(ydoc) {
    return new Awareness(ydoc);
}

export function destroyAwareness(awareness) {
    awareness.destroy();
}