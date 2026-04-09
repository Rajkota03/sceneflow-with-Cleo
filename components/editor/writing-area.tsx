'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ScreenplayElement, ScreenplayElementType, ScreenplayScene } from '@/lib/types';
import { detectElementType, nextTypeAfter, cycleType, matchCharacters } from '@/lib/screenplay-format';
import { uid } from '@/lib/screenplay-store';
import type { ViewMode, EditorTheme, ScriptView } from './editor-toolbar';
import { FindReplace } from '@/components/editor/find-replace';
import { ScriptNoteIcon } from '@/components/editor/script-note';

interface WritingAreaProps {
  scenes: ScreenplayScene[];
  knownCharacters: string[];
  viewMode: ViewMode;
  scriptView: ScriptView;
  theme: EditorTheme;
  activeSceneId: string | null;
  typewriterMode?: boolean;
  watermark?: string;
  showRevisions?: boolean;
  themeOverride?: { paper: string; ink: string; inkFaint: string; desk: string; pageShadow: string; pageBreak: string; cursor: string } | null;
  onScenesChange: (scenes: ScreenplayScene[]) => void;
  onActiveSceneChange: (id: string) => void;
  onFocusedElementInfo?: (info: { type: ScreenplayElementType; sceneId: string; elemIdx: number } | null) => void;
}

const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;
const LINES_PER_PAGE = 55;

const SCREENPLAY_FONT = 'var(--font-screenplay), "Courier New", Courier, monospace';
const FONT_SIZE = '15px'; // ~11pt Courier — balanced readability and page density
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

// Industry-standard screenplay element styles
// Indents/widths as % of 6" printable area (US Letter with 1.5" left, 1.0" right margins)
function elementStyle(type: ScreenplayElementType, ink: string): React.CSSProperties {
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

// Scene heading prefixes for auto-complete
const HEADING_PREFIXES = ['INT. ', 'EXT. ', 'INT./EXT. ', 'I/E. '];

// Character extensions for autocomplete
const CHARACTER_EXTENSIONS = ['(V.O.)', '(O.S.)', '(O.C.)', '(CONT\'D)', '(V.O.) (CONT\'D)', '(O.S.) (CONT\'D)'];

// Guess next character in A-B-A dialogue pattern
function guessNextCharacter(elements: ScreenplayElement[], afterIdx: number): string | null {
  // Walk backwards to find the last two different character names
  const chars: string[] = [];
  for (let i = afterIdx; i >= 0; i--) {
    if (elements[i].type === 'character') {
      const name = elements[i].text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
      if (name && (chars.length === 0 || chars[chars.length - 1] !== name)) {
        chars.push(name);
        if (chars.length >= 2) break;
      }
    }
  }
  // If we have A-B pattern and last was B, suggest A
  if (chars.length >= 2) return chars[1];
  return null;
}

function estimateLines(el: ScreenplayElement): number {
  const len = el.text.length;
  if (el.type === 'character') return 2;
  if (el.type === 'dialogue') return Math.max(1, Math.ceil(len / 35));
  if (el.type === 'parenthetical') return 1;
  if (el.type === 'scene-heading') return 2;
  if (el.type === 'transition') return 2;
  return Math.max(1, Math.ceil(len / 60));
}

// ─── Undo/Redo stack ───
const MAX_UNDO = 50;

export function WritingArea({
  scenes, knownCharacters, viewMode, scriptView, theme,
  activeSceneId, typewriterMode, watermark, showRevisions, themeOverride,
  onScenesChange, onActiveSceneChange, onFocusedElementInfo,
}: WritingAreaProps) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [autocomplete, setAutocomplete] = useState<string[]>([]);
  const [acIdx, setAcIdx] = useState(0);
  const [headingAC, setHeadingAC] = useState<string[]>([]);
  const [headingACIdx, setHeadingACIdx] = useState(0);
  const [headingACScene, setHeadingACScene] = useState<string | null>(null);
  const [showFind, setShowFind] = useState(false);
  const lineRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const headingRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  // Track elements with manually forced types (Cmd+1-6, Tab) — skip auto-detection for these
  const lockedTypes = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Undo/Redo
  const undoStack = useRef<ScreenplayScene[][]>([]);
  const redoStack = useRef<ScreenplayScene[][]>([]);
  const lastScenesRef = useRef<ScreenplayScene[]>(scenes);

  const t = themeOverride ?? THEMES[theme];

  // Typewriter mode: scroll focused element to center
  const scrollToCenter = useCallback((key: string) => {
    if (!typewriterMode || !scrollRef.current) return;
    const node = lineRefs.current.get(key);
    if (!node) return;
    const container = scrollRef.current;
    const nodeRect = node.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offset = nodeRect.top - containerRect.top - containerRect.height / 2 + nodeRect.height / 2;
    container.scrollBy({ top: offset, behavior: 'smooth' });
  }, [typewriterMode]);

  // Track scene changes for undo
  const pushUndo = useCallback((prev: ScreenplayScene[]) => {
    undoStack.current.push(JSON.parse(JSON.stringify(prev)));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    redoStack.current.push(JSON.parse(JSON.stringify(scenes)));
    const prev = undoStack.current.pop()!;
    onScenesChange(prev);
  }, [scenes, onScenesChange]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push(JSON.parse(JSON.stringify(scenes)));
    const next = redoStack.current.pop()!;
    onScenesChange(next);
  }, [scenes, onScenesChange]);

  // Sync text into contentEditable divs (supports \n via <br>)
  useEffect(() => {
    for (const scene of scenes) {
      for (let i = 0; i < scene.elements.length; i++) {
        const el = scene.elements[i];
        const key = `${scene.id}:${i}`;
        const node = lineRefs.current.get(key);
        if (node && el.text && (node.innerText ?? '') !== el.text) {
          if (el.text.includes('\n')) {
            node.innerHTML = el.text.replace(/\n/g, '<br>');
          } else {
            node.textContent = el.text;
          }
        }
      }
    }
  }, [scenes, viewMode]);

  const focusLine = useCallback((sceneId: string, idx: number) => {
    requestAnimationFrame(() => {
      const node = lineRefs.current.get(`${sceneId}:${idx}`);
      if (node) {
        node.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(node);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  }, []);

  const updateScene = useCallback((sceneId: string, updater: (s: ScreenplayScene) => ScreenplayScene) => {
    pushUndo(scenes);
    onScenesChange(scenes.map(s => s.id === sceneId ? updater(s) : s));
  }, [scenes, onScenesChange, pushUndo]);

  // Collect known locations from existing headings for auto-complete
  const knownLocations = scenes
    .map(s => s.heading)
    .filter(h => h.trim().length > 0)
    .map(h => h.replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, '').trim())
    .filter(Boolean);

  const handleHeadingInput = (sceneId: string, value: string) => {
    const upper = value.toUpperCase();
    updateScene(sceneId, s => ({ ...s, heading: upper }));

    // Auto-complete: show prefix suggestions or location suggestions
    if (upper.length > 0 && upper.length <= 5) {
      const matches = HEADING_PREFIXES.filter(p => p.startsWith(upper));
      if (matches.length > 0) {
        setHeadingAC(matches);
        setHeadingACIdx(0);
        setHeadingACScene(sceneId);
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
        setHeadingACScene(sceneId);
        return;
      }
    }

    setHeadingAC([]);
    setHeadingACScene(null);
  };

  const handleLineInput = (sceneId: string, idx: number, text: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const key = `${sceneId}:${idx}`;
    const isLocked = lockedTypes.current.has(key);
    const currentType = scene.elements[idx].type;
    // Only auto-detect type if user hasn't manually forced it
    const finalType = isLocked ? currentType : detectElementType(text, idx > 0 ? scene.elements[idx - 1].type : null, knownCharacters);
    pushUndo(scenes);
    const updated = [...scene.elements];
    updated[idx] = { ...updated[idx], text, type: finalType };
    onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
    if (finalType === 'character') {
      // Check if user is typing an extension (space after a known name)
      const nameOnly = text.trim().replace(/\s*\(.*$/, '').toUpperCase();
      const hasOpenParen = text.includes('(');
      if (hasOpenParen && knownCharacters.some(c => c.toUpperCase() === nameOnly)) {
        const partial = text.slice(text.indexOf('(')).toUpperCase();
        const extMatches = CHARACTER_EXTENSIONS.filter(ext => ext.toUpperCase().startsWith(partial));
        setAutocomplete(extMatches.map(ext => `${nameOnly} ${ext}`));
        setAcIdx(0);
      } else {
        setAutocomplete(matchCharacters(text, knownCharacters));
        setAcIdx(0);
      }
    } else {
      setAutocomplete([]);
    }
  };

  // Find the flat index of an element across all scenes
  const findFlatPosition = (sceneId: string, elemIdx: number): { sceneIdx: number; elemIdx: number } | null => {
    const sceneIdx = scenes.findIndex(s => s.id === sceneId);
    if (sceneIdx === -1) return null;
    return { sceneIdx, elemIdx };
  };

  // Navigate to previous element (across scenes)
  const focusPrevElement = (sceneId: string, elemIdx: number) => {
    const sceneIdx = scenes.findIndex(s => s.id === sceneId);
    if (sceneIdx === -1) return;

    if (elemIdx > 0) {
      focusLine(sceneId, elemIdx - 1);
    } else {
      // Go to heading of same scene
      const heading = headingRefs.current.get(sceneId);
      if (heading) heading.focus();
    }
  };

  // Navigate to next element (across scenes)
  const focusNextElement = (sceneId: string, elemIdx: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    if (elemIdx < scene.elements.length - 1) {
      focusLine(sceneId, elemIdx + 1);
    } else {
      // Go to heading of next scene
      const sceneIdx = scenes.findIndex(s => s.id === sceneId);
      if (sceneIdx < scenes.length - 1) {
        const nextScene = scenes[sceneIdx + 1];
        onActiveSceneChange(nextScene.id);
        const heading = headingRefs.current.get(nextScene.id);
        if (heading) requestAnimationFrame(() => heading.focus());
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, sceneId: string, idx: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const el = scene.elements[idx];

    // Undo/Redo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Find
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      setShowFind(true);
      return;
    }

    // Cmd+1-6: Force element type
    if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '6') {
      e.preventDefault();
      const typeMap: Record<string, ScreenplayElementType> = {
        '1': 'scene-heading', '2': 'action', '3': 'character',
        '4': 'parenthetical', '5': 'dialogue', '6': 'transition',
      };
      const newType = typeMap[e.key];
      if (newType) {
        // Lock this element so auto-detection won't override the manual type
        lockedTypes.current.add(`${sceneId}:${idx}`);
        // Save cursor position before type change
        const sel = window.getSelection();
        const cursorOffset = sel?.focusOffset ?? 0;
        pushUndo(scenes);
        const updated = [...scene.elements];
        updated[idx] = { ...updated[idx], type: newType };
        onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
        onFocusedElementInfo?.({ type: newType, sceneId, elemIdx: idx });
        // Restore cursor after React re-render
        requestAnimationFrame(() => {
          const node = lineRefs.current.get(`${sceneId}:${idx}`);
          if (node) {
            node.focus();
            const textNode = node.firstChild;
            if (textNode) {
              const range = document.createRange();
              range.setStart(textNode, Math.min(cursorOffset, textNode.textContent?.length ?? 0));
              range.collapse(true);
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          }
        });
      }
      return;
    }

    // Toggle dual dialogue (Cmd+D)
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault();
      // Find the character+dialogue block containing current element
      const elType = el.type;
      // Find the start of this character block (walk back to character cue)
      let charIdx = idx;
      if (elType === 'dialogue' || elType === 'parenthetical') {
        for (let ci = idx - 1; ci >= 0; ci--) {
          if (scene.elements[ci].type === 'character') { charIdx = ci; break; }
          if (scene.elements[ci].type !== 'parenthetical' && scene.elements[ci].type !== 'dialogue') break;
        }
      } else if (elType !== 'character') {
        return; // not in a character/dialogue block
      }

      // Find the end of this character block
      let blockEnd = charIdx;
      for (let bi = charIdx + 1; bi < scene.elements.length; bi++) {
        if (scene.elements[bi].type === 'dialogue' || scene.elements[bi].type === 'parenthetical') {
          blockEnd = bi;
        } else break;
      }

      // Check if already dual — toggle off
      const currentDual = scene.elements[charIdx].dual;
      if (currentDual) {
        // Remove dual from entire block, and remove dual-start/dual-end markers
        pushUndo(scenes);
        let updated = [...scene.elements];
        for (let di = charIdx; di <= blockEnd; di++) {
          updated[di] = { ...updated[di], dual: undefined };
        }
        // Remove dual-start before charIdx and dual-end after blockEnd
        updated = updated.filter((e, i) => {
          if (i === charIdx - 1 && e.type === 'dual-start') return false;
          if (i === blockEnd + 1 && e.type === 'dual-end') return false;
          return true;
        });
        onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
        return;
      }

      // Find the adjacent character block (the one right before or after)
      // Look for a neighbor block to pair with
      let neighborCharIdx = -1;
      let neighborBlockEnd = -1;
      let thisSide: 'left' | 'right' = 'left';

      // Check block after
      const afterStart = blockEnd + 1;
      if (afterStart < scene.elements.length && scene.elements[afterStart].type === 'character') {
        neighborCharIdx = afterStart;
        neighborBlockEnd = afterStart;
        for (let bi = afterStart + 1; bi < scene.elements.length; bi++) {
          if (scene.elements[bi].type === 'dialogue' || scene.elements[bi].type === 'parenthetical') {
            neighborBlockEnd = bi;
          } else break;
        }
        thisSide = 'left';
      }

      // If no block after, check block before
      if (neighborCharIdx === -1 && charIdx > 0) {
        let prevBlockEnd = charIdx - 1;
        if (scene.elements[prevBlockEnd].type === 'dual-end') prevBlockEnd--;
        if (prevBlockEnd >= 0 && (scene.elements[prevBlockEnd].type === 'dialogue' || scene.elements[prevBlockEnd].type === 'parenthetical')) {
          let prevCharIdx = prevBlockEnd;
          for (let ci = prevBlockEnd - 1; ci >= 0; ci--) {
            if (scene.elements[ci].type === 'character') { prevCharIdx = ci; break; }
            if (scene.elements[ci].type !== 'parenthetical' && scene.elements[ci].type !== 'dialogue') break;
          }
          if (scene.elements[prevCharIdx].type === 'character') {
            neighborCharIdx = prevCharIdx;
            neighborBlockEnd = prevBlockEnd;
            thisSide = 'right';
          }
        }
      }

      if (neighborCharIdx === -1) return; // no adjacent block to pair

      pushUndo(scenes);
      const updated = [...scene.elements];

      // Determine which is left, which is right
      const leftChar = thisSide === 'left' ? charIdx : neighborCharIdx;
      const leftEnd = thisSide === 'left' ? blockEnd : neighborBlockEnd;
      const rightChar = thisSide === 'left' ? neighborCharIdx : charIdx;
      const rightEnd = thisSide === 'left' ? neighborBlockEnd : blockEnd;

      // Mark left block
      for (let di = leftChar; di <= leftEnd; di++) {
        updated[di] = { ...updated[di], dual: 'left' };
      }
      // Mark right block
      for (let di = rightChar; di <= rightEnd; di++) {
        updated[di] = { ...updated[di], dual: 'right' };
      }

      // Insert dual-start before leftChar and dual-end after rightEnd
      const dualStart = { id: uid(), type: 'dual-start' as const, text: '' };
      const dualEnd = { id: uid(), type: 'dual-end' as const, text: '' };
      updated.splice(rightEnd + 1, 0, dualEnd);
      updated.splice(leftChar, 0, dualStart);

      onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
      return;
    }

    // Select current scene (Cmd+Shift+A)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel) return;
      const firstNode = lineRefs.current.get(`${sceneId}:0`);
      const lastNode = lineRefs.current.get(`${sceneId}:${scene.elements.length - 1}`);
      if (firstNode && lastNode) {
        const range = document.createRange();
        range.setStartBefore(firstNode);
        range.setEndAfter(lastNode);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      return;
    }

    // Bookmark toggle (Cmd+M)
    if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
      e.preventDefault();
      pushUndo(scenes);
      const updated = [...scene.elements];
      updated[idx] = { ...updated[idx], bookmark: updated[idx].bookmark ? undefined : 'Bookmark' };
      onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
      return;
    }

    // Bold/Italic/Underline
    if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i' || e.key === 'u')) {
      // Let browser handle contentEditable formatting
      return;
    }

    // Arrow key navigation between elements
    if (e.key === 'ArrowUp') {
      const node = lineRefs.current.get(`${sceneId}:${idx}`);
      if (node) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const nodeRect = node.getBoundingClientRect();
          // If cursor is on first line, move to previous element
          if (rect.top - nodeRect.top < 20) {
            e.preventDefault();
            focusPrevElement(sceneId, idx);
            return;
          }
        }
      }
    }

    if (e.key === 'ArrowDown') {
      const node = lineRefs.current.get(`${sceneId}:${idx}`);
      if (node) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const nodeRect = node.getBoundingClientRect();
          // If cursor is on last line, move to next element
          if (nodeRect.bottom - rect.bottom < 20) {
            e.preventDefault();
            focusNextElement(sceneId, idx);
            return;
          }
        }
      }
    }

    // Shift+Enter: insert line break within the same element (e.g., multi-line dialogue)
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      const node = lineRefs.current.get(`${sceneId}:${idx}`);
      if (node) {
        const text = node.innerText ?? '';
        handleLineInput(sceneId, idx, text);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (autocomplete.length > 0) {
        applyAutocomplete(sceneId, idx, autocomplete[acIdx]);
        return;
      }

      // Final Draft behavior: empty Action line + Enter → switch to Character
      if (el.text.trim() === '' && el.type === 'action') {
        lockedTypes.current.add(`${sceneId}:${idx}`);
        pushUndo(scenes);
        const updated = [...scene.elements];
        updated[idx] = { ...updated[idx], type: 'character' };
        onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
        focusLine(sceneId, idx);
        return;
      }

      // Split text at cursor position (Final Draft behavior)
      const sel = window.getSelection();
      const node = lineRefs.current.get(`${sceneId}:${idx}`);
      let beforeText = el.text;
      let afterText = '';
      if (sel && sel.rangeCount > 0 && node) {
        // Use a range from start-of-node to cursor to get accurate character offset
        const cursorRange = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(node);
        preRange.setEnd(cursorRange.startContainer, cursorRange.startOffset);
        const charOffset = preRange.toString().length;
        const fullText = node.innerText ?? '';
        if (charOffset < fullText.length) {
          beforeText = fullText.slice(0, charOffset);
          afterText = fullText.slice(charOffset);
        }
      }

      const newType = nextTypeAfter(el.type);
      const newEl: ScreenplayElement = { id: uid(), type: newType, text: afterText };

      // Auto-guess next character for A-B-A dialogue pattern
      if (newType === 'character' && el.type === 'dialogue') {
        const guessed = guessNextCharacter(scene.elements, idx);
        if (guessed) {
          newEl.text = guessed;
          const dialogueLine: ScreenplayElement = { id: uid(), type: 'dialogue', text: afterText };
          pushUndo(scenes);
          const updated = [...scene.elements];
          updated[idx] = { ...updated[idx], text: beforeText };
          updated.splice(idx + 1, 0, newEl, dialogueLine);
          onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
          focusLine(sceneId, idx + 2);
          return;
        }
      }

      pushUndo(scenes);
      const updated = [...scene.elements];
      updated[idx] = { ...updated[idx], text: beforeText };
      updated.splice(idx + 1, 0, newEl);
      onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
      focusLine(sceneId, idx + 1);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      lockedTypes.current.add(`${sceneId}:${idx}`);
      const sel = window.getSelection();
      const cursorOffset = sel?.focusOffset ?? 0;
      const newType = cycleType(el.type);
      pushUndo(scenes);
      const updated = [...scene.elements];
      updated[idx] = { ...updated[idx], type: newType };
      onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
      // Restore cursor after type change
      requestAnimationFrame(() => {
        const node = lineRefs.current.get(`${sceneId}:${idx}`);
        if (node) {
          node.focus();
          const textNode = node.firstChild;
          if (textNode) {
            const range = document.createRange();
            range.setStart(textNode, Math.min(cursorOffset, textNode.textContent?.length ?? 0));
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }
      });
    }
    if (e.key === 'Backspace') {
      if (el.text === '') {
        e.preventDefault();
        // Final Draft behavior: Backspace on empty reverses the type flow
        const reverseType: Record<string, ScreenplayElementType> = {
          'dialogue': 'character',
          'character': 'action',
          'parenthetical': 'dialogue',
          'transition': 'action',
          'scene-heading': 'action',
        };
        const prevType = reverseType[el.type];
        if (prevType) {
          pushUndo(scenes);
          const updated = [...scene.elements];
          updated[idx] = { ...updated[idx], type: prevType };
          onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
          focusLine(sceneId, idx);
        } else if (scene.elements.length > 1) {
          pushUndo(scenes);
          const updated = scene.elements.filter((_, i) => i !== idx);
          onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
          if (idx > 0) focusLine(sceneId, idx - 1);
        }
      } else if (idx > 0) {
        // Backspace at beginning of non-empty line → merge with previous line
        const sel = window.getSelection();
        const node = lineRefs.current.get(`${sceneId}:${idx}`);
        if (sel && sel.rangeCount > 0 && node) {
          const cursorRange = sel.getRangeAt(0);
          const preRange = document.createRange();
          preRange.selectNodeContents(node);
          preRange.setEnd(cursorRange.startContainer, cursorRange.startOffset);
          const charOffset = preRange.toString().length;
          if (charOffset === 0) {
            e.preventDefault();
            const prevEl = scene.elements[idx - 1];
            const mergePoint = prevEl.text.length;
            pushUndo(scenes);
            const updated = [...scene.elements];
            updated[idx - 1] = { ...updated[idx - 1], text: prevEl.text + el.text };
            updated.splice(idx, 1);
            onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
            // Focus previous line at the merge point
            requestAnimationFrame(() => {
              const prevNode = lineRefs.current.get(`${sceneId}:${idx - 1}`);
              if (prevNode) {
                prevNode.focus();
                const textNode = prevNode.firstChild;
                if (textNode) {
                  const range = document.createRange();
                  range.setStart(textNode, Math.min(mergePoint, textNode.textContent?.length ?? 0));
                  range.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
              }
            });
          }
        }
      }
    }
    if (autocomplete.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(p => Math.min(p + 1, autocomplete.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAcIdx(p => Math.max(p - 1, 0)); }
      if (e.key === 'Escape') setAutocomplete([]);
    }
  };

  // Handle paste: intercept to split multi-line pastes into separate elements
  const handlePaste = (e: React.ClipboardEvent, sceneId: string, idx: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    // If single line, let the browser handle it natively (within the contentEditable)
    if (!text.includes('\n')) return;

    e.preventDefault();
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const el = scene.elements[idx];
    const node = lineRefs.current.get(`${sceneId}:${idx}`);
    const sel = window.getSelection();

    // Get cursor position to split current text
    let beforeText = el.text;
    let afterText = '';
    if (sel && sel.rangeCount > 0 && node) {
      const cursorRange = sel.getRangeAt(0);
      const preRange = document.createRange();
      preRange.selectNodeContents(node);
      preRange.setEnd(cursorRange.startContainer, cursorRange.startOffset);
      const charOffset = preRange.toString().length;
      beforeText = el.text.slice(0, charOffset);
      afterText = el.text.slice(charOffset);
    }

    const lines = text.split('\n');
    pushUndo(scenes);
    const updated = [...scene.elements];

    // First line merges with text before cursor
    updated[idx] = { ...updated[idx], text: beforeText + lines[0] };

    // Middle lines become new action elements
    const newElements = lines.slice(1).map((line, i) => ({
      id: uid(),
      type: (i === lines.length - 2 ? el.type : 'action') as ScreenplayElementType,
      text: i === lines.length - 2 ? line + afterText : line,
    }));

    updated.splice(idx + 1, 0, ...newElements);
    onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
    focusLine(sceneId, idx + lines.length - 1);
  };

  // Heading key handler
  const handleHeadingKeyDown = (e: React.KeyboardEvent, sceneId: string) => {
    // Undo/Redo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
      e.preventDefault();
      handleRedo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      setShowFind(true);
      return;
    }

    // Heading autocomplete
    if (headingAC.length > 0 && headingACScene === sceneId) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHeadingACIdx(p => Math.min(p + 1, headingAC.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHeadingACIdx(p => Math.max(p - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (headingAC[headingACIdx]) {
          e.preventDefault();
          updateScene(sceneId, s => ({ ...s, heading: headingAC[headingACIdx].toUpperCase() }));
          setHeadingAC([]);
          setHeadingACScene(null);
          if (e.key === 'Enter') focusLine(sceneId, 0);
          return;
        }
      }
      if (e.key === 'Escape') { setHeadingAC([]); setHeadingACScene(null); return; }
    }

    // Tab in heading: if heading is empty or just has prefix, insert template parts
    if (e.key === 'Tab') {
      e.preventDefault();
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) return;
      const h = scene.heading;
      // If empty, start with INT.
      if (!h.trim()) {
        updateScene(sceneId, s => ({ ...s, heading: 'INT. ' }));
        return;
      }
      // If has prefix but no location, show location prompt
      const match = h.match(/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*$/);
      if (match) {
        // Already has prefix, do nothing (user types location)
        return;
      }
      // If has prefix + location but no dash-time, add " - "
      const fullMatch = h.match(/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s+(.+?)$/);
      if (fullMatch && !h.includes(' - ')) {
        updateScene(sceneId, s => ({ ...s, heading: h + ' - ' }));
        return;
      }
      // If complete, cycle prefix: INT. → EXT. → INT./EXT.
      const prefixCycle = ['INT.', 'EXT.', 'INT./EXT.'];
      const currentPrefix = h.match(/^(INT\.|EXT\.|INT\.\/EXT\.)/)?.[1];
      if (currentPrefix) {
        const ci = prefixCycle.indexOf(currentPrefix);
        const nextPrefix = prefixCycle[(ci + 1) % prefixCycle.length];
        updateScene(sceneId, s => ({ ...s, heading: h.replace(currentPrefix, nextPrefix) }));
      }
      return;
    }

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusLine(sceneId, 0);
    }
    if (e.key === 'ArrowUp') {
      // Move to previous scene's last element
      const sceneIdx = scenes.findIndex(s => s.id === sceneId);
      if (sceneIdx > 0) {
        e.preventDefault();
        const prevScene = scenes[sceneIdx - 1];
        focusLine(prevScene.id, prevScene.elements.length - 1);
      }
    }
  };

  const applyAutocomplete = (sceneId: string, idx: number, name: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    pushUndo(scenes);
    const updated = [...scene.elements];
    updated[idx] = { ...updated[idx], text: name.toUpperCase(), type: 'character' };
    const dialogueLine: ScreenplayElement = { id: uid(), type: 'dialogue', text: '' };
    updated.splice(idx + 1, 0, dialogueLine);
    onScenesChange(scenes.map(s => s.id === sceneId ? { ...s, elements: updated } : s));
    setAutocomplete([]);
    focusLine(sceneId, idx + 1);
  };

  // Find & Replace handler
  const handleReplace = useCallback((searchText: string, replaceText: string, replaceAll: boolean) => {
    pushUndo(scenes);
    const searchLower = searchText.toLowerCase();
    let found = false;

    const updated = scenes.map(scene => {
      const heading = replaceAll
        ? scene.heading.replace(new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replaceText.toUpperCase())
        : scene.heading;

      const elements = scene.elements.map(el => {
        let newText = el.text;
        if (replaceAll) {
          newText = newText.replace(new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replaceText);
        } else if (!found && newText.toLowerCase().includes(searchLower)) {
          const idx = newText.toLowerCase().indexOf(searchLower);
          newText = newText.slice(0, idx) + replaceText + newText.slice(idx + searchText.length);
          found = true;
        }
        return newText !== el.text ? { ...el, text: newText } : el;
      });

      return heading !== scene.heading || elements !== scene.elements
        ? { ...scene, heading, elements }
        : scene;
    });

    onScenesChange(updated);
  }, [scenes, onScenesChange, pushUndo]);

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
        // Only handle if no element is focused
        if (!document.activeElement || document.activeElement === document.body) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo]);

  const pageBreaks = computePageBreaks(scenes);
  const isReadMode = viewMode === 'read';

  // Shared render function for a single item
  const renderItem = (item: RenderItem, i: number): React.ReactNode => {
    if (item.kind === 'page-break') return null;

    if (item.kind === 'dual-dialogue') {
      return (
        <div key={`dual-${i}`} className="flex gap-4" style={{ margin: '4px 0' }}>
          {item.groups.map((group) => (
            <div key={group.side} className="flex-1">
              {group.elements.map(({ element: el, elemIdx: idx }) => {
                const key = `${group.scene.id}:${idx}`;
                return isReadMode ? (
                  <div key={el.id} className={`sp-${el.type}`} style={{
                    ...elementStyle(el.type, t.ink),
                  }}>{el.text || '\u00A0'}</div>
                ) : (
                  <div
                    key={el.id}
                    ref={node => {
                      if (node) { lineRefs.current.set(key, node); if (el.text && (node.innerText ?? '') !== el.text) { if (el.text.includes('\n')) { node.innerHTML = el.text.replace(/\n/g, '<br>'); } else { node.textContent = el.text; } } }
                      else lineRefs.current.delete(key);
                    }}
                    contentEditable suppressContentEditableWarning
                    className={`outline-none bg-transparent border-none sp-${el.type}`}
                    style={{
                      ...elementStyle(el.type, t.ink),
                      caretColor: t.cursor, minHeight: LINE_HEIGHT, whiteSpace: 'pre-wrap',
                    }}
                    onInput={e => handleLineInput(group.scene.id, idx, (e.target as HTMLDivElement).innerText ?? '')}
                    onKeyDown={e => handleKeyDown(e, group.scene.id, idx)}
                    onPaste={e => handlePaste(e, group.scene.id, idx)}
                    onFocus={() => { setFocusedKey(key); onActiveSceneChange(group.scene.id); onFocusedElementInfo?.({ type: el.type, sceneId: group.scene.id, elemIdx: idx }); }}
                    onBlur={() => {
                      const node = lineRefs.current.get(key);
                      if (node) { const text = node.innerText ?? ''; if (text !== el.text) handleLineInput(group.scene.id, idx, text); }
                      setTimeout(() => setAutocomplete([]), 200);
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      );
    }

    if (item.kind === 'heading') {
      const { scene, sceneNumber } = item;
      const isFocusedScene = focusedKey?.startsWith(scene.id);
      return (
        <div
          key={`h-${scene.id}`}
          data-scene-id={scene.id}
          className="relative"
          style={{
            opacity: viewMode === 'focus' && focusedKey && !isFocusedScene ? 0.2 : 1,
            transition: 'opacity 0.3s',
            paddingTop: item.sceneIdx > 0 ? '18px' : 0,
          }}
          onClick={() => onActiveSceneChange(scene.id)}
        >
          {/* Scene number — LEFT only, very faint */}
          <span className="absolute select-none" style={{
            left: '-40px', top: item.sceneIdx > 0 ? '18px' : 0,
            fontFamily: SCREENPLAY_FONT, fontSize: '12px', lineHeight: LINE_HEIGHT,
            color: t.inkFaint, fontWeight: 400, opacity: 0.4,
          }}>{sceneNumber}</span>

          {isReadMode ? (
            <div style={{
              fontFamily: SCREENPLAY_FONT, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT,
              fontWeight: 700, textTransform: 'uppercase', color: t.ink,
            }}>{scene.heading || '\u00A0'}</div>
          ) : (
            <div className="relative">
              <input
                ref={node => { if (node) headingRefs.current.set(scene.id, node); else headingRefs.current.delete(scene.id); }}
                type="text" value={scene.heading}
                onChange={e => handleHeadingInput(scene.id, e.target.value)}
                placeholder="INT. LOCATION - TIME"
                className="w-full bg-transparent outline-none border-none"
                style={{
                  fontFamily: SCREENPLAY_FONT, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT,
                  fontWeight: 700, textTransform: 'uppercase' as const,
                  color: t.ink, caretColor: t.cursor, padding: 0, margin: 0,
                }}
                onFocus={() => { setFocusedKey(`${scene.id}:heading`); onActiveSceneChange(scene.id); onFocusedElementInfo?.({ type: 'scene-heading', sceneId: scene.id, elemIdx: -1 }); }}
                onKeyDown={e => handleHeadingKeyDown(e, scene.id)}
                onBlur={() => { setHeadingAC([]); setHeadingACScene(null); }}
              />
              {headingAC.length > 0 && headingACScene === scene.id && (
                <div className="absolute left-0 top-full mt-1 border rounded-lg py-1 z-10"
                  style={{ backgroundColor: 'var(--color-surface-2, #1a1a1a)', borderColor: t.pageBreak, minWidth: '300px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  {headingAC.map((suggestion, ai) => (
                    <button key={suggestion}
                      className="w-full text-left px-4 py-1.5 cursor-pointer transition-colors"
                      style={{ fontFamily: SCREENPLAY_FONT, fontSize: '12px', color: ai === headingACIdx ? '#c45c4a' : t.ink, backgroundColor: ai === headingACIdx ? 'rgba(196,92,74,0.08)' : 'transparent' }}
                      onMouseDown={e => { e.preventDefault(); updateScene(scene.id, s => ({ ...s, heading: suggestion.toUpperCase() })); setHeadingAC([]); setHeadingACScene(null); }}>
                      {suggestion.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // element
    if (item.kind !== 'element') return null;
    const { scene, element: el, elemIdx: idx } = item;
    const key = `${scene.id}:${idx}`;
    const isFocusedScene = focusedKey?.startsWith(scene.id);
    const isFocusedLine = focusedKey === key;

    return (
      <div key={el.id} className="relative group/line">
        {/* Bookmark indicator — left margin */}
        {el.bookmark && (
          <span className="absolute select-none" style={{
            left: '-24px', top: 0, fontSize: '10px',
            color: '#c45c4a', fontWeight: 700,
          }} title={`Bookmark: ${el.bookmark}`}>&#9733;</span>
        )}
        {/* Revision mark — asterisk in right margin */}
        {showRevisions && el.revised && (
          <span className="absolute select-none" style={{
            right: '-28px', top: 0, fontFamily: SCREENPLAY_FONT,
            fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT,
            color: t.inkFaint, fontWeight: 700,
          }}>*</span>
        )}
        {el.note && (
          <ScriptNoteIcon note={el.note} color={t.cursor}
            onChange={(note) => { pushUndo(scenes); const updated = [...scene.elements]; updated[idx] = { ...updated[idx], note: note || undefined }; onScenesChange(scenes.map(s => s.id === scene.id ? { ...s, elements: updated } : s)); }} />
        )}
        {!el.note && !isReadMode && (
          <button className="absolute opacity-0 group-hover/line:opacity-40 hover:!opacity-100 transition-opacity cursor-pointer"
            style={{ right: '-32px', top: '2px', fontSize: '12px', color: t.inkFaint, background: 'none', border: 'none', padding: 0 }}
            title="Add script note"
            onClick={() => { pushUndo(scenes); const updated = [...scene.elements]; updated[idx] = { ...updated[idx], note: ' ' }; onScenesChange(scenes.map(s => s.id === scene.id ? { ...s, elements: updated } : s)); }}>
            ✎
          </button>
        )}
        {isReadMode ? (
          <div className={`sp-${el.type}`} style={{
            ...elementStyle(el.type, t.ink),
          }}>
            {el.text || '\u00A0'}
          </div>
        ) : (
          <div
            ref={node => { if (node) { lineRefs.current.set(key, node); if (el.text && (node.innerText ?? '') !== el.text) { if (el.text.includes('\n')) { node.innerHTML = el.text.replace(/\n/g, '<br>'); } else { node.textContent = el.text; } } } else lineRefs.current.delete(key); }}
            contentEditable suppressContentEditableWarning
            className={`outline-none bg-transparent border-none sp-${el.type}`}
            style={{
              ...elementStyle(el.type, viewMode === 'focus' && !isFocusedLine && focusedKey && isFocusedScene ? t.inkFaint : t.ink),
              caretColor: t.cursor, minHeight: LINE_HEIGHT, whiteSpace: 'pre-wrap', transition: 'color 0.3s',
            }}
            onInput={e => handleLineInput(scene.id, idx, (e.target as HTMLDivElement).innerText ?? '')}
            onKeyDown={e => handleKeyDown(e, scene.id, idx)}
            onPaste={e => handlePaste(e, scene.id, idx)}
            onFocus={() => { setFocusedKey(key); onActiveSceneChange(scene.id); onFocusedElementInfo?.({ type: el.type, sceneId: scene.id, elemIdx: idx }); scrollToCenter(key); }}
            onBlur={() => { const node = lineRefs.current.get(key); if (node) { const text = node.innerText ?? ''; if (text !== el.text) handleLineInput(scene.id, idx, text); } setTimeout(() => setAutocomplete([]), 200); }}
          />
        )}
        {autocomplete.length > 0 && focusedKey === key && (
          <div className="absolute mt-1 border rounded-lg py-1 z-10"
            style={{ left: '36.7%', backgroundColor: 'var(--color-surface-2, #1a1a1a)', borderColor: t.pageBreak, minWidth: '200px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
            {autocomplete.map((name, ai) => (
              <button key={name} className="w-full text-left px-4 py-1.5 cursor-pointer transition-colors"
                style={{ fontFamily: SCREENPLAY_FONT, fontSize: '12px', color: ai === acIdx ? '#c45c4a' : t.ink, backgroundColor: ai === acIdx ? 'rgba(196,92,74,0.08)' : 'transparent' }}
                onMouseDown={e => { e.preventDefault(); applyAutocomplete(scene.id, idx, name); }}>
                {name.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Build flat render list with CONT'D and dual dialogue grouping
  const renderItems: RenderItem[] = [];
  let sceneNumber = 1;
  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    renderItems.push({ kind: 'heading', scene, sceneIdx: si, sceneNumber: sceneNumber++ });

    let inDual = false;
    let dualGroup: { scene: ScreenplayScene; sceneIdx: number; elements: { element: ScreenplayElement; elemIdx: number }[]; side: 'left' | 'right' }[] = [];

    for (let ei = 0; ei < scene.elements.length; ei++) {
      const el = scene.elements[ei];

      // Page break with auto CONT'D
      const pb = pageBreaks.get(`${scene.id}:${ei}`);
      if (pb) {
        // Check if previous element was dialogue and next continues from same character
        const prevEl = ei > 0 ? scene.elements[ei - 1] : null;
        const charName = findCharacterForDialogue(scene.elements, ei);
        const contd = prevEl && (prevEl.type === 'dialogue' || prevEl.type === 'parenthetical') && charName;
        if (contd) {
          renderItems.push({ kind: 'page-break', pageNum: pb, contdName: charName });
        } else {
          renderItems.push({ kind: 'page-break', pageNum: pb });
        }
      }

      // Dual dialogue grouping
      if (el.type === 'dual-start') {
        inDual = true;
        dualGroup = [];
        continue;
      }
      if (el.type === 'dual-end') {
        if (dualGroup.length > 0) {
          renderItems.push({ kind: 'dual-dialogue', scene, sceneIdx: si, groups: dualGroup });
        }
        inDual = false;
        dualGroup = [];
        continue;
      }

      if (inDual && el.dual) {
        const side = el.dual;
        let group = dualGroup.find(g => g.side === side);
        if (!group) {
          group = { scene, sceneIdx: si, elements: [], side };
          dualGroup.push(group);
        }
        group.elements.push({ element: el, elemIdx: ei });
        continue;
      }

      renderItems.push({ kind: 'element', scene, sceneIdx: si, element: el, elemIdx: ei });
    }
  }

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden relative"
      style={{ background: t.desk }}
    >
      {/* Find & Replace */}
      {showFind && (
        <FindReplace
          scenes={scenes}
          theme={theme}
          onReplace={handleReplace}
          onClose={() => setShowFind(false)}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth" style={{ cursor: 'text' }}
        onClick={(e) => {
          if (e.target === e.currentTarget && scenes.length > 0) {
            const lastScene = scenes[scenes.length - 1];
            if (lastScene && lastScene.elements.length > 0) {
              focusLine(lastScene.id, lastScene.elements.length - 1);
            }
          }
        }}>
        {scenes.length === 0 && (
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
        {scenes.length > 0 && (() => {
          const isPageView = scriptView === 'page' || scriptView === 'focus';
          const isSpeed = scriptView === 'speed';

          // Split renderItems into pages at page-break boundaries
          const pages: RenderItem[][] = [[]];
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
                  if (e.target === e.currentTarget) {
                    const lastScene = scenes[scenes.length - 1];
                    if (lastScene && lastScene.elements.length > 0) {
                      focusLine(lastScene.id, lastScene.elements.length - 1);
                    }
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
                if (e.target === e.currentTarget) {
                  const lastScene = scenes[scenes.length - 1];
                  if (lastScene && lastScene.elements.length > 0) {
                    focusLine(lastScene.id, lastScene.elements.length - 1);
                  }
                }
              }}
            >
              {/* Watermark overlay */}
              {watermark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 1 }}>
                  <span style={{
                    fontSize: 60, fontFamily: SCREENPLAY_FONT, color: t.inkFaint,
                    opacity: 0.08, transform: 'rotate(-45deg)', whiteSpace: 'nowrap',
                    letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase',
                  }}>{watermark}</span>
                </div>
              )}

              {/* Page number — right-aligned header */}
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

              {/* CONT'D label at top of page */}
              {contdLabels.get(pageIdx) && (
                <div style={{
                  fontFamily: SCREENPLAY_FONT, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT,
                  color: t.inkFaint, marginLeft: '36.7%', marginBottom: 8, textTransform: 'uppercase',
                }}>
                  {contdLabels.get(pageIdx)} (CONT&apos;D)
                </div>
              )}

              {pageItems.map((item, i) => renderItem(item, i))}

              {/* (MORE) label at bottom of page if dialogue continues to next page */}
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

type RenderItem =
  | { kind: 'heading'; scene: ScreenplayScene; sceneIdx: number; sceneNumber: number }
  | { kind: 'element'; scene: ScreenplayScene; sceneIdx: number; element: ScreenplayElement; elemIdx: number }
  | { kind: 'page-break'; pageNum: number; contdName?: string }
  | { kind: 'dual-dialogue'; scene: ScreenplayScene; sceneIdx: number; groups: { scene: ScreenplayScene; sceneIdx: number; elements: { element: ScreenplayElement; elemIdx: number }[]; side: 'left' | 'right' }[] };

// Find the character name that owns a dialogue/parenthetical at given index
function findCharacterForDialogue(elements: ScreenplayElement[], idx: number): string | null {
  for (let i = idx - 1; i >= 0; i--) {
    if (elements[i].type === 'character') return elements[i].text.trim();
    if (elements[i].type !== 'dialogue' && elements[i].type !== 'parenthetical') return null;
  }
  return null;
}

function computePageBreaks(scenes: ScreenplayScene[]): Map<string, number> {
  const breaks = new Map<string, number>();
  let lineCount = 0;
  let page = 1;
  for (const scene of scenes) {
    lineCount += 2;
    for (let i = 0; i < scene.elements.length; i++) {
      const lines = estimateLines(scene.elements[i]);
      lineCount += lines;
      if (lineCount >= LINES_PER_PAGE) {
        page++;
        lineCount = lines;
        breaks.set(`${scene.id}:${i}`, page);
      }
    }
  }
  return breaks;
}
