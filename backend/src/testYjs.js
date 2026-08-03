import * as Y from "yjs";

const doc1 = new Y.Doc();
const doc2 = new Y.Doc();

const text1 = doc1.getText("editor");
const text2 = doc2.getText("editor");

doc1.on("update", (update) => {
    Y.applyUpdate(doc2, update);
});

text1.insert(0, "Hello");

console.log(text1.toString());
console.log(text2.toString());
