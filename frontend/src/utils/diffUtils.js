import * as Y from "yjs";

/**
 * Tokenize a text string into word, punctuation, and whitespace tokens.
 * Matches: \s+ | [^\s\w]+ | \w+
 */
export function tokenizeText(text) {
  if (!text) return [];
  const matches = text.match(/\s+|[^\s\w]+|\w+/g);
  return matches || [];
}

/**
 * Tokenize a sequence of runs [{ text, marks }] into tokens with their inherited marks.
 */
export function tokenizeRuns(runs) {
  if (!runs || runs.length === 0) return [];
  const tokens = [];

  for (const run of runs) {
    const text = run.text || "";
    const marks = run.marks || {};
    const parts = text.match(/\s+|[^\s\w]+|\w+/g) || [];
    for (const part of parts) {
      tokens.push({
        text: part,
        marks: { ...marks },
      });
    }
  }

  return tokens;
}

/**
 * Eugene Myers' Difference Algorithm (O(ND) time & space)
 * Returns the shortest edit script of deletions and insertions.
 */
export function myersDiff(a, b, equalsFn = (x, y) => x === y) {
  const N = a.length;
  const M = b.length;
  const max = N + M;

  if (max === 0) return [];

  const v = { 1: 0 };
  const trace = [];

  for (let d = 0; d <= max; d++) {
    const vCopy = { ...v };
    trace.push(vCopy);

    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && (v[k - 1] ?? -1) < (v[k + 1] ?? -1))) {
        x = v[k + 1];
      } else {
        x = v[k - 1] + 1;
      }

      let y = x - k;

      while (x < N && y < M && equalsFn(a[x], b[y])) {
        x++;
        y++;
      }

      v[k] = x;

      if (x >= N && y >= M) {
        return buildMyersScript(trace, a, b, x, y);
      }
    }
  }

  return [];
}

function buildMyersScript(trace, a, b, endX, endY) {
  const script = [];
  let x = endX;
  let y = endY;

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    let prevK;

    if (k === -d || (k !== d && (v[k - 1] ?? -1) < (v[k + 1] ?? -1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v[prevK];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      script.unshift({
        type: "equal",
        oldVal: a[x - 1],
        newVal: b[y - 1],
      });
      x--;
      y--;
    }

    if (d > 0) {
      if (x === prevX) {
        script.unshift({
          type: "insert",
          newVal: b[prevY],
        });
        y--;
      } else if (y === prevY) {
        script.unshift({
          type: "delete",
          oldVal: a[prevX],
        });
        x--;
      }
    }
  }

  return script;
}

/**
 * Extract formatted runs from a Yjs node recursively.
 */
function extractRunsFromYNode(node) {
  const runs = [];
  if (!node) return runs;

  if (node.toDelta) {
    const deltas = node.toDelta();
    for (const d of deltas) {
      if (typeof d.insert === "string") {
        runs.push({
          text: d.insert,
          marks: d.attributes || {},
        });
      }
    }
    return runs;
  }

  if (node.length !== undefined) {
    for (let i = 0; i < node.length; i++) {
      const child = node.get(i);
      runs.push(...extractRunsFromYNode(child));
    }
  }

  return runs;
}

/**
 * Extract structured blocks from a collaborative Y.Doc instance.
 */
export function extractBlocksFromYDoc(ydoc) {
  if (!ydoc) return [];
  const blocks = [];

  try {
    const fragment = ydoc.getXmlFragment("default");
    if (!fragment || fragment.length === 0) return [];

    for (let i = 0; i < fragment.length; i++) {
      const node = fragment.get(i);
      const nodeName = node.nodeName || "";

      if (nodeName === "paragraph") {
        const runs = extractRunsFromYNode(node);
        const text = runs.map((r) => r.text).join("");
        blocks.push({
          id: `p-${i}`,
          type: "paragraph",
          runs,
          text,
        });
      } else if (nodeName === "heading") {
        const level = Number(node.getAttribute("level")) || 1;
        const runs = extractRunsFromYNode(node);
        const text = runs.map((r) => r.text).join("");
        blocks.push({
          id: `h-${i}`,
          type: "heading",
          level,
          runs,
          text,
        });
      } else if (nodeName === "bulletList" || nodeName === "orderedList") {
        const isOrdered = nodeName === "orderedList";
        for (let j = 0; j < node.length; j++) {
          const item = node.get(j);
          const runs = extractRunsFromYNode(item);
          const text = runs.map((r) => r.text).join("");
          blocks.push({
            id: `list-${i}-${j}`,
            type: isOrdered ? "orderedListItem" : "bulletListItem",
            order: isOrdered ? j + 1 : undefined,
            runs,
            text,
          });
        }
      } else if (nodeName === "blockquote") {
        const runs = extractRunsFromYNode(node);
        const text = runs.map((r) => r.text).join("");
        blocks.push({
          id: `quote-${i}`,
          type: "blockquote",
          runs,
          text,
        });
      } else if (nodeName === "codeBlock") {
        const language = node.getAttribute("language") || "";
        const runs = extractRunsFromYNode(node);
        const text = runs.map((r) => r.text).join("");
        blocks.push({
          id: `code-${i}`,
          type: "codeBlock",
          language,
          runs,
          text,
        });
      } else if (nodeName === "horizontalRule") {
        blocks.push({
          id: `hr-${i}`,
          type: "horizontalRule",
          runs: [],
          text: "",
        });
      } else {
        // Fallback for generic XmlText or custom element
        const runs = extractRunsFromYNode(node);
        const text = runs.map((r) => r.text).join("");
        if (text.trim().length > 0) {
          blocks.push({
            id: `block-${i}`,
            type: "paragraph",
            runs,
            text,
          });
        }
      }
    }
  } catch (err) {
    console.error("Error extracting blocks from Y.Doc:", err);
  }

  return blocks;
}

/**
 * Extract formatted runs from a DOM element recursively.
 */
function extractRunsFromDom(element) {
  const runs = [];

  function traverse(node, currentMarks) {
    if (node.nodeType === 3) {
      // TEXT_NODE
      if (node.textContent) {
        runs.push({
          text: node.textContent,
          marks: { ...currentMarks },
        });
      }
      return;
    }

    if (node.nodeType === 1) {
      // ELEMENT_NODE
      const nextMarks = { ...currentMarks };
      const tag = node.tagName.toLowerCase();

      if (tag === "strong" || tag === "b") nextMarks.bold = true;
      if (tag === "em" || tag === "i") nextMarks.italic = true;
      if (tag === "u") nextMarks.underline = true;
      if (tag === "s" || tag === "strike" || tag === "del") nextMarks.strike = true;
      if (tag === "code") nextMarks.code = true;
      if (tag === "sub") nextMarks.subscript = true;
      if (tag === "sup") nextMarks.superscript = true;
      if (tag === "a") nextMarks.link = node.getAttribute("href");

      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i], nextMarks);
      }
    }
  }

  traverse(element, {});
  return runs;
}

/**
 * Extract structured blocks from HTML string using browser DOMParser.
 */
export function extractBlocksFromHtml(html) {
  if (!html || typeof html !== "string") return [];
  if (typeof DOMParser === "undefined") return [];

  const blocks = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const children = doc.body.children;

    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const tag = el.tagName.toLowerCase();

      if (tag === "p") {
        const runs = extractRunsFromDom(el);
        const text = runs.map((r) => r.text).join("");
        blocks.push({
          id: `html-p-${i}`,
          type: "paragraph",
          runs,
          text,
        });
      } else if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        const runs = extractRunsFromDom(el);
        const text = runs.map((r) => r.text).join("");
        blocks.push({
          id: `html-h-${i}`,
          type: "heading",
          level,
          runs,
          text,
        });
      } else if (tag === "ul" || tag === "ol") {
        const isOrdered = tag === "ol";
        const items = el.querySelectorAll(":scope > li");
        items.forEach((item, j) => {
          const runs = extractRunsFromDom(item);
          const text = runs.map((r) => r.text).join("");
          blocks.push({
            id: `html-list-${i}-${j}`,
            type: isOrdered ? "orderedListItem" : "bulletListItem",
            order: isOrdered ? j + 1 : undefined,
            runs,
            text,
          });
        });
      } else if (tag === "blockquote") {
        const runs = extractRunsFromDom(el);
        const text = runs.map((r) => r.text).join("");
        blocks.push({
          id: `html-quote-${i}`,
          type: "blockquote",
          runs,
          text,
        });
      } else if (tag === "pre") {
        const codeEl = el.querySelector("code");
        const runs = extractRunsFromDom(codeEl || el);
        const text = runs.map((r) => r.text).join("");
        blocks.push({
          id: `html-code-${i}`,
          type: "codeBlock",
          runs,
          text,
        });
      } else if (tag === "hr") {
        blocks.push({
          id: `html-hr-${i}`,
          type: "horizontalRule",
          runs: [],
          text: "",
        });
      } else {
        const runs = extractRunsFromDom(el);
        const text = runs.map((r) => r.text).join("");
        if (text.trim().length > 0) {
          blocks.push({
            id: `html-block-${i}`,
            type: "paragraph",
            runs,
            text,
          });
        }
      }
    }
  } catch (err) {
    console.error("Error extracting blocks from HTML:", err);
  }

  return blocks;
}

/**
 * Extract structured blocks from a Version object or live draft.
 */
export function extractBlocksFromVersion(version, currentYDoc) {
  if (!version) return [];

  // 1. Current Draft (live collaborative Y.Doc)
  if (version.isLive) {
    if (currentYDoc) {
      return extractBlocksFromYDoc(currentYDoc);
    }
    return [];
  }

  // 2. Historical version with binary Yjs state
  if (version.yjsState) {
    let bytes = null;
    if (version.yjsState instanceof Uint8Array) {
      bytes = version.yjsState;
    } else if (version.yjsState?.data && Array.isArray(version.yjsState.data)) {
      bytes = new Uint8Array(version.yjsState.data);
    } else if (Array.isArray(version.yjsState)) {
      bytes = new Uint8Array(version.yjsState);
    }

    if (bytes && bytes.length > 0) {
      try {
        const tempDoc = new Y.Doc();
        Y.applyUpdate(tempDoc, bytes);
        const blocks = extractBlocksFromYDoc(tempDoc);
        tempDoc.destroy();
        if (blocks.length > 0) {
          return blocks;
        }
      } catch (err) {
        console.warn("Could not parse yjsState from version, falling back to HTML:", err);
      }
    }
  }

  // 3. Historical version with HTML content
  if (version.content) {
    return extractBlocksFromHtml(version.content);
  }

  return [];
}

/**
 * String similarity ratio (Sørensen–Dice coefficient on word tokens)
 */
function stringSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  const w1 = str1.toLowerCase().match(/\w+/g) || [];
  const w2 = str2.toLowerCase().match(/\w+/g) || [];
  if (w1.length === 0 && w2.length === 0) return 1.0;
  const set1 = new Set(w1);
  const set2 = new Set(w2);
  let inter = 0;
  for (const w of set1) {
    if (set2.has(w)) inter++;
  }
  return (2 * inter) / (set1.size + set2.size);
}

/**
 * Compute inline Myers diff between runs of Block A (base) and Block B (target).
 */
function diffInlineTokens(runsA, runsB) {
  const tokensA = tokenizeRuns(runsA);
  const tokensB = tokenizeRuns(runsB);

  const script = myersDiff(tokensA, tokensB, (a, b) => a.text === b.text);

  let additions = 0;
  let deletions = 0;

  const diffTokens = script.map((item) => {
    if (item.type === "equal") {
      return {
        type: "equal",
        text: item.newVal.text,
        marks: item.newVal.marks || item.oldVal.marks || {},
      };
    }
    if (item.type === "insert") {
      if (/\S/.test(item.newVal.text)) additions++;
      return {
        type: "insert",
        text: item.newVal.text,
        marks: item.newVal.marks || {},
      };
    }
    if (item.type === "delete") {
      if (/\S/.test(item.oldVal.text)) deletions++;
      return {
        type: "delete",
        text: item.oldVal.text,
        marks: item.oldVal.marks || {},
      };
    }
    return item;
  });

  return { diffTokens, additions, deletions };
}

/**
 * Pair a group of deleted blocks from A with inserted blocks from B.
 */
function pairDeletedAndInsertedBlocks(deletions, insertions) {
  const paired = [];
  const usedInsertions = new Set();
  const usedDeletions = new Set();

  for (let d = 0; d < deletions.length; d++) {
    const del = deletions[d];
    let bestScore = -1;
    let bestIns = -1;

    for (let ins = 0; ins < insertions.length; ins++) {
      if (usedInsertions.has(ins)) continue;
      const target = insertions[ins];
      let score = stringSimilarity(del.text, target.text);
      if (del.type === target.type) score += 0.35;
      if (score > bestScore && score >= 0.35) {
        bestScore = score;
        bestIns = ins;
      }
    }

    if (bestIns !== -1) {
      usedDeletions.add(d);
      usedInsertions.add(bestIns);
      paired.push({
        status: "modified",
        oldBlock: del,
        newBlock: insertions[bestIns],
      });
    }
  }

  for (let d = 0; d < deletions.length; d++) {
    if (!usedDeletions.has(d)) {
      paired.push({ status: "deleted", oldBlock: deletions[d] });
    }
  }

  for (let ins = 0; ins < insertions.length; ins++) {
    if (!usedInsertions.has(ins)) {
      paired.push({ status: "added", newBlock: insertions[ins] });
    }
  }

  return paired;
}

/**
 * Compute complete structured diff between two sets of blocks.
 * Base = blocksA, Target = blocksB
 */
export function computeStructuredDiff(blocksA = [], blocksB = []) {
  // 1. Myers diff at block level to find unchanged blocks
  const blockScript = myersDiff(
    blocksA,
    blocksB,
    (a, b) => a.type === b.type && a.level === b.level && a.text === b.text
  );

  const diffBlocks = [];
  const alignedRows = []; // For side-by-side view
  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalModifications = 0;

  let pendingDeletions = [];
  let pendingInsertions = [];

  const flushPending = () => {
    if (pendingDeletions.length === 0 && pendingInsertions.length === 0) return;

    const paired = pairDeletedAndInsertedBlocks(pendingDeletions, pendingInsertions);

    for (const item of paired) {
      if (item.status === "modified") {
        totalModifications++;
        const { diffTokens, additions, deletions } = diffInlineTokens(
          item.oldBlock.runs,
          item.newBlock.runs
        );
        totalAdditions += additions;
        totalDeletions += deletions;

        const block = {
          id: `diff-mod-${diffBlocks.length}`,
          status: "modified",
          type: item.newBlock.type || item.oldBlock.type,
          level: item.newBlock.level || item.oldBlock.level,
          order: item.newBlock.order || item.oldBlock.order,
          tokens: diffTokens,
          oldBlock: item.oldBlock,
          newBlock: item.newBlock,
        };

        diffBlocks.push(block);
        alignedRows.push({
          status: "modified",
          baseBlock: item.oldBlock,
          targetBlock: item.newBlock,
          tokens: diffTokens,
        });
      } else if (item.status === "deleted") {
        const words = (item.oldBlock.text.match(/\S+/g) || []).length;
        totalDeletions += words;

        const tokens = tokenizeRuns(item.oldBlock.runs).map((t) => ({
          type: "delete",
          text: t.text,
          marks: t.marks || {},
        }));

        const block = {
          id: `diff-del-${diffBlocks.length}`,
          status: "deleted",
          type: item.oldBlock.type,
          level: item.oldBlock.level,
          order: item.oldBlock.order,
          tokens,
          oldBlock: item.oldBlock,
        };

        diffBlocks.push(block);
        alignedRows.push({
          status: "deleted",
          baseBlock: item.oldBlock,
          targetBlock: null,
          tokens,
        });
      } else if (item.status === "added") {
        const words = (item.newBlock.text.match(/\S+/g) || []).length;
        totalAdditions += words;

        const tokens = tokenizeRuns(item.newBlock.runs).map((t) => ({
          type: "insert",
          text: t.text,
          marks: t.marks || {},
        }));

        const block = {
          id: `diff-add-${diffBlocks.length}`,
          status: "added",
          type: item.newBlock.type,
          level: item.newBlock.level,
          order: item.newBlock.order,
          tokens,
          newBlock: item.newBlock,
        };

        diffBlocks.push(block);
        alignedRows.push({
          status: "added",
          baseBlock: null,
          targetBlock: item.newBlock,
          tokens,
        });
      }
    }

    pendingDeletions = [];
    pendingInsertions = [];
  };

  for (const op of blockScript) {
    if (op.type === "equal") {
      flushPending();
      const tokens = tokenizeRuns(op.newVal.runs).map((t) => ({
        type: "equal",
        text: t.text,
        marks: t.marks || {},
      }));

      const block = {
        id: `diff-eq-${diffBlocks.length}`,
        status: "unchanged",
        type: op.newVal.type,
        level: op.newVal.level,
        order: op.newVal.order,
        tokens,
        block: op.newVal,
      };

      diffBlocks.push(block);
      alignedRows.push({
        status: "unchanged",
        baseBlock: op.oldVal,
        targetBlock: op.newVal,
        tokens,
      });
    } else if (op.type === "delete") {
      pendingDeletions.push(op.oldVal);
    } else if (op.type === "insert") {
      pendingInsertions.push(op.newVal);
    }
  }

  flushPending();

  return {
    diffBlocks,
    alignedRows,
    summary: {
      additions: totalAdditions,
      deletions: totalDeletions,
      modifications: totalModifications,
      totalBlocksA: blocksA.length,
      totalBlocksB: blocksB.length,
    },
  };
}

