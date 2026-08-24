import { EditorContent } from "@tiptap/react";
import useCollaborativeEditor from "../../hooks/useCollaborativeEditor";

export default function Editor({ documentId }) {
  const { editor } = useCollaborativeEditor(documentId);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return <EditorContent editor={editor} />;
}