import { useEffect } from "react";
import { EditorContent } from "@tiptap/react";
import useCollaborativeEditor from "../../hooks/useCollaborativeEditor";
import Toolbar from "./Toolbar";

export default function Editor({ documentId, role, onAwarenessChange, onYDocReady }) {
  const { editor, ydoc, awareness } = useCollaborativeEditor(documentId, role);

  useEffect(() => {
    if (ydoc && onYDocReady) {
      onYDocReady(ydoc);
    }
  }, [ydoc, onYDocReady]);

  useEffect(() => {
    if (awareness && onAwarenessChange) {
      onAwarenessChange(awareness);
    }
  }, [awareness, onAwarenessChange]);

  if (!editor) {
    return (
      <div className="w-full min-h-[600px] flex flex-col items-center justify-center gap-3 py-20">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Connecting to Yjs collaboration room…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Floating TipTap Formatting Toolbar */}
      {role !== "viewer" && <Toolbar editor={editor} />}

      {/* Document Stage Canvas */}
      <div className="w-full flex justify-center px-4 md:px-margin py-space-md mb-space-xl">
        <div className="relative w-full max-w-[880px]">
          {/* Paper Sheet Canvas */}
          <div className="w-full bg-surface-container-lowest border border-[#E8E8E5] rounded-xl shadow-sm px-6 sm:px-12 md:px-16 py-12 min-h-[1000px] transition-all">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
