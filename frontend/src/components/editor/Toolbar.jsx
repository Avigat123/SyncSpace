import { useState, useRef, useEffect, useCallback } from "react";

const FONT_FAMILIES = [
  {
    label: "Inter (Sans-serif)",
    value: "Inter, ui-sans-serif, system-ui, sans-serif",
    shortName: "Inter",
    fontClass: "font-sans",
  },
  {
    label: "Newsreader (Serif)",
    value: "Newsreader, Georgia, serif",
    shortName: "Newsreader",
    fontClass: "font-serif",
  },
  {
    label: "JetBrains Mono (Code)",
    value: '"JetBrains Mono", ui-monospace, monospace',
    shortName: "JetBrains Mono",
    fontClass: "font-mono",
  },
  {
    label: "Arial",
    value: "Arial, Helvetica, sans-serif",
    shortName: "Arial",
    fontClass: "font-sans",
  },
  {
    label: "Georgia",
    value: "Georgia, serif",
    shortName: "Georgia",
    fontClass: "font-serif",
  },
  {
    label: "Times New Roman",
    value: '"Times New Roman", Times, serif',
    shortName: "Times New Roman",
    fontClass: "font-serif",
  },
  {
    label: "Courier New",
    value: '"Courier New", Courier, monospace',
    shortName: "Courier New",
    fontClass: "font-mono",
  },
  {
    label: "Verdana",
    value: "Verdana, Geneva, sans-serif",
    shortName: "Verdana",
    fontClass: "font-sans",
  },
  {
    label: "Trebuchet MS",
    value: '"Trebuchet MS", sans-serif',
    shortName: "Trebuchet MS",
    fontClass: "font-sans",
  },
  {
    label: "Comic Sans MS",
    value: '"Comic Sans MS", cursive, sans-serif',
    shortName: "Comic Sans",
    fontClass: "font-sans",
  },
];

const PRESET_FONT_SIZES = [
  { label: "8px", value: "8px" },
  { label: "9px", value: "9px" },
  { label: "10px", value: "10px" },
  { label: "11px", value: "11px" },
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
  { label: "28px", value: "28px" },
  { label: "32px", value: "32px" },
  { label: "36px", value: "36px" },
  { label: "48px", value: "48px" },
  { label: "72px", value: "72px" },
];

export default function Toolbar({ editor }) {
  const [activeMenu, setActiveMenu] = useState(null); // 'heading' | 'fontFamily' | 'fontSize' | 'color' | null
  const [tick, setTick] = useState(0);
  const [fontSizeInput, setFontSizeInput] = useState("14");
  const toolbarRef = useRef(null);

  // Re-render reactively on any editor transaction or selection update
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setTick((t) => t + 1);
    };

    editor.on("transaction", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);
    editor.on("update", handleUpdate);
    editor.on("focus", handleUpdate);
    editor.on("blur", handleUpdate);

    return () => {
      editor.off("transaction", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
      editor.off("update", handleUpdate);
      editor.off("focus", handleUpdate);
      editor.off("blur", handleUpdate);
    };
  }, [editor]);

  // Keep font size input in sync with current cursor/selection
  useEffect(() => {
    if (!editor) return;
    const raw = editor.getAttributes("textStyle")?.fontSize;
    if (raw) {
      const parsed = parseInt(raw, 10);
      setFontSizeInput(isNaN(parsed) ? "14" : String(parsed));
    } else {
      setFontSizeInput("14");
    }
  }, [editor, tick]);

  // Close dropdown menus when clicking outside the toolbar
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  if (!editor) return null;

  // Active heading/block label
  const currentHeadingType = () => {
    if (editor.isActive("heading", { level: 1 })) return "Heading 1";
    if (editor.isActive("heading", { level: 2 })) return "Heading 2";
    if (editor.isActive("heading", { level: 3 })) return "Heading 3";
    if (editor.isActive("heading", { level: 4 })) return "Heading 4";
    if (editor.isActive("heading", { level: 5 })) return "Heading 5";
    if (editor.isActive("heading", { level: 6 })) return "Heading 6";
    if (editor.isActive("codeBlock")) return "Code Block";
    if (editor.isActive("blockquote")) return "Quote";
    return "Normal text";
  };

  const isAnyHeadingActive = () => {
    return [1, 2, 3, 4, 5, 6].some((l) => editor.isActive("heading", { level: l }));
  };

  // Font family helper
  const getCurrentFontFamilyName = () => {
    const raw = editor.getAttributes("textStyle")?.fontFamily;
    if (!raw) return "Font";
    const found = FONT_FAMILIES.find((f) =>
      raw.toLowerCase().includes(f.shortName.toLowerCase())
    );
    return found ? found.shortName : "Font";
  };

  // Font size helpers
  const getCurrentFontSizeNum = () => {
    const raw = editor.getAttributes("textStyle")?.fontSize;
    if (!raw) return 14;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 14 : parsed;
  };

  // Constant increment: exactly +1
  const handleIncreaseFontSize = () => {
    const current = getCurrentFontSizeNum();
    const next = Math.min(200, current + 1);
    setFontSizeInput(String(next));
    editor.chain().focus().setFontSize(`${next}px`).run();
    setTick((t) => t + 1);
  };

  // Constant decrement: exactly -1
  const handleDecreaseFontSize = () => {
    const current = getCurrentFontSizeNum();
    const prev = Math.max(6, current - 1);
    setFontSizeInput(String(prev));
    editor.chain().focus().setFontSize(`${prev}px`).run();
    setTick((t) => t + 1);
  };

  // Apply typed font size from input
  const applyTypedFontSize = (val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      setFontSizeInput(String(getCurrentFontSizeNum()));
      return;
    }
    const clamped = Math.min(200, Math.max(6, num));
    setFontSizeInput(String(clamped));
    editor.chain().focus().setFontSize(`${clamped}px`).run();
    setTick((t) => t + 1);
  };

  // Text color helper
  const currentColor = () => {
    const attrs = editor.getAttributes("textStyle");
    return attrs?.color || null;
  };

  // Alignment helper
  const isAlignActive = (align) => {
    if (align === "left") {
      return (
        editor.isActive({ textAlign: "left" }) ||
        (!editor.isActive({ textAlign: "center" }) &&
          !editor.isActive({ textAlign: "right" }) &&
          !editor.isActive({ textAlign: "justify" }))
      );
    }
    return editor.isActive({ textAlign: align });
  };

  const getBtnClass = (isActive) =>
    `w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer select-none active:scale-95 ${
      isActive
        ? "bg-primary text-white shadow-xs font-bold ring-1 ring-primary/40"
        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
    }`;

  const paletteColors = [
    { label: "Default", value: null },
    { label: "Black", value: "#000000" },
    { label: "Dark Gray", value: "#4b5563" },
    { label: "Slate", value: "#64748b" },
    { label: "Red", value: "#dc2626" },
    { label: "Rose", value: "#e11d48" },
    { label: "Orange", value: "#ea580c" },
    { label: "Amber", value: "#d97706" },
    { label: "Green", value: "#16a34a" },
    { label: "Emerald", value: "#059669" },
    { label: "Teal", value: "#0d9488" },
    { label: "Blue", value: "#2563eb" },
    { label: "Indigo", value: "#4f46e5" },
    { label: "Purple", value: "#9333ea" },
    { label: "Pink", value: "#db2777" },
  ];

  const wordCount = editor.getText()
    ? editor.getText().trim().split(/\s+/).filter(Boolean).length
    : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const headingOptions = [
    {
      level: 0,
      label: "Normal text",
      shortcut: "Ctrl+Alt+0",
      action: () => editor.chain().focus().setParagraph().run(),
      isActive: () => editor.isActive("paragraph") && !isAnyHeadingActive(),
      style: "text-sm font-normal",
    },
    {
      level: 1,
      label: "Heading 1",
      shortcut: "Ctrl+Alt+1",
      action: () => editor.chain().focus().setHeading({ level: 1 }).run(),
      isActive: () => editor.isActive("heading", { level: 1 }),
      style: "text-lg font-bold",
    },
    {
      level: 2,
      label: "Heading 2",
      shortcut: "Ctrl+Alt+2",
      action: () => editor.chain().focus().setHeading({ level: 2 }).run(),
      isActive: () => editor.isActive("heading", { level: 2 }),
      style: "text-base font-bold",
    },
    {
      level: 3,
      label: "Heading 3",
      shortcut: "Ctrl+Alt+3",
      action: () => editor.chain().focus().setHeading({ level: 3 }).run(),
      isActive: () => editor.isActive("heading", { level: 3 }),
      style: "text-sm font-semibold",
    },
    {
      level: 4,
      label: "Heading 4",
      shortcut: "Ctrl+Alt+4",
      action: () => editor.chain().focus().setHeading({ level: 4 }).run(),
      isActive: () => editor.isActive("heading", { level: 4 }),
      style: "text-xs font-semibold",
    },
    {
      level: 5,
      label: "Heading 5",
      shortcut: "Ctrl+Alt+5",
      action: () => editor.chain().focus().setHeading({ level: 5 }).run(),
      isActive: () => editor.isActive("heading", { level: 5 }),
      style: "text-xs font-medium",
    },
    {
      level: 6,
      label: "Heading 6",
      shortcut: "Ctrl+Alt+6",
      action: () => editor.chain().focus().setHeading({ level: 6 }).run(),
      isActive: () => editor.isActive("heading", { level: 6 }),
      style: "text-xs uppercase font-medium tracking-wider",
    },
  ];

  return (
    <div
      ref={toolbarRef}
      className="sticky top-20 z-40 w-full flex justify-center px-2 sm:px-4 py-2 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 bg-surface-container-lowest/95 backdrop-blur-md border border-[#E8E8E5] px-2.5 sm:px-3.5 py-1.5 rounded-2xl shadow-xl max-w-full overflow-visible select-none">
        {/* 1. Paragraph / Heading Dropdown */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              setActiveMenu(activeMenu === "heading" ? null : "heading")
            }
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-container/60 hover:bg-surface-container text-on-surface border border-[#E8E8E5] transition-colors cursor-pointer whitespace-nowrap text-xs font-medium"
            title="Paragraph & Heading Style"
          >
            <span className="material-symbols-outlined text-[17px] text-outline">
              format_size
            </span>
            <span className="font-semibold">{currentHeadingType()}</span>
            <span className="material-symbols-outlined text-[15px] text-outline">
              arrow_drop_down
            </span>
          </button>

          {activeMenu === "heading" && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-surface-bright border border-[#E8E8E5] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-0.5">
              {headingOptions.map((opt, idx) => {
                const active = opt.isActive();
                return (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      opt.action();
                      setActiveMenu(null);
                      setTick((t) => t + 1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-surface-container transition-colors flex items-center justify-between cursor-pointer ${
                      active
                        ? "text-primary font-bold bg-primary/10"
                        : "text-on-surface"
                    }`}
                  >
                    <span className={opt.style}>{opt.label}</span>
                    {active && (
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#E8E8E5] mx-0.5"></div>

        {/* 2. Font Family Dropdown */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              setActiveMenu(activeMenu === "fontFamily" ? null : "fontFamily")
            }
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-container/60 hover:bg-surface-container text-on-surface border border-[#E8E8E5] transition-colors cursor-pointer whitespace-nowrap text-xs font-medium max-w-[120px]"
            title="Font Family"
          >
            <span className="truncate font-semibold">{getCurrentFontFamilyName()}</span>
            <span className="material-symbols-outlined text-[15px] text-outline">
              arrow_drop_down
            </span>
          </button>

          {activeMenu === "fontFamily" && (
            <div className="absolute left-0 top-full mt-2 w-60 bg-surface-bright border border-[#E8E8E5] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-80 overflow-y-auto space-y-0.5">
              {FONT_FAMILIES.map((font, idx) => {
                const active =
                  editor.getAttributes("textStyle")?.fontFamily === font.value;
                return (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().setFontFamily(font.value).run();
                      setActiveMenu(null);
                      setTick((t) => t + 1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-surface-container transition-colors flex items-center justify-between cursor-pointer ${
                      active
                        ? "text-primary font-bold bg-primary/10"
                        : "text-on-surface"
                    }`}
                  >
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                    {active && (
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        check
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="h-px bg-[#E8E8E5] my-1"></div>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetFontFamily().run();
                  setActiveMenu(null);
                  setTick((t) => t + 1);
                }}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                Reset default font
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#E8E8E5] mx-0.5"></div>

        {/* 3. Font Size Controls: [-] [ Input ] [ v ] [+] */}
        <div className="flex items-center bg-surface-container/60 rounded-xl p-0.5 border border-[#E8E8E5]">
          {/* Constant decrement button (-1px) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleDecreaseFontSize}
            className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-on-surface hover:bg-surface-container text-sm font-bold transition-colors cursor-pointer active:scale-95"
            title="Decrease font size by 1px"
            aria-label="Decrease font size"
          >
            <span className="material-symbols-outlined text-[16px]">remove</span>
          </button>

          {/* Editable font size input (users can write the size directly) */}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={fontSizeInput}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              setFontSizeInput(val);
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applyTypedFontSize(fontSizeInput);
                e.currentTarget.blur();
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                handleIncreaseFontSize();
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                handleDecreaseFontSize();
              }
            }}
            onBlur={() => {
              applyTypedFontSize(fontSizeInput);
            }}
            className="w-7 sm:w-8 h-6 sm:h-7 text-center font-mono text-xs font-semibold bg-transparent text-on-surface focus:bg-surface-bright focus:ring-1 focus:ring-primary/50 rounded outline-none transition-all cursor-text"
            title="Type font size and press Enter"
          />

          {/* Preset dropdown trigger arrow */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                setActiveMenu(activeMenu === "fontSize" ? null : "fontSize")
              }
              className="h-6 sm:h-7 px-0.5 flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container rounded transition-colors cursor-pointer"
              title="Font Size Presets"
            >
              <span className="material-symbols-outlined text-[14px]">
                arrow_drop_down
              </span>
            </button>

            {/* Font size presets menu */}
            {activeMenu === "fontSize" && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-36 bg-surface-bright border border-[#E8E8E5] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-semibold text-outline uppercase tracking-wider">
                  Presets
                </div>
                {PRESET_FONT_SIZES.map((size) => {
                  const num = parseInt(size.value, 10);
                  const active = getCurrentFontSizeNum() === num;
                  return (
                    <button
                      key={size.value}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setFontSizeInput(String(num));
                        editor.chain().focus().setFontSize(size.value).run();
                        setActiveMenu(null);
                        setTick((t) => t + 1);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-surface-container transition-colors flex items-center justify-between cursor-pointer ${
                        active
                          ? "text-primary font-bold bg-primary/10"
                          : "text-on-surface"
                      }`}
                    >
                      <span className="font-mono">{size.label}</span>
                      {active && (
                        <span className="material-symbols-outlined text-[14px] text-primary">
                          check
                        </span>
                      )}
                    </button>
                  );
                })}

                <div className="h-px bg-[#E8E8E5] my-1"></div>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setFontSizeInput("14");
                    editor.chain().focus().unsetFontSize().run();
                    setActiveMenu(null);
                    setTick((t) => t + 1);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Reset default
                </button>
              </div>
            )}
          </div>

          {/* Constant increment button (+1px) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleIncreaseFontSize}
            className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-on-surface hover:bg-surface-container text-sm font-bold transition-colors cursor-pointer active:scale-95"
            title="Increase font size by 1px"
            aria-label="Increase font size"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
        </div>

        <div className="h-4 w-px bg-[#E8E8E5] mx-0.5"></div>

        {/* 4. Text Color Picker */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              setActiveMenu(activeMenu === "color" ? null : "color")
            }
            className={`flex flex-col items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg transition-colors cursor-pointer select-none ${
              currentColor()
                ? "bg-surface-container ring-1 ring-primary/40 font-bold"
                : "text-on-surface hover:bg-surface-container"
            }`}
            title="Text Color"
          >
            <span className="text-xs sm:text-sm font-bold leading-none">A</span>
            <span
              className="w-3.5 sm:w-4 h-1 rounded-full mt-0.5"
              style={{
                backgroundColor: currentColor() || "var(--color-on-surface)",
              }}
            ></span>
          </button>

          {activeMenu === "color" && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-surface-bright border border-[#E8E8E5] rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2.5">
              <div className="text-xs font-semibold text-on-surface">
                Text Color
              </div>

              {/* Preset swatches grid */}
              <div className="grid grid-cols-5 gap-1.5">
                {paletteColors.map((col, idx) => {
                  const isSelected =
                    (!col.value && !currentColor()) ||
                    (col.value && currentColor() === col.value);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (col.value) {
                          editor.chain().focus().setColor(col.value).run();
                        } else {
                          editor.chain().focus().unsetColor().run();
                        }
                        setActiveMenu(null);
                        setTick((t) => t + 1);
                      }}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center hover:scale-110 transition-transform cursor-pointer relative ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/40 shadow-xs"
                          : "border-[#E8E8E5]"
                      }`}
                      style={{
                        backgroundColor: col.value || "transparent",
                      }}
                      title={col.label}
                    >
                      {!col.value && (
                        <span className="material-symbols-outlined text-[14px] text-outline">
                          format_color_reset
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="h-px bg-[#E8E8E5]"></div>

              {/* Custom Color Input */}
              <label className="flex items-center justify-between text-xs text-on-surface cursor-pointer">
                <span>Custom color:</span>
                <input
                  type="color"
                  value={currentColor() || "#000000"}
                  onChange={(e) => {
                    editor.chain().focus().setColor(e.target.value).run();
                    setTick((t) => t + 1);
                  }}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
              </label>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#E8E8E5] mx-0.5"></div>

        {/* 5. Inline Marks: Bold, Italic, Underline, Strike, Sub, Super, Code */}
        <div className="flex items-center gap-0.5">
          {/* Bold */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleBold().run();
              setTick((t) => t + 1);
            }}
            className={getBtnClass(editor.isActive("bold"))}
            title="Bold (Ctrl+B)"
          >
            B
          </button>

          {/* Italic */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleItalic().run();
              setTick((t) => t + 1);
            }}
            className={`${getBtnClass(editor.isActive("italic"))} italic`}
            title="Italic (Ctrl+I)"
          >
            I
          </button>

          {/* Underline */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleUnderline().run();
              setTick((t) => t + 1);
            }}
            className={`${getBtnClass(editor.isActive("underline"))} underline underline-offset-2`}
            title="Underline (Ctrl+U)"
          >
            U
          </button>

          {/* Strikethrough */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleStrike().run();
              setTick((t) => t + 1);
            }}
            className={`${getBtnClass(editor.isActive("strike"))} line-through`}
            title="Strikethrough"
          >
            S
          </button>

          {/* Subscript */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleSubscript().run();
              setTick((t) => t + 1);
            }}
            className={`${getBtnClass(editor.isActive("subscript"))} font-mono`}
            title="Subscript (X₂)"
          >
            <span className="flex items-baseline">
              <span>X</span>
              <span className="text-[9px] -mb-0.5">2</span>
            </span>
          </button>

          {/* Superscript */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleSuperscript().run();
              setTick((t) => t + 1);
            }}
            className={`${getBtnClass(editor.isActive("superscript"))} font-mono`}
            title="Superscript (X²)"
          >
            <span className="flex items-baseline">
              <span>X</span>
              <span className="text-[9px] -mt-1">2</span>
            </span>
          </button>

          {/* Inline Code */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleCode().run();
              setTick((t) => t + 1);
            }}
            className={`${getBtnClass(editor.isActive("code"))} font-mono text-[11px]`}
            title="Inline Code"
          >
            &lt;/&gt;
          </button>
        </div>

        <div className="h-4 w-px bg-[#E8E8E5] mx-0.5"></div>

        {/* 6. Text Alignment Group: Left, Center, Right, Justify */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().setTextAlign("left").run();
              setTick((t) => t + 1);
            }}
            className={getBtnClass(isAlignActive("left"))}
            title="Align Left"
          >
            <span className="material-symbols-outlined text-[17px]">
              format_align_left
            </span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().setTextAlign("center").run();
              setTick((t) => t + 1);
            }}
            className={getBtnClass(isAlignActive("center"))}
            title="Align Center"
          >
            <span className="material-symbols-outlined text-[17px]">
              format_align_center
            </span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().setTextAlign("right").run();
              setTick((t) => t + 1);
            }}
            className={getBtnClass(isAlignActive("right"))}
            title="Align Right"
          >
            <span className="material-symbols-outlined text-[17px]">
              format_align_right
            </span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().setTextAlign("justify").run();
              setTick((t) => t + 1);
            }}
            className={getBtnClass(isAlignActive("justify"))}
            title="Align Justify"
          >
            <span className="material-symbols-outlined text-[17px]">
              format_align_justify
            </span>
          </button>
        </div>

        <div className="h-4 w-px bg-[#E8E8E5] mx-0.5"></div>

        {/* 7. Lists, Quotes & Divider */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleBulletList().run();
              setTick((t) => t + 1);
            }}
            className={getBtnClass(editor.isActive("bulletList"))}
            title="Bullet List"
          >
            <span className="material-symbols-outlined text-[17px]">
              format_list_bulleted
            </span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleOrderedList().run();
              setTick((t) => t + 1);
            }}
            className={getBtnClass(editor.isActive("orderedList"))}
            title="Numbered List"
          >
            <span className="material-symbols-outlined text-[17px]">
              format_list_numbered
            </span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleBlockquote().run();
              setTick((t) => t + 1);
            }}
            className={getBtnClass(editor.isActive("blockquote"))}
            title="Quote Block"
          >
            <span className="material-symbols-outlined text-[17px]">
              format_quote
            </span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().toggleCodeBlock().run();
              setTick((t) => t + 1);
            }}
            className={getBtnClass(editor.isActive("codeBlock"))}
            title="Code Block"
          >
            <span className="material-symbols-outlined text-[17px]">
              terminal
            </span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().setHorizontalRule().run();
              setTick((t) => t + 1);
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer select-none active:scale-95"
            title="Horizontal Divider"
          >
            <span className="material-symbols-outlined text-[17px]">
              horizontal_rule
            </span>
          </button>
        </div>

        <div className="hidden lg:block h-4 w-px bg-[#E8E8E5] mx-1"></div>

        {/* 8. Word Count & Reading Metric */}
        <div className="hidden lg:flex items-center px-2.5 py-0.5 rounded-full bg-surface-container text-outline font-code-sm text-code-sm select-none text-[11px] whitespace-nowrap">
          {wordCount.toLocaleString()} words • {readingTime} min
        </div>
      </div>
    </div>
  );
}
