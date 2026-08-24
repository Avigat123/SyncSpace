import { useEffect, useMemo } from "react";
import { useEditor } from "@tiptap/react";
import { createYDoc, destroyYDoc } from "../collaboration/ydoc";
import { createCollaborativeExtensions } from "../collaboration/extensions";

export default function useCollaborativeEditor(documentId) {
  const ydoc = useMemo(() => {
    return createYDoc();
  }, [documentId]);

  const editor = useEditor(
    {
      extensions: createCollaborativeExtensions(ydoc),
    },
    [ydoc]
  );

  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }

      destroyYDoc(ydoc);
    };
  }, [editor, ydoc]);

  return {
    editor,
    ydoc,
  };
}