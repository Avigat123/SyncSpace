import { useEffect, useMemo } from "react";
import { useEditor } from "@tiptap/react";

import { createYDoc, destroyYDoc } from "../collaboration/ydoc";
import { createCollaborativeExtensions } from "../collaboration/extensions";
import { createSocketProvider } from "../collaboration/socketProvider";
import socket from "../services/socket";

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

  /*
   * Socket + Yjs synchronization
   */
  useEffect(() => {
    if (!documentId) return;

    if (!socket.connected) {
      socket.connect();
    }

    const provider = createSocketProvider({
      socket,
      ydoc,
      documentId,
    });

    return () => {
      provider.destroy();
    };
  }, [documentId, ydoc]);

  /*
   * Cleanup editor and Y.Doc
   */
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