import { useEffect, useRef, useMemo } from "react";
import { useEditor } from "@tiptap/react";

import { createYDoc } from "../collaboration/ydoc";
import { createCollaborativeExtensions } from "../collaboration/extensions";
import { createSocketProvider } from "../collaboration/socketProvider";
import socket from "../services/socket";

export default function useCollaborativeEditor(documentId) {
  // One Y.Doc per documentId. Do NOT destroy it inside useEffect —
  // the ydoc must outlive the StrictMode fake-unmount cycle.
  const ydoc = useMemo(() => createYDoc(), [documentId]);

  const editor = useEditor(
    { extensions: createCollaborativeExtensions(ydoc) },
    [ydoc]
  );

  const providerRef = useRef(null);

  // Effect 1 — provider lifecycle (join room, Yjs listeners).
  // Does NOT touch the ydoc lifetime.
  useEffect(() => {
    if (!documentId || ydoc.destroyed) return;

    if (!socket.connected) {
      socket.connect();
    }

    const provider = createSocketProvider({ socket, ydoc, documentId });
    providerRef.current = provider;

    return () => {
      provider.destroy();
      providerRef.current = null;
    };
  }, [documentId, ydoc]);

  // Effect 2 — editor lifetime only.
  useEffect(() => {
    return () => {
      if (editor) editor.destroy();
    };
  }, [editor]);

  return { editor, ydoc };
}
