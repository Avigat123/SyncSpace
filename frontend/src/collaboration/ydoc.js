import * as Y from "yjs";

export function createYDoc() {
    return new Y.Doc();
}

export function destroyYDoc(ydoc) {
    ydoc.destroy();
}