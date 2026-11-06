import { useEffect, useRef, useMemo } from "react";
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
   * 1. Create Y.Doc
   * ---------------------------------------------
   */

  const ydoc = useMemo(
    () => createYDoc(),
    [documentId]
  );

  /*
   * ---------------------------------------------
   * 2. Create Awareness
   * ---------------------------------------------
   */

  const awareness = useMemo(
    () => createAwareness(ydoc),
    [ydoc]
  );

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

  return { editor, ydoc, awareness };
}