import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import {
  Subscript,
  Superscript,
  TextStyle,
  TextAlign,
} from "./formattingExtensions";

const CURSOR_COLORS = [
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
];

export function getUserColor(userId) {
  if (!userId) return CURSOR_COLORS[0];
  const str = String(userId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export function createCollaborativeExtensions(
  ydoc,
  awareness,
  user
) {
  const userColor = getUserColor(user?._id);

  return [
    StarterKit.configure({
      undoRedo: false,
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
    }),

    Subscript,
    Superscript,
    TextStyle,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),

    Collaboration.configure({ document: ydoc }),

    CollaborationCaret.configure({
      provider: { awareness },

      user: {
        id: user?._id,
        name: user?.name || "Anonymous",
        color: userColor,
      },
    }),
  ];
}
