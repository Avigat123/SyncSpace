import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";

export function createCollaborativeExtensions(
  ydoc,
  awareness,
  user
) {
  return [StarterKit.configure({ undoRedo: false }),

  Collaboration.configure({ document: ydoc }),

  CollaborationCaret.configure({
    provider: { awareness },

    user: {
      id: user?._id,
      name: user?.name || "Anonymous",
      color: "#6366f1",
    },
  }),
  ];
}