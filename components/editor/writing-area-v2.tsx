'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Doc, Block, BlockType, DerivedScene } from '@/lib/doc';
import { useDoc, matchCharacters, createBlock, docToScreenplay } from '@/lib/doc';
import type { ViewMode, EditorTheme, ScriptView } from './editor-toolbar';
import { FindReplace } from '@/components/editor/find-replace';
import { ScriptNoteIcon } from '@/components/editor/script-note';

interface WritingAreaV2Props {
  doc: Doc;
  onDocChange: (doc: Doc) => void;
  viewMode: ViewMode;
  scriptView: ScriptView;
  theme: EditorTheme;
  activeSceneId: string | null;
  typewriterMode?: boolean;
  watermark?: string;
  showRevisions?: boolean;
  themeOverride?: { paper: string; ink: string; inkFaint: string; desk: string; pageShadow: string; pageBreak: string; cursor: string } | null;
  onActiveSceneChange: (id: string) => void;
  onFocusedElementInfo?: (info: { type: BlockType; blockId: string } | null) => void;
}

const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;
const LINES_PER_PAGE = 55;

const SCREENPLAY_FONT = 'var(--font-screenplay), "Courier New", Courier, monospace';
const FONT_SIZE = '15px';
const LINE_HEIGHT = '19.5px';

const THEMES: Record<EditorTheme, {
  paper: string; ink: string; inkFaint: string; desk: string;
  pageShadow: string; pageBreak: string; cursor: string;
}> = {
  parchment: {
    paper: '#17160f', ink: '#c8bda0', inkFaint: '#4a4535',
    desk: '#13120f', pageShadow: 'rgba(0,0,0,0.2)',
    pageBreak: 'rgba(200,189,160,0.06)', cursor: '#c45c4a',
  },
  midnight: {
    paper: '#0d1020', ink: '#b8c4dd', inkFaint: '#3a4560',
    desk: '#060810', pageShadow: 'rgba(80,120,200,0.05)',
    pageBreak: 'rgba(100,130,200,0.1)', cursor: '#6888cc',
  },
  dawn: {
    paper: '#faf6ee', ink: '#1a1510', inkFaint: '#b0a890',
    desk: '#e8e0d0', pageShadow: 'rgba(0,0,0,0.08)',
    pageBreak: 'rgba(0,0,0,0.08)', cursor: '#8a7040',
  },
  classic: {
    paper: '#ffffff', ink: '#000000', inkFaint: '#aaaaaa',
    desk: '#e8e8e8', pageShadow: 'rgba(0,0,0,0.15)',
    pageBreak: 'rgba(0,0,0,0.06)', cursor: '#1a1a1a',
  },
};

function blockStyle(type: BlockType, ink: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: SCREENPLAY_FONT,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: ink,
  };
  switch (type) {
    case 'scene-heading':
      return { ...base, fontWeight: 700, textTransform: 'uppercase', marginTop: '2em', marginBottom: '1em' };
    case 'action':
      return { ...base, marginTop: '1em' };
    case 'character':
      return { ...base, marginLeft: '36.7%', maxWidth: '61.7%', textTransform: 'uppercase', marginTop: '1em' };
    case 'parenthetical':
      return { ...base, marginLeft: '26.7%', maxWidth: '41.7%', marginTop: 0, marginBottom: 0 };
    case 'dialogue':
      return { ...base, marginLeft: '16.7%', maxWidth: '58.3%', marginTop: 0, marginBottom: 0 };
    case 'transition':
      return { ...base, textAlign: 'right', textTransform: 'uppercase', marginTop: '1em', marginBottom: '1em' };
    default:
      return base;
  }
}

const HEADING_PREFIXES = ['INT. ', 'EXT. ', 'INT./EXT. ', 'I/E. '];
const CHARACTER_EXTENSIONS = ['(V.O.)', '(O.S.)', '(O.C.)', '(CONT\'D)', '(V.O.) (CONT\'D)', '(O.S.) (CONT\'D)'];

function estimateBlockLines(block: Block): number {
  const len = block.text.length;
  if (block.type === 'character') return 2;
  if (block.type === 'dialogue') return Math.max(1, Math.ceil(len / 35));
  if (block.type === 'parenthetical') return 1;
  if (block.type === 'scene-heading') return 2;
  if (block.type === 'transition') return 2;
  return Math.max(1, Math.ceil(len / 60));
}

function findCharacterForBlock(blocks: Block[], blockIdx: number): string | null {
  for (let i = blockIdx - 1; i >= 0; i--) {
    if (blocks[i].type === 'character') return blocks[i].text.trim();
    if (blocks[i].type !== 'dialogue' && blocks[i].type !== 'parenthetical') return null;
  }
  return null;
}

function computeBlockPageBreaks(blocks: Block[]): Map<string, number> {
  const breaks = new Map<string, number>();
  let lineCount = 0;
  let page = 1;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'scene-heading') {
      lineCount += 2;
    }
    const lines = estimateBlockLines(block);
    lineCount += lines;
    if (lineCount >= LINES_PER_PAGE) {
      page++;
      lineCount = lines;
      breaks.set(block.id, page);
    }
  }
  return breaks;
}

// Get the cursor offset within a contentEditable node
function getCursorOffset(node: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const cursorRange = sel.getRangeAt(0);
  const preRange = document.createRange();
  preRange.selectNodeContents(node);
  preRange.setEnd(cursorRange.startContainer, cursorRange.startOffset);
  return preRange.toString().length;
}

// Set the cursor at a specific offset within a contentEditable node
function setCursorInNode(node: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;

  // Walk text nodes to find the right position
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  let remaining = offset;
  let textNode = walker.nextNode();

  while (textNode) {
    const len = textNode.textContent?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
    textNode = walker.nextNode();
  }

  // Fallback: place at end
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ─── Render Item Types for V2 ───

type RenderItemV2 =
  | { kind: 'heading'; block: Block; blockIdx: number; sceneNumber: number; scene: DerivedScene }
  | { kind: 'element'; block: Block; blockIdx: number; scene: DerivedScene }
  | { kind: 'page-break'; pageNum: number; contdName?: string }
  | { kind: 'dual-dialogue'; scene: DerivedScene; groups: DualGroup[] };

interface DualGroup {
  side: 'left' | 'right';
  blocks: { block: Block; blockIdx: number }[];
  scene: DerivedScene;
}

export function WritingArea({
  doc: docProp,
  onDocChange,
  viewMode,
  scriptView,
  theme,
  activeSceneId,
  typewriterMode,
  watermark,
  showRevisions,
  themeOverride,
  onActiveSceneChange,
  onFocusedElementInfo,
}: WritingAreaV2Props) {
  const {
    doc, blocks, scenes, characters,
    dispatch, dispatchKey, updateText,
    undo, redo, setDoc, version,
  } = useDoc(docProp);

  // Sync external doc prop into useDoc when the prop changes (parent-driven updates)
  const lastPropVersionRef = useRef(docProp.version);
  useEffect(() => {
    if (docProp.version !== lastPropVersionRef.current) {
      lastPropVersionRef.current = docProp.version;
      setDoc(docProp);
    }
  }, [docProp, setDoc]);

  // Propagate internal doc changes to parent
  const lastEmittedVersion = useRef(doc.version);
  useEffect(() => {
    if (doc.version !== lastEmittedVersion.current) {
      lastEmittedVersion.current = doc.version;
      onDocChange(doc);
    }
  }, [doc, onDocChange]);

  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [autocomplete, setAutocomplete] = useState<string[]>([]);
  const [acIdx, setAcIdx] = useState(0);
  const [headingAC, setHeadingAC] = useState<string[]>([]);
  const [headingACIdx, setHeadingACIdx] = useState(0);
  const [headingACBlockId, setHeadingACBlockId] = useState<string | null>(null);
  const [showFind, setShowFind] = useState(false);

  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const headingInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build a blockId -> index lookup
  const blockIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < blocks.length; i++) map.set(blocks[i].id, i);
    return map;
  }, [blocks]);

  // Find which scene a block belongs to
  const blockToScene = useMemo(() => {
    const map = new Map<string, DerivedScene>();
    for (const scene of scenes) {
      for (const bid of scene.blockIds) {
        map.set(bid, scene);
      }
    }
    return map;
  }, [scenes]);

  const t = themeOverride ?? THEMES[theme];

  // Collect known locations from headings for autocomplete
  const knownLocations = useMemo(() =>
    blocks
      .filter(b => b.type === 'scene-heading')
      .map(b => b.text)
      .filter(h => h.trim().length > 0)
      .map(h => h.replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, '').trim())
      .filter(Boolean),
    [blocks]
  );

  const scrollToCenter = useCallback((blockId: string) => {
    if (!typewriterMode || !scrollRef.current) return;
    const node = blockRefs.current.get(blockId);
    if (!node) return;
    const container = scrollRef.current;
    const nodeRect = node.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offset = nodeRect.top - containerRect.top - containerRect.height / 2 + nodeRect.height / 2;
    container.scrollBy({ top: offset, behavior: 'smooth' });
  }, [typewriterMode]);

  // Sync block text into contentEditable nodes when blocks change externally
  useEffect(() => {
    for (const block of blocks) {
      if (block.type === 'scene-heading') continue; // headings use <input>
      const node = blockRefs.current.get(block.id);
      if (node && block.text && (node.innerText ?? '') !== block.text) {
        if (block.text.includes('\n')) {
          node.innerHTML = block.text.replace(/\n/g, '<br>');
        } else {
          node.textContent = block.text;
        }
      }
    }
  }, [blocks, viewMode]);

  const focusBlock = useCallback((blockId: string, atEnd = true) => {
    requestAnimationFrame(() => {
      const block = blocks.find(b => b.id === blockId);
      if (block?.type === 'scene-heading') {
        const input = headingInputRefs.current.get(blockId);
        if (input) input.focus();
        return;
      }
      const node = blockRefs.current.get(blockId);
      if (node) {
        node.focus();
        if (atEnd) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(node);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    });
  }, [blocks]);

  const focusBlockAtOffset = useCallback((blockId: string, offset: number) => {
    requestAnimationFrame(() => {
      const block = blocks.find(b => b.id === blockId);
      if (block?.type === 'scene-heading') {
        const input = headingInputRefs.current.get(blockId);
        if (input) {
          input.focus();
          input.setSelectionRange(offset, offset);
        }
        return;
      }
      const node = blockRefs.current.get(blockId);
      if (node) {
        node.focus();
        setCursorInNode(node, offset);
      }
    });
  }, [blocks]);

  // Navigate to the previous block
  const focusPrevBlock = useCallback((blockId: string) => {
    const idx = blockIndex.get(blockId);
    if (idx === undefined || idx === 0) return;
    focusBlock(blocks[idx - 1].id, true);
  }, [blocks, blockIndex, focusBlock]);

  // Navigate to the next block
  const focusNextBlock = useCallback((blockId: string) => {
    const idx = blockIndex.get(blockId);
    if (idx === undefined || idx >= blocks.length - 1) return;
    focusBlock(blocks[idx + 1].id, false);
  }, [blocks, blockIndex, focusBlock]);

  // ─── Heading Input ───

  const handleHeadingInput = useCallback((blockId: string, value: string) => {
    const upper = value.toUpperCase();
    updateText(blockId, upper);

    // Show prefix suggestions
    if (upper.length > 0 && upper.length <= 5) {
      const matches = HEADING_PREFIXES.filter(p => p.startsWith(upper));
      if (matches.length > 0) {
        setHeadingAC(matches);
        setHeadingACIdx(0);
        setHeadingACBlockId(blockId);
        return;
      }
    }

    // After prefix, suggest known locations
    const prefixMatch = upper.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*(.*)/);
    if (prefixMatch && prefixMatch[2].length > 0) {
      const partial = prefixMatch[2];
      const locMatches = [...new Set(knownLocations)]
        .filter(l => l.toUpperCase().startsWith(partial) && l.toUpperCase() !== partial)
        .slice(0, 5);
      if (locMatches.length > 0) {
        setHeadingAC(locMatches.map(l => `${prefixMatch[1]} ${l}`));
        setHeadingACIdx(0);
        setHeadingACBlockId(blockId);
        return;
      }
    }

    setHeadingAC([]);
    setHeadingACBlockId(null);
  }, [updateText, knownLocations]);

  // ─── Block Text Input ───

  const handleBlockInput = useCallback((blockId: string, text: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    updateText(blockId, text);

    // Character autocomplete
    if (block.type === 'character' || (block.meta.locked && text.trim() === text.trim().toUpperCase() && text.length < 40)) {
      const nameOnly = text.trim().replace(/\s*\(.*$/, '').toUpperCase();
      const hasOpenParen = text.includes('(');
      if (hasOpenParen && characters.some(c => c.toUpperCase() === nameOnly)) {
        const partial = text.slice(text.indexOf('(')).toUpperCase();
        const extMatches = CHARACTER_EXTENSIONS.filter(ext => ext.toUpperCase().startsWith(partial));
        setAutocomplete(extMatches.map(ext => `${nameOnly} ${ext}`));
        setAcIdx(0);
      } else {
        setAutocomplete(matchCharacters(text, characters));
        setAcIdx(0);
      }
    } else {
      setAutocomplete([]);
    }
  }, [blocks, updateText, characters]);

  // ─── Apply autocomplete selection ───

  const applyAutocomplete = useCallback((blockId: string, name: string) => {
    // Set the character text, then split at end to create a dialogue line
    dispatch({ intent: 'update_text', blockId, text: name.toUpperCase() });
    dispatch({ intent: 'force_type', blockId, type: 'character' });
    dispatch({ intent: 'split_block', blockId, offset: name.toUpperCase().length });
    setAutocomplete([]);
  }, [dispatch]);

  // ─── Keyboard Handling ───

  const handleKeyDown = useCallback((e: React.KeyboardEvent, blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const idx = blockIndex.get(blockId);
    if (idx === undefined) return;

    const mod = e.metaKey || e.ctrlKey;

    // Find
    if (mod && e.key === 'f') {
      e.preventDefault();
      setShowFind(true);
      return;
    }

    // Bold/Italic/Underline — let browser handle
    if (mod && (e.key === 'b' || e.key === 'i' || e.key === 'u')) return;

    // Dual dialogue toggle (Cmd+D)
    if (mod && e.key === 'd') {
      e.preventDefault();
      handleDualDialogueToggle(blockId);
      return;
    }

    // Select current scene (Cmd+Shift+A)
    if (mod && e.shiftKey && e.key === 'a') {
      e.preventDefault();
      const scene = blockToScene.get(blockId);
      if (!scene) return;
      const sel = window.getSelection();
      if (!sel) return;
      const firstNode = blockRefs.current.get(scene.blockIds[1] ?? scene.blockIds[0]);
      const lastNode = blockRefs.current.get(scene.blockIds[scene.blockIds.length - 1]);
      if (firstNode && lastNode) {
        const range = document.createRange();
        range.setStartBefore(firstNode);
        range.setEndAfter(lastNode);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      return;
    }

    // Shift+Enter: line break within same block
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      const node = blockRefs.current.get(blockId);
      if (node) {
        const text = node.innerText ?? '';
        handleBlockInput(blockId, text);
      }
      return;
    }

    // Autocomplete handling
    if (autocomplete.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(p => Math.min(p + 1, autocomplete.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAcIdx(p => Math.max(p - 1, 0)); return; }
      if (e.key === 'Escape') { setAutocomplete([]); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        applyAutocomplete(blockId, autocomplete[acIdx]);
        return;
      }
    }

    // Arrow navigation between blocks
    if (e.key === 'ArrowUp') {
      const node = blockRefs.current.get(blockId);
      if (node) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const nodeRect = node.getBoundingClientRect();
          if (rect.top - nodeRect.top < 20) {
            e.preventDefault();
            focusPrevBlock(blockId);
            return;
          }
        }
      }
    }

    if (e.key === 'ArrowDown') {
      const node = blockRefs.current.get(blockId);
      if (node) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const nodeRect = node.getBoundingClientRect();
          if (nodeRect.bottom - rect.bottom < 20) {
            e.preventDefault();
            focusNextBlock(blockId);
            return;
          }
        }
      }
    }

    // Get cursor offset for intent engine
    const node = blockRefs.current.get(blockId);
    const offset = node ? getCursorOffset(node) : 0;

    // Dispatch through intent engine
    const intent = dispatchKey(
      { key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey },
      blockId,
      offset,
      block.type,
    );

    if (intent) {
      e.preventDefault();

      // After the dispatch, we need to focus the right block.
      // The doc will update, and we schedule focus based on what the intent was.
      requestAnimationFrame(() => {
        const newDoc = doc; // This will be stale — use a ref approach
        // Focus is handled by the cursor in doc. We read it after state update.
      });
    }
  }, [blocks, blockIndex, blockToScene, dispatchKey, doc, autocomplete, acIdx, applyAutocomplete, handleBlockInput, focusPrevBlock, focusNextBlock]);

  // Focus the block indicated by the doc cursor after every version change
  const prevCursorRef = useRef(doc.cursor.position.blockId);
  useEffect(() => {
    const cursorBlockId = doc.cursor.position.blockId;
    const cursorOffset = doc.cursor.position.offset;

    if (cursorBlockId !== prevCursorRef.current || true) {
      prevCursorRef.current = cursorBlockId;
      // Only auto-focus if this block isn't already focused
      const activeEl = document.activeElement;
      const targetNode = blockRefs.current.get(cursorBlockId) ?? headingInputRefs.current.get(cursorBlockId);
      if (targetNode && targetNode !== activeEl) {
        focusBlockAtOffset(cursorBlockId, cursorOffset);
      } else if (targetNode === activeEl) {
        // Already focused — just set cursor offset if it differs
        const block = blocks.find(b => b.id === cursorBlockId);
        if (block?.type === 'scene-heading') {
          const input = headingInputRefs.current.get(cursorBlockId);
          if (input && input.selectionStart !== cursorOffset) {
            input.setSelectionRange(cursorOffset, cursorOffset);
          }
        } else if (targetNode) {
          const current = getCursorOffset(targetNode as HTMLElement);
          if (current !== cursorOffset) {
            setCursorInNode(targetNode as HTMLElement, cursorOffset);
          }
        }
      }
    }
  }, [version, doc.cursor.position.blockId, doc.cursor.position.offset, blocks, focusBlockAtOffset]);

  // ─── Dual dialogue toggle ───

  const handleDualDialogueToggle = useCallback((blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const idx = blockIndex.get(blockId)!;

    // Find the character cue that owns this block
    let charIdx = idx;
    if (block.type === 'dialogue' || block.type === 'parenthetical') {
      for (let ci = idx - 1; ci >= 0; ci--) {
        if (blocks[ci].type === 'character') { charIdx = ci; break; }
        if (blocks[ci].type !== 'parenthetical' && blocks[ci].type !== 'dialogue') break;
      }
    } else if (block.type !== 'character') {
      return;
    }

    // Find end of this character block
    let charBlockEnd = charIdx;
    for (let bi = charIdx + 1; bi < blocks.length; bi++) {
      if (blocks[bi].type === 'dialogue' || blocks[bi].type === 'parenthetical') {
        charBlockEnd = bi;
      } else break;
    }

    const currentDual = blocks[charIdx].meta.dual;

    // Toggle off
    if (currentDual) {
      for (let di = charIdx; di <= charBlockEnd; di++) {
        dispatch({ intent: 'toggle_note', blockId: blocks[di].id }); // Hacky — we need set_meta
        // Actually, we don't have a direct "set_meta" intent. Use the transaction system.
      }
      // Use raw operations via a custom approach — but useDoc only exposes dispatch(intent).
      // For dual dialogue, we need to directly manipulate meta. Let's build a new doc.
      const newBlocks = blocks.map((b, i) => {
        if (i >= charIdx && i <= charBlockEnd) {
          return { ...b, meta: { ...b.meta, dual: undefined } };
        }
        return b;
      });
      const newDoc = { ...doc, blocks: newBlocks, version: doc.version + 1 };
      setDoc(newDoc);
      onDocChange(newDoc);
      return;
    }

    // Find neighbor character block
    let neighborCharIdx = -1;
    let neighborBlockEnd = -1;
    let thisSide: 'left' | 'right' = 'left';

    // Check block after
    const afterStart = charBlockEnd + 1;
    if (afterStart < blocks.length && blocks[afterStart].type === 'character') {
      neighborCharIdx = afterStart;
      neighborBlockEnd = afterStart;
      for (let bi = afterStart + 1; bi < blocks.length; bi++) {
        if (blocks[bi].type === 'dialogue' || blocks[bi].type === 'parenthetical') {
          neighborBlockEnd = bi;
        } else break;
      }
      thisSide = 'left';
    }

    // If no after, check before
    if (neighborCharIdx === -1 && charIdx > 0) {
      const prevBlockEnd = charIdx - 1;
      if (prevBlockEnd >= 0 && (blocks[prevBlockEnd].type === 'dialogue' || blocks[prevBlockEnd].type === 'parenthetical')) {
        let prevCharIdx = prevBlockEnd;
        for (let ci = prevBlockEnd - 1; ci >= 0; ci--) {
          if (blocks[ci].type === 'character') { prevCharIdx = ci; break; }
          if (blocks[ci].type !== 'parenthetical' && blocks[ci].type !== 'dialogue') break;
        }
        if (blocks[prevCharIdx].type === 'character') {
          neighborCharIdx = prevCharIdx;
          neighborBlockEnd = prevBlockEnd;
          thisSide = 'right';
        }
      }
    }

    if (neighborCharIdx === -1) return;

    const leftChar = thisSide === 'left' ? charIdx : neighborCharIdx;
    const leftEnd = thisSide === 'left' ? charBlockEnd : neighborBlockEnd;
    const rightChar = thisSide === 'left' ? neighborCharIdx : charIdx;
    const rightEnd = thisSide === 'left' ? neighborBlockEnd : charBlockEnd;

    const newBlocks = blocks.map((b, i) => {
      if (i >= leftChar && i <= leftEnd) {
        return { ...b, meta: { ...b.meta, dual: 'left' as const } };
      }
      if (i >= rightChar && i <= rightEnd) {
        return { ...b, meta: { ...b.meta, dual: 'right' as const } };
      }
      return b;
    });
    const newDoc = { ...doc, blocks: newBlocks, version: doc.version + 1 };
    setDoc(newDoc);
    onDocChange(newDoc);
  }, [blocks, blockIndex, doc, dispatch, setDoc, onDocChange]);

  // ─── Heading KeyDown ───

  const handleHeadingKeyDown = useCallback((e: React.KeyboardEvent, blockId: string) => {
    const mod = e.metaKey || e.ctrlKey;

    // Undo/Redo
    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && e.key === 'f') {
      e.preventDefault();
      setShowFind(true);
      return;
    }

    // Heading autocomplete
    if (headingAC.length > 0 && headingACBlockId === blockId) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHeadingACIdx(p => Math.min(p + 1, headingAC.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHeadingACIdx(p => Math.max(p - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (headingAC[headingACIdx]) {
          e.preventDefault();
          updateText(blockId, headingAC[headingACIdx].toUpperCase());
          setHeadingAC([]);
          setHeadingACBlockId(null);
          if (e.key === 'Enter') {
            // Focus next block (first element after heading)
            const idx = blockIndex.get(blockId);
            if (idx !== undefined && idx < blocks.length - 1) {
              focusBlock(blocks[idx + 1].id, false);
            }
          }
          return;
        }
      }
      if (e.key === 'Escape') { setHeadingAC([]); setHeadingACBlockId(null); return; }
    }

    // Tab in heading
    if (e.key === 'Tab') {
      e.preventDefault();
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;
      const h = block.text;
      if (!h.trim()) {
        updateText(blockId, 'INT. ');
        return;
      }
      const match = h.match(/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*$/);
      if (match) return;
      const fullMatch = h.match(/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s+(.+?)$/);
      if (fullMatch && !h.includes(' - ')) {
        updateText(blockId, h + ' - ');
        return;
      }
      const prefixCycle = ['INT.', 'EXT.', 'INT./EXT.'];
      const currentPrefix = h.match(/^(INT\.|EXT\.|INT\.\/EXT\.)/)?.[1];
      if (currentPrefix) {
        const ci = prefixCycle.indexOf(currentPrefix);
        const nextPrefix = prefixCycle[(ci + 1) % prefixCycle.length];
        updateText(blockId, h.replace(currentPrefix, nextPrefix));
      }
      return;
    }

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = blockIndex.get(blockId);
      if (idx !== undefined && idx < blocks.length - 1) {
        focusBlock(blocks[idx + 1].id, false);
      }
    }
    if (e.key === 'ArrowUp') {
      const idx = blockIndex.get(blockId);
      if (idx !== undefined && idx > 0) {
        e.preventDefault();
        focusBlock(blocks[idx - 1].id, true);
      }
    }
  }, [blocks, blockIndex, headingAC, headingACIdx, headingACBlockId, undo, redo, updateText, focusBlock]);

  // ─── Paste ───

  const handlePaste = useCallback((e: React.ClipboardEvent, blockId: string) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !text.includes('\n')) return;

    e.preventDefault();
    const node = blockRefs.current.get(blockId);
    const offset = node ? getCursorOffset(node) : 0;
    const lines = text.split('\n');

    dispatch({ intent: 'paste_multiline', blockId, offset, lines });
  }, [dispatch]);

  // ─── Find & Replace ───
  // Build legacy ScreenplayScene format for FindReplace component
  const scenesForFindReplace = useMemo(() => {
    return docToScreenplay(doc).scenes;
  }, [doc]);

  const handleReplace = useCallback((searchText: string, replaceText: string, replaceAll: boolean) => {
    const searchLower = searchText.toLowerCase();
    let changed = false;
    const newBlocks = blocks.map(b => {
      let newText = b.text;
      if (replaceAll) {
        const replaced = newText.replace(new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          b.type === 'scene-heading' ? replaceText.toUpperCase() : replaceText);
        if (replaced !== newText) { newText = replaced; changed = true; }
      } else if (!changed && newText.toLowerCase().includes(searchLower)) {
        const idx = newText.toLowerCase().indexOf(searchLower);
        newText = newText.slice(0, idx) + (b.type === 'scene-heading' ? replaceText.toUpperCase() : replaceText) + newText.slice(idx + searchText.length);
        changed = true;
      }
      return newText !== b.text ? { ...b, text: newText } : b;
    });

    if (changed) {
      const newDoc = { ...doc, blocks: newBlocks, version: doc.version + 1 };
      setDoc(newDoc);
      onDocChange(newDoc);
    }
  }, [blocks, doc, setDoc, onDocChange]);

  // ─── Scroll to active scene ───
  useEffect(() => {
    if (activeSceneId && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-scene-id="${activeSceneId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSceneId]);

  // Global keyboard shortcut for find
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowFind(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (!document.activeElement || document.activeElement === document.body) {
          e.preventDefault();
          undo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  // ─── Page breaks ───
  const pageBreaks = useMemo(() => computeBlockPageBreaks(blocks), [blocks]);
  const isReadMode = viewMode === 'read';

  // ─── Render a single block ───

  const renderBlock = (block: Block, blockIdx: number, scene: DerivedScene, opts?: { inkOverride?: string }): React.ReactNode => {
    const isHeading = block.type === 'scene-heading';
    const isFocusedScene = focusedKey?.startsWith(scene.headingBlockId) || (focusedKey && scene.blockIds.includes(focusedKey));
    const isFocusedLine = focusedKey === block.id;
    const ink = opts?.inkOverride ?? (viewMode === 'focus' && !isFocusedLine && focusedKey && isFocusedScene ? t.inkFaint : t.ink);

    if (isHeading) return null; // headings are rendered separately

    return (
      <div key={block.id} className="relative group/line">
        {/* Bookmark indicator */}
        {block.meta.bookmark && (
          <span className="absolute select-none" style={{
            left: '-24px', top: 0, fontSize: '10px',
            color: '#c45c4a', fontWeight: 700,
          }} title={`Bookmark: ${block.meta.bookmark}`}>&#9733;</span>
        )}
        {/* Revision mark */}
        {showRevisions && block.meta.revised && (
          <span className="absolute select-none" style={{
            right: '-28px', top: 0, fontFamily: SCREENPLAY_FONT,
            fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT,
            color: t.inkFaint, fontWeight: 700,
          }}>*</span>
        )}
        {/* Script note */}
        {block.meta.note && (
          <ScriptNoteIcon note={block.meta.note} color={t.cursor}
            onChange={(note) => {
              const newBlocks = blocks.map(b =>
                b.id === block.id ? { ...b, meta: { ...b.meta, note: note || undefined } } : b
              );
              const newDoc = { ...doc, blocks: newBlocks, version: doc.version + 1 };
              setDoc(newDoc);
              onDocChange(newDoc);
            }} />
        )}
        {!block.meta.note && !isReadMode && (
          <button className="absolute opacity-0 group-hover/line:opacity-40 hover:!opacity-100 transition-opacity cursor-pointer"
            style={{ right: '-32px', top: '2px', fontSize: '12px', color: t.inkFaint, background: 'none', border: 'none', padding: 0 }}
            title="Add script note"
            onClick={() => {
              dispatch({ intent: 'toggle_note', blockId: block.id });
            }}>
            &#9998;
          </button>
        )}
        {isReadMode ? (
          <div className={`sp-${block.type}`} style={blockStyle(block.type, ink)}>
            {block.text || '\u00A0'}
          </div>
        ) : (
          <div
            ref={node => {
              if (node) {
                blockRefs.current.set(block.id, node);
                if (block.text && (node.innerText ?? '') !== block.text) {
                  if (block.text.includes('\n')) {
                    node.innerHTML = block.text.replace(/\n/g, '<br>');
                  } else {
                    node.textContent = block.text;
                  }
                }
              } else {
                blockRefs.current.delete(block.id);
              }
            }}
            contentEditable suppressContentEditableWarning
            className={`outline-none bg-transparent border-none sp-${block.type}`}
            style={{
              ...blockStyle(block.type, ink),
              caretColor: t.cursor, minHeight: LINE_HEIGHT, whiteSpace: 'pre-wrap', transition: 'color 0.3s',
            }}
            onInput={e => handleBlockInput(block.id, (e.target as HTMLDivElement).innerText ?? '')}
            onKeyDown={e => handleKeyDown(e, block.id)}
            onPaste={e => handlePaste(e, block.id)}
            onFocus={() => {
              setFocusedKey(block.id);
              const sc = blockToScene.get(block.id);
              if (sc) onActiveSceneChange(sc.headingBlockId);
              onFocusedElementInfo?.({ type: block.type, blockId: block.id });
              scrollToCenter(block.id);
            }}
            onBlur={() => {
              const node = blockRefs.current.get(block.id);
              if (node) {
                const text = node.innerText ?? '';
                if (text !== block.text) handleBlockInput(block.id, text);
              }
              setTimeout(() => setAutocomplete([]), 200);
            }}
          />
        )}
        {/* Autocomplete dropdown */}
        {autocomplete.length > 0 && focusedKey === block.id && (
          <div className="absolute mt-1 border rounded-lg py-1 z-10"
            style={{ left: '36.7%', backgroundColor: 'var(--color-surface-2, #1a1a1a)', borderColor: t.pageBreak, minWidth: '200px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
            {autocomplete.map((name, ai) => (
              <button key={name} className="w-full text-left px-4 py-1.5 cursor-pointer transition-colors"
                style={{ fontFamily: SCREENPLAY_FONT, fontSize: '12px', color: ai === acIdx ? '#c45c4a' : t.ink, backgroundColor: ai === acIdx ? 'rgba(196,92,74,0.08)' : 'transparent' }}
                onMouseDown={e => { e.preventDefault(); applyAutocomplete(block.id, name); }}>
                {name.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Render heading ───

  const renderHeading = (block: Block, blockIdx: number, sceneNumber: number, scene: DerivedScene): React.ReactNode => {
    const isFocusedScene = focusedKey && (focusedKey === block.id || scene.blockIds.includes(focusedKey));
    return (
      <div
        key={`h-${block.id}`}
        data-scene-id={block.id}
        className="relative"
        style={{
          opacity: viewMode === 'focus' && focusedKey && !isFocusedScene ? 0.2 : 1,
          transition: 'opacity 0.3s',
          paddingTop: blockIdx > 0 ? '18px' : 0,
        }}
        onClick={() => onActiveSceneChange(block.id)}
      >
        {/* Scene number */}
        <span className="absolute select-none" style={{
          left: '-40px', top: blockIdx > 0 ? '18px' : 0,
          fontFamily: SCREENPLAY_FONT, fontSize: '12px', lineHeight: LINE_HEIGHT,
          color: t.inkFaint, fontWeight: 400, opacity: 0.4,
        }}>{sceneNumber}</span>

        {isReadMode ? (
          <div style={{
            fontFamily: SCREENPLAY_FONT, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT,
            fontWeight: 700, textTransform: 'uppercase', color: t.ink,
          }}>{block.text || '\u00A0'}</div>
        ) : (
          <div className="relative">
            <input
              ref={node => { if (node) headingInputRefs.current.set(block.id, node); else headingInputRefs.current.delete(block.id); }}
              type="text" value={block.text}
              onChange={e => handleHeadingInput(block.id, e.target.value)}
              placeholder="INT. LOCATION - TIME"
              className="w-full bg-transparent outline-none border-none"
              style={{
                fontFamily: SCREENPLAY_FONT, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT,
                fontWeight: 700, textTransform: 'uppercase' as const,
                color: t.ink, caretColor: t.cursor, padding: 0, margin: 0,
              }}
              onFocus={() => {
                setFocusedKey(block.id);
                onActiveSceneChange(block.id);
                onFocusedElementInfo?.({ type: 'scene-heading', blockId: block.id });
              }}
              onKeyDown={e => handleHeadingKeyDown(e, block.id)}
              onBlur={() => { setHeadingAC([]); setHeadingACBlockId(null); }}
            />
            {headingAC.length > 0 && headingACBlockId === block.id && (
              <div className="absolute left-0 top-full mt-1 border rounded-lg py-1 z-10"
                style={{ backgroundColor: 'var(--color-surface-2, #1a1a1a)', borderColor: t.pageBreak, minWidth: '300px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                {headingAC.map((suggestion, ai) => (
                  <button key={suggestion}
                    className="w-full text-left px-4 py-1.5 cursor-pointer transition-colors"
                    style={{ fontFamily: SCREENPLAY_FONT, fontSize: '12px', color: ai === headingACIdx ? '#c45c4a' : t.ink, backgroundColor: ai === headingACIdx ? 'rgba(196,92,74,0.08)' : 'transparent' }}
                    onMouseDown={e => { e.preventDefault(); updateText(block.id, suggestion.toUpperCase()); setHeadingAC([]); setHeadingACBlockId(null); }}>
                    {suggestion.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Build flat render list ───

  const renderItems = useMemo((): RenderItemV2[] => {
    const items: RenderItemV2[] = [];
    let sceneNumber = 1;

    for (const scene of scenes) {
      // Heading
      const headingBlock = blocks.find(b => b.id === scene.headingBlockId);
      if (headingBlock) {
        items.push({ kind: 'heading', block: headingBlock, blockIdx: blockIndex.get(headingBlock.id) ?? 0, sceneNumber: sceneNumber++, scene });
      }

      // Body blocks
      let inDual = false;
      let dualGroups: DualGroup[] = [];

      for (const bid of scene.blockIds) {
        if (bid === scene.headingBlockId) continue;
        const block = blocks.find(b => b.id === bid);
        if (!block) continue;
        const bIdx = blockIndex.get(bid) ?? 0;

        // Page break
        const pb = pageBreaks.get(block.id);
        if (pb) {
          const charName = findCharacterForBlock(blocks, bIdx);
          const prevBlock = bIdx > 0 ? blocks[bIdx - 1] : null;
          const contd = prevBlock && (prevBlock.type === 'dialogue' || prevBlock.type === 'parenthetical') && charName;
          items.push({ kind: 'page-break', pageNum: pb, contdName: contd ? charName : undefined });
        }

        // Dual dialogue handling
        if (block.meta.dual) {
          if (!inDual) {
            inDual = true;
            dualGroups = [];
          }
          const side = block.meta.dual;
          let group = dualGroups.find(g => g.side === side);
          if (!group) {
            group = { side, blocks: [], scene };
            dualGroups.push(group);
          }
          group.blocks.push({ block, blockIdx: bIdx });

          // Check if next block is not dual — close the group
          const nextBidIdx = scene.blockIds.indexOf(bid);
          const nextBid = nextBidIdx < scene.blockIds.length - 1 ? scene.blockIds[nextBidIdx + 1] : null;
          const nextBlock = nextBid ? blocks.find(b => b.id === nextBid) : null;
          if (!nextBlock || !nextBlock.meta.dual) {
            if (dualGroups.length > 0) {
              items.push({ kind: 'dual-dialogue', scene, groups: dualGroups });
            }
            inDual = false;
            dualGroups = [];
          }
          continue;
        } else if (inDual) {
          // Close any open dual group
          if (dualGroups.length > 0) {
            items.push({ kind: 'dual-dialogue', scene, groups: dualGroups });
          }
          inDual = false;
          dualGroups = [];
        }

        items.push({ kind: 'element', block, blockIdx: bIdx, scene });
      }

      // Close unclosed dual group
      if (inDual && dualGroups.length > 0) {
        items.push({ kind: 'dual-dialogue', scene, groups: dualGroups });
      }
    }

    return items;
  }, [scenes, blocks, blockIndex, pageBreaks]);

  // ─── Render a single item ───

  const renderItem = (item: RenderItemV2, i: number): React.ReactNode => {
    if (item.kind === 'page-break') return null;

    if (item.kind === 'dual-dialogue') {
      return (
        <div key={`dual-${i}`} className="flex gap-4" style={{ margin: '4px 0' }}>
          {item.groups.map((group) => (
            <div key={group.side} className="flex-1">
              {group.blocks.map(({ block, blockIdx }) => {
                return isReadMode ? (
                  <div key={block.id} className={`sp-${block.type}`} style={blockStyle(block.type, t.ink)}>
                    {block.text || '\u00A0'}
                  </div>
                ) : (
                  <div key={block.id}>
                    <div
                      ref={node => {
                        if (node) {
                          blockRefs.current.set(block.id, node);
                          if (block.text && (node.innerText ?? '') !== block.text) {
                            if (block.text.includes('\n')) {
                              node.innerHTML = block.text.replace(/\n/g, '<br>');
                            } else {
                              node.textContent = block.text;
                            }
                          }
                        } else blockRefs.current.delete(block.id);
                      }}
                      contentEditable suppressContentEditableWarning
                      className={`outline-none bg-transparent border-none sp-${block.type}`}
                      style={{
                        ...blockStyle(block.type, t.ink),
                        caretColor: t.cursor, minHeight: LINE_HEIGHT, whiteSpace: 'pre-wrap',
                      }}
                      onInput={e => handleBlockInput(block.id, (e.target as HTMLDivElement).innerText ?? '')}
                      onKeyDown={e => handleKeyDown(e, block.id)}
                      onPaste={e => handlePaste(e, block.id)}
                      onFocus={() => {
                        setFocusedKey(block.id);
                        const sc = blockToScene.get(block.id);
                        if (sc) onActiveSceneChange(sc.headingBlockId);
                        onFocusedElementInfo?.({ type: block.type, blockId: block.id });
                      }}
                      onBlur={() => {
                        const node = blockRefs.current.get(block.id);
                        if (node) {
                          const text = node.innerText ?? '';
                          if (text !== block.text) handleBlockInput(block.id, text);
                        }
                        setTimeout(() => setAutocomplete([]), 200);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    }

    if (item.kind === 'heading') {
      return renderHeading(item.block, item.blockIdx, item.sceneNumber, item.scene);
    }

    if (item.kind === 'element') {
      return renderBlock(item.block, item.blockIdx, item.scene);
    }

    return null;
  };

  // ─── Main Render ───

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden relative"
      style={{ background: t.desk }}
    >
      {/* Find & Replace */}
      {showFind && (
        <FindReplace
          scenes={scenesForFindReplace}
          theme={theme}
          onReplace={handleReplace}
          onClose={() => setShowFind(false)}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth" style={{ cursor: 'text' }}
        onClick={(e) => {
          if (e.target === e.currentTarget && blocks.length > 0) {
            const lastBlock = blocks[blocks.length - 1];
            focusBlock(lastBlock.id, true);
          }
        }}>
        {blocks.length === 0 && (
          <div
            className="mx-auto my-10 relative"
            style={{
              width: '100%', maxWidth: PAGE_WIDTH_PX, minHeight: PAGE_HEIGHT_PX,
              background: t.paper,
              boxShadow: theme === 'parchment' ? 'none' : `0 1px 4px rgba(0,0,0,0.08), 0 4px 20px ${t.pageShadow}`,
              border: theme === 'parchment' ? 'none' : `1px solid ${theme === 'classic' ? 'rgba(0,0,0,0.08)' : theme === 'dawn' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)'}`,
              borderRadius: '1px', padding: '72px 80px 72px 108px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ textAlign: 'center', maxWidth: 360 }}>
              <div style={{ fontSize: 28, marginBottom: 16, opacity: 0.3 }}>&#9998;</div>
              <p style={{ color: t.ink, fontFamily: SCREENPLAY_FONT, fontSize: '15px', marginBottom: 8, fontWeight: 600 }}>
                Your screenplay starts here
              </p>
              <p style={{ color: t.inkFaint, fontFamily: SCREENPLAY_FONT, fontSize: '12px', lineHeight: '1.7', marginBottom: 20 }}>
                Add a scene from the sidebar to begin. Type a scene heading like &ldquo;INT. COFFEE SHOP - NIGHT&rdquo; and press Enter to start writing action lines.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', margin: '0 auto', maxWidth: 280 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkFaint, background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Tab</kbd>
                  <span style={{ color: t.inkFaint, fontSize: 11 }}>Cycle element type</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkFaint, background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Enter</kbd>
                  <span style={{ color: t.inkFaint, fontSize: 11 }}>New element (smart type detection)</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkFaint, background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+F</kbd>
                  <span style={{ color: t.inkFaint, fontSize: 11 }}>Find &amp; Replace</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Render based on script view */}
        {blocks.length > 0 && (() => {
          const isPageView = scriptView === 'page' || scriptView === 'focus';
          const isSpeed = scriptView === 'speed';

          // Split renderItems into pages at page-break boundaries
          const pages: RenderItemV2[][] = [[]];
          const contdLabels: Map<number, string | undefined> = new Map();
          for (const item of renderItems) {
            if (item.kind === 'page-break') {
              contdLabels.set(pages.length, item.contdName);
              pages.push([]);
            } else {
              pages[pages.length - 1].push(item);
            }
          }

          // Normal/Speed: single continuous container
          if (!isPageView) {
            return (
              <div
                className="mx-auto relative"
                style={{
                  width: '100%',
                  maxWidth: isSpeed ? '100%' : PAGE_WIDTH_PX,
                  background: isSpeed ? 'transparent' : t.paper,
                  boxShadow: isSpeed ? 'none' : (theme === 'parchment' ? 'none' : `0 1px 4px rgba(0,0,0,0.08), 0 4px 20px ${t.pageShadow}`),
                  borderRadius: '1px',
                  border: isSpeed ? 'none' : (theme === 'parchment' ? 'none' : `1px solid ${theme === 'classic' ? 'rgba(0,0,0,0.08)' : theme === 'dawn' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)'}`),
                  padding: isSpeed ? '24px 48px' : '72px 80px 72px 108px',
                  marginTop: isSpeed ? 40 : (theme === 'parchment' ? 0 : 40),
                  marginBottom: isSpeed ? 40 : (theme === 'parchment' ? 0 : 40),
                  minHeight: isSpeed ? 'auto' : PAGE_HEIGHT_PX,
                  cursor: 'text',
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget && blocks.length > 0) {
                    focusBlock(blocks[blocks.length - 1].id, true);
                  }
                }}
              >
                {renderItems.map((item, i) => {
                  if (item.kind === 'page-break') {
                    return (
                      <div key={`pb-${i}`} style={{ position: 'relative', borderTop: `1px dashed ${t.pageBreak}`, margin: '16px 0' }}>
                        <span style={{
                          position: 'absolute', right: 0, top: -16,
                          fontSize: 9, color: t.inkFaint, fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.05em', opacity: 0.4,
                        }}>{item.pageNum}.</span>
                      </div>
                    );
                  }
                  return renderItem(item, i);
                })}
              </div>
            );
          }

          // Page/Focus view: separate physical sheets
          return pages.map((pageItems, pageIdx) => (
            <div
              key={`page-${pageIdx}`}
              className="mx-auto relative"
              style={{
                width: '100%', maxWidth: PAGE_WIDTH_PX,
                minHeight: PAGE_HEIGHT_PX,
                background: t.paper,
                boxShadow: theme === 'parchment' ? 'none' : `0 1px 4px rgba(0,0,0,0.08), 0 4px 20px ${t.pageShadow}`,
                borderRadius: '1px',
                border: theme === 'parchment' ? 'none' : `1px solid ${theme === 'classic' ? 'rgba(0,0,0,0.08)' : theme === 'dawn' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)'}`,
                padding: '72px 80px 72px 108px',
                marginTop: pageIdx === 0 ? (theme === 'parchment' ? 0 : 40) : (theme === 'parchment' ? 2 : 24),
                marginBottom: pageIdx === pages.length - 1 ? (theme === 'parchment' ? 0 : 40) : 0,
                cursor: 'text',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget && blocks.length > 0) {
                  focusBlock(blocks[blocks.length - 1].id, true);
                }
              }}
            >
              {/* Watermark */}
              {watermark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 1 }}>
                  <span style={{
                    fontSize: 60, fontFamily: SCREENPLAY_FONT, color: t.inkFaint,
                    opacity: 0.08, transform: 'rotate(-45deg)', whiteSpace: 'nowrap',
                    letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase',
                  }}>{watermark}</span>
                </div>
              )}

              {/* Page number */}
              <span
                className="absolute tabular-nums select-none"
                data-page-number={pageIdx + 1}
                style={{
                  top: '32px', right: '80px',
                  fontSize: '11px', color: t.inkFaint,
                  fontFamily: SCREENPLAY_FONT, opacity: 0.3,
                }}
              >
                {pageIdx + 1}.
              </span>

              {/* CONT'D label */}
              {contdLabels.get(pageIdx) && (
                <div style={{
                  fontFamily: SCREENPLAY_FONT, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT,
                  color: t.inkFaint, marginLeft: '36.7%', marginBottom: 8, textTransform: 'uppercase',
                }}>
                  {contdLabels.get(pageIdx)} (CONT&apos;D)
                </div>
              )}

              {pageItems.map((item, i) => renderItem(item, i))}

              {/* (MORE) label */}
              {contdLabels.get(pageIdx + 1) && (
                <div style={{
                  fontFamily: SCREENPLAY_FONT, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT,
                  color: t.inkFaint, textAlign: 'right', marginTop: 8,
                }}>
                  (MORE)
                </div>
              )}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
