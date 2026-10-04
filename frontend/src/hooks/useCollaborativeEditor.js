import { useEffect, useRef, useMemo } from "react";
import { useEditor } from "@tiptap/react";

import { createYDoc } from "../collaboration/ydoc";
import {
  createAwareness,
  destroyAwareness,
} from "../collaboration/awareness";

import { createCollaborativeExtensions } from "../collaboration/extensions";
import { createSocketProvider } from "../collaboration/socketProvider";

import socket from "../services/socket";
import useAuth from "./useAuth";

export default function useCollaborativeEditor(documentId) {

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



  /*
   * ---------------------------------------------
   * 3. Set local user information
   * ---------------------------------------------
   */

  useEffect(() => {

    if (!user || !awareness) return;

    awareness.setLocalStateField("user", {
      id: user._id,
      name: user.name,
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

    const provider = createSocketProvider({
      socket,
      ydoc,
      awareness,
      documentId,
    });

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
    },
    [
      ydoc,
      awareness,
      user,
    ]
  );




  /*
   * ---------------------------------------------
   * 7. Editor cleanup
   * ---------------------------------------------
   */

  useEffect(() => {

    return () => {

      if (editor) {
        editor.destroy();
      }

    };

  }, [editor]);


  /*
   * ---------------------------------------------
   * 8. Awareness cleanup
   * ---------------------------------------------
   */

  useEffect(() => {

    return () => {

      destroyAwareness(
        awareness
      );

    };

  }, [awareness]);


  return {
    editor,
    ydoc,
    awareness,
  };
}