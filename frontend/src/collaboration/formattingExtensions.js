import { Mark, Extension, mergeAttributes } from "@tiptap/react";

/**
 * Subscript mark: <sub>
 */
export const Subscript = Mark.create({
  name: "subscript",

  parseHTML() {
    return [{ tag: "sub" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sub", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleSubscript:
        () =>
          ({ commands, editor }) => {
            if (editor.isActive("superscript")) {
              commands.unsetMark("superscript");
            }
            return commands.toggleMark("subscript");
          },
      setSubscript:
        () =>
          ({ commands }) => {
            commands.unsetMark("superscript");
            return commands.setMark("subscript");
          },
      unsetSubscript:
        () =>
          ({ commands }) =>
            commands.unsetMark("subscript"),
    };
  },
});

/**
 * Superscript mark: <sup>
 */
export const Superscript = Mark.create({
  name: "superscript",

  parseHTML() {
    return [{ tag: "sup" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleSuperscript:
        () =>
          ({ commands, editor }) => {
            if (editor.isActive("subscript")) {
              commands.unsetMark("subscript");
            }
            return commands.toggleMark("superscript");
          },
      setSuperscript:
        () =>
          ({ commands }) => {
            commands.unsetMark("subscript");
            return commands.setMark("superscript");
          },
      unsetSuperscript:
        () =>
          ({ commands }) =>
            commands.unsetMark("superscript"),
    };
  },
});

/**
 * TextStyle mark: <span> with color & fontSize attributes and commands
 */
export const TextStyle = Mark.create({
  name: "textStyle",

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style?.color || null,
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return { style: `color: ${attributes.color}` };
        },
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style?.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (element) => {
          const hasColor = element.style?.color;
          const hasFontSize = element.style?.fontSize;
          return hasColor || hasFontSize ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setColor:
        (color) =>
          ({ commands }) => {
            return commands.setMark("textStyle", { color });
          },
      unsetColor:
        () =>
          ({ commands, editor }) => {
            const currentAttrs = editor.getAttributes("textStyle") || {};
            if (!currentAttrs.fontSize) {
              return commands.unsetMark("textStyle");
            }
            return commands.resetAttributes("textStyle", "color");
          },
      setFontSize:
        (fontSize) =>
          ({ commands }) => {
            return commands.setMark("textStyle", { fontSize });
          },
      unsetFontSize:
        () =>
          ({ commands, editor }) => {
            const currentAttrs = editor.getAttributes("textStyle") || {};
            if (!currentAttrs.color) {
              return commands.unsetMark("textStyle");
            }
            return commands.resetAttributes("textStyle", "fontSize");
          },
    };
  },
});

/**
 * TextAlign extension: sets text-align on block nodes (paragraph, heading)
 */
export const TextAlign = Extension.create({
  name: "textAlign",

  addOptions() {
    return {
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right", "justify"],
      defaultAlignment: "left",
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (element) =>
              element.style?.textAlign || this.options.defaultAlignment,
            renderHTML: (attributes) => {
              if (
                !attributes.textAlign ||
                attributes.textAlign === this.options.defaultAlignment
              ) {
                return {};
              }
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
          ({ commands }) => {
            if (!this.options.alignments.includes(alignment)) {
              return false;
            }
            return this.options.types
              .map((type) =>
                commands.updateAttributes(type, { textAlign: alignment })
              )
              .some((res) => res);
          },
      unsetTextAlign:
        () =>
          ({ commands }) => {
            return this.options.types
              .map((type) => commands.resetAttributes(type, "textAlign"))
              .some((res) => res);
          },
    };
  },
});
