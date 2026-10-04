import { EditorContent } from "@tiptap/react";
import useCollaborativeEditor from "../../hooks/useCollaborativeEditor";
import PresenceIndicator from "../collaboration/PresenceIndicator";

export default function Editor({ documentId }) {
  const { editor, awareness } = useCollaborativeEditor(documentId);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="editor-wrapper">

      <div className="editor-header">
        <PresenceIndicator awareness={awareness} />
      </div>

      <EditorContent editor={editor} />

    </div>
  );
}