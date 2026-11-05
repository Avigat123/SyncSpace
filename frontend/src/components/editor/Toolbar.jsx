import { useState } from "react";

export default function Toolbar({ editor }) {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);

  if (!editor) return null;

  const currentBlockType = () => {
    if (editor.isActive("heading", { level: 1 })) return "Heading 1";
    if (editor.isActive("heading", { level: 2 })) return "Heading 2";
    if (editor.isActive("heading", { level: 3 })) return "Heading 3";
    if (editor.isActive("codeBlock")) return "Code Block";
    if (editor.isActive("blockquote")) return "Quote";
    return "Paragraph";
  };

  const wordCount = editor.getText() ? editor.getText().trim().split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="sticky top-28 z-20 w-full flex justify-center px-4 py-2 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1 bg-surface-container-lowest border border-[#E8E8E5] px-3 py-1.5 rounded-full shadow-lg max-w-full overflow-x-auto">
        {/* Block Type Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHeadingMenu(!showHeadingMenu)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>{currentBlockType()}</span>
            <span className="material-symbols-outlined text-[16px] text-outline">
              arrow_drop_down
            </span>
          </button>

          {showHeadingMenu && (
            <div className="absolute left-0 top-full mt-1.5 w-40 bg-surface-container-lowest border border-[#E8E8E5] rounded-xl shadow-lg p-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().setParagraph().run();
                  setShowHeadingMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md font-body-sm text-body-sm hover:bg-surface-container transition-colors ${
                  editor.isActive("paragraph") ? "text-primary font-medium" : "text-on-surface"
                }`}
              >
                Paragraph
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                  setShowHeadingMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md font-headline-md text-headline-md hover:bg-surface-container transition-colors ${
                  editor.isActive("heading", { level: 1 }) ? "text-primary font-semibold" : "text-on-surface"
                }`}
              >
                Heading 1
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                  setShowHeadingMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md font-headline-sm text-headline-sm hover:bg-surface-container transition-colors ${
                  editor.isActive("heading", { level: 2 }) ? "text-primary font-semibold" : "text-on-surface"
                }`}
              >
                Heading 2
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 3 }).run();
                  setShowHeadingMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md font-label-md text-label-md font-semibold hover:bg-surface-container transition-colors ${
                  editor.isActive("heading", { level: 3 }) ? "text-primary" : "text-on-surface"
                }`}
              >
                Heading 3
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#E8E8E5] mx-1"></div>

        {/* Inline Formatting */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`w-7 h-7 flex items-center justify-center rounded font-semibold text-sm transition-colors cursor-pointer ${
              editor.isActive("bold")
                ? "bg-primary-container text-on-primary font-bold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
            title="Bold (Ctrl+B)"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`w-7 h-7 flex items-center justify-center rounded italic text-sm transition-colors cursor-pointer ${
              editor.isActive("italic")
                ? "bg-primary-container text-on-primary font-bold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
            title="Italic (Ctrl+I)"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`w-7 h-7 flex items-center justify-center rounded line-through text-sm transition-colors cursor-pointer ${
              editor.isActive("strike")
                ? "bg-primary-container text-on-primary font-bold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
            title="Strikethrough"
          >
            S
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`w-7 h-7 flex items-center justify-center rounded font-mono text-xs transition-colors cursor-pointer ${
              editor.isActive("code")
                ? "bg-primary-container text-on-primary font-bold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
            title="Inline Code"
          >
            &lt;/&gt;
          </button>
        </div>

        <div className="h-4 w-px bg-[#E8E8E5] mx-1"></div>

        {/* Lists & Blocks */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1 rounded transition-colors cursor-pointer ${
              editor.isActive("bulletList")
                ? "bg-primary-container text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
            title="Bullet list"
          >
            <span className="material-symbols-outlined text-[18px]">
              format_list_bulleted
            </span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1 rounded transition-colors cursor-pointer ${
              editor.isActive("orderedList")
                ? "bg-primary-container text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
            title="Numbered list"
          >
            <span className="material-symbols-outlined text-[18px]">
              format_list_numbered
            </span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1 rounded transition-colors cursor-pointer ${
              editor.isActive("blockquote")
                ? "bg-primary-container text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
            title="Quote block"
          >
            <span className="material-symbols-outlined text-[18px]">
              format_quote
            </span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1 rounded transition-colors cursor-pointer ${
              editor.isActive("codeBlock")
                ? "bg-primary-container text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
            title="Code Block"
          >
            <span className="material-symbols-outlined text-[18px]">
              terminal
            </span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            title="Horizontal divider"
          >
            <span className="material-symbols-outlined text-[18px]">
              horizontal_rule
            </span>
          </button>
        </div>

        <div className="hidden sm:block h-4 w-px bg-[#E8E8E5] mx-1"></div>

        {/* Word Count Metric */}
        <div className="hidden sm:flex items-center px-2 py-0.5 rounded-full bg-surface-container text-outline font-code-sm text-code-sm select-none">
          {wordCount.toLocaleString()} words • {readingTime} min
        </div>
      </div>
    </div>
  );
}

