import { useEffect, useRef } from "react";
import { useEditor } from "@tiptap/react";

import { createYDoc } from "../collaboration/ydoc";
import { createAwareness } from "../collaboration/awareness";

import { createCollaborativeExtensions, getUserColor } from "../collaboration/extensions";
import { createSocketProvider } from "../collaboration/socketProvider";

import socket from "../services/socket";
import useAuth from "./useAuth";

export default function useCollaborativeEditor(documentId, role) {

  const { user } = useAuth();

  /*
   * ---------------------------------------------
   * 1. Create or retrieve active Y.Doc
   * ---------------------------------------------
   */

  const ydocRef = useRef(null);
  const currentDocIdRef = useRef(null);

  // If documentId changed or ydoc is missing / destroyed, create a fresh Y.Doc
  if (!ydocRef.current || ydocRef.current.destroyed || currentDocIdRef.current !== documentId) {
    if (ydocRef.current && !ydocRef.current.destroyed) {
      ydocRef.current.destroy();
    }
    ydocRef.current = createYDoc();
    currentDocIdRef.current = documentId;
  }

  const ydoc = ydocRef.current;

  /*
   * ---------------------------------------------
   * 2. Create or retrieve active Awareness
   * ---------------------------------------------
   */

  const awarenessRef = useRef(null);
  if (!awarenessRef.current || awarenessRef.current.doc !== ydoc || ydoc.destroyed) {
    if (awarenessRef.current) {
      awarenessRef.current.destroy();
    }
    awarenessRef.current = createAwareness(ydoc);
  }

  const awareness = awarenessRef.current;

  // Diagnostic: log awareness states on every change
  useEffect(() => {
    if (!awareness) return;
    const onUpdate = () => {
      console.log("👀 AWARENESS STATES:", awareness.getStates());
    };
    awareness.on("update", onUpdate);
    return () => awareness.off("update", onUpdate);
  }, [awareness]);



  /*
   * ---------------------------------------------
   * 3. Set local user information
   * ---------------------------------------------
   */

  useEffect(() => {

    if (!user || !awareness) return;

    if (awareness.getLocalState() === null) {
      awareness.setLocalState({});
    }

    awareness.setLocalStateField("user", {
      id: user._id,
      name: user.name,
      color: getUserColor(user._id),
    });

  }, [user, awareness]);


  /*
   * ---------------------------------------------
   * 4. Socket Provider
   * ---------------------------------------------
   */

  const providerRef = useRef(null);

  useEffect(() => {

    if (!documentId || ydoc.destroyed) {
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const provider = createSocketProvider({ socket, ydoc, awareness, documentId });

    providerRef.current = provider;

    return () => {

      provider.destroy();

      providerRef.current = null;

    };

  }, [
    documentId,
    ydoc,
    awareness,
  ]);


  /*
   * ---------------------------------------------
   * 5. TipTap Editor
   * ---------------------------------------------
   */


  const editor = useEditor(
    {
      extensions: createCollaborativeExtensions(
        ydoc,
        awareness,
        user
      ),
      autofocus: "end",
      editable: role !== "viewer",
      shouldRerenderOnTransaction: true,
    },
    [
      documentId,
      ydoc,
      awareness,
      user,
    ]
  );

  useEffect(() => {
    if (!editor) return;

    editor.setEditable(role !== "viewer");
  }, [editor, role]);


  /*
   * ---------------------------------------------
   * 6. Editor cleanup
   * ---------------------------------------------
   */

  useEffect(() => {

    return () => {

      if (editor) {
        editor.destroy();
      }

    };

  }, [editor]);

  // Clean up Y.Doc and Awareness when hook unmounts or documentId changes
  useEffect(() => {
    return () => {
      if (awarenessRef.current) {
        awarenessRef.current.destroy();
        awarenessRef.current = null;
      }
      if (ydocRef.current && !ydocRef.current.destroyed) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
    };
  }, [documentId]);

  return { editor, ydoc, awareness };
}