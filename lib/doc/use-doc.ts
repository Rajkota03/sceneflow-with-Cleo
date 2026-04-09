// ============================================================
// useDoc — React hook for the document engine
// ============================================================
// Wraps the document model, transaction system, and intent engine
// into a single React hook. The editor component calls this instead
// of managing raw state arrays.

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import type { Doc, Block, BlockType, CursorPosition, DerivedScene } from './model';
import { deriveScenes, buildIndex, createDoc } from './model';
import type { DocHistory } from './transaction';
import { createHistory, commit, commitWithCoalesce, undo as undoHistory, redo as redoHistory, TransactionBuilder } from './transaction';
import { resolveIntent, keyToIntent } from './intent';
import { extractCharacters } from './classifier';
import type { Intent, KeyEvent } from './intent';

export interface UseDocReturn {
  // Document state
  doc: Doc;
  blocks: Block[];
  scenes: DerivedScene[];
  characters: string[];

  // Mutations
  dispatch: (intent: Intent) => void;
  dispatchKey: (event: KeyEvent, blockId: string, offset: number, blockType: BlockType) => Intent | null;
  updateText: (blockId: string, text: string) => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Direct doc manipulation (for bridge operations)
  setDoc: (doc: Doc) => void;
  getDoc: () => Doc;

  // Cursor
  setCursor: (position: CursorPosition) => void;

  // Version (for change detection)
  version: number;
}

export function useDoc(initialDoc?: Doc): UseDocReturn {
  const [history, setHistory] = useState<DocHistory>(() =>
    createHistory(initialDoc ?? createDoc())
  );

  const historyRef = useRef(history);
  historyRef.current = history;

  const doc = history.doc;
  const blocks = doc.blocks;
  const version = doc.version;

  // Derived data (memoized)
  const scenes = useMemo(() => deriveScenes(blocks), [blocks]);
  const characters = useMemo(() => extractCharacters(blocks), [blocks]);

  // ─── Dispatch an intent ───
  const dispatch = useCallback((intent: Intent) => {
    setHistory(prev => {
      const knownChars = extractCharacters(prev.doc.blocks);

      // Handle undo/redo at the history level
      if (intent.intent === 'undo') {
        return undoHistory(prev) ?? prev;
      }
      if (intent.intent === 'redo') {
        return redoHistory(prev) ?? prev;
      }

      const builder = resolveIntent(prev.doc, intent, knownChars);
      if (!builder || builder.isEmpty()) return prev;

      // Use coalescing for text updates
      if (intent.intent === 'update_text') {
        return commitWithCoalesce(prev, builder);
      }

      return commit(prev, builder);
    });
  }, []);

  // ─── Keystroke → Intent → Dispatch ───
  const dispatchKey = useCallback((event: KeyEvent, blockId: string, offset: number, blockType: BlockType): Intent | null => {
    const intent = keyToIntent(event, blockId, offset, blockType);
    if (intent) {
      dispatch(intent);
    }
    return intent;
  }, [dispatch]);

  // ─── Update text (convenience wrapper) ───
  const updateText = useCallback((blockId: string, text: string) => {
    dispatch({ intent: 'update_text', blockId, text });
  }, [dispatch]);

  // ─── Undo / Redo ───
  const undo = useCallback(() => dispatch({ intent: 'undo' }), [dispatch]);
  const redo = useCallback(() => dispatch({ intent: 'redo' }), [dispatch]);

  // ─── Direct doc manipulation ───
  const setDoc = useCallback((newDoc: Doc) => {
    setHistory(createHistory(newDoc));
  }, []);

  const getDoc = useCallback(() => historyRef.current.doc, []);

  // ─── Cursor ───
  const setCursor = useCallback((position: CursorPosition) => {
    setHistory(prev => {
      const builder = new TransactionBuilder(prev.doc, 'set_cursor');
      builder.push({ op: 'set_cursor', position });
      // Don't push cursor changes to undo stack — commit silently
      const { doc: newDoc } = builder.commit();
      return { ...prev, doc: { ...newDoc, version: prev.doc.version } };
    });
  }, []);

  return {
    doc,
    blocks,
    scenes,
    characters,
    dispatch,
    dispatchKey,
    updateText,
    undo,
    redo,
    canUndo: history.undoStack.length > 0,
    canRedo: history.redoStack.length > 0,
    setDoc,
    getDoc,
    setCursor,
    version,
  };
}
