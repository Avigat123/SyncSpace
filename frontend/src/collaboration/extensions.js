import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";

export function createCollaborativeExtensions(ydoc) {
  return [
    StarterKit.configure({
      //disable undoRedo as We don't want TipTap History+ Yjs history fighting each other.
      undoRedo: false,  
    }),

    Collaboration.configure({
      document: ydoc,
    }),
  ];
}