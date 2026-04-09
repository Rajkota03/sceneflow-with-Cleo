// ============================================================
// INTENT ENGINE
// ============================================================
// Maps user actions (keystrokes, clicks) to semantic intents.
// Intents are then resolved into document operations.
// This separation means the editor UI never touches the document directly.

import type { Doc, Block, BlockType, CursorPosition } from './model';
import { blockId, createBlock } from './model';
import type { Operation } from './operations';
import { nextTypeAfter, cycleType, reverseType, guessNextCharacter, classify } from './classifier';
import { TransactionBuilder } from './transaction';

// ─── Intent Types ───

export type Intent =
  | { intent: 'split_block'; blockId: string; offset: number }
  | { intent: 'delete_backward'; blockId: string; offset: number }
  | { intent: 'cycle_type'; blockId: string }
  | { intent: 'force_type'; blockId: string; type: BlockType }
  | { intent: 'insert_line_break'; blockId: string; offset: number }
  | { intent: 'update_text'; blockId: string; text: string }
  | { intent: 'toggle_bookmark'; blockId: string }
  | { intent: 'toggle_note'; blockId: string }
  | { intent: 'move_scene'; sceneHeadingId: string; afterSceneHeadingId: string | null }
  | { intent: 'paste_multiline'; blockId: string; offset: number; lines: string[] }
  | { intent: 'undo' }
  | { intent: 'redo' };

// ─── Intent Resolution ───
// Resolves an intent into a TransactionBuilder with operations.

export function resolveIntent(doc: Doc, intent: Intent, knownCharacters: string[]): TransactionBuilder | null {
  switch (intent.intent) {
    case 'split_block':
      return resolveSplitBlock(doc, intent.blockId, intent.offset, knownCharacters);

    case 'delete_backward':
      return resolveDeleteBackward(doc, intent.blockId, intent.offset);

    case 'cycle_type':
      return resolveCycleType(doc, intent.blockId);

    case 'force_type':
      return resolveForceType(doc, intent.blockId, intent.type);

    case 'update_text':
      return resolveUpdateText(doc, intent.blockId, intent.text, knownCharacters);

    case 'toggle_bookmark':
      return resolveToggleBookmark(doc, intent.blockId);

    case 'toggle_note':
      return resolveToggleNote(doc, intent.blockId);

    case 'paste_multiline':
      return resolvePasteMultiline(doc, intent.blockId, intent.offset, intent.lines);

    case 'undo':
    case 'redo':
      return null; // handled by history layer, not operations

    default:
      return null;
  }
}

// ─── Split Block (Enter key) ───

function resolveSplitBlock(doc: Doc, bid: string, offset: number, knownCharacters: string[]): TransactionBuilder {
  const idx = doc.blocks.findIndex(b => b.id === bid);
  const block = doc.blocks[idx];
  const tx = new TransactionBuilder(doc, 'split_block');

  // Empty action → switch to character (Final Draft behavior)
  if (block.text.trim() === '' && block.type === 'action') {
    tx.push({ op: 'set_type', blockId: bid, blockType: 'character', lock: true });
    tx.push({ op: 'set_cursor', position: { blockId: bid, offset: 0 } });
    return tx;
  }

  const newType = nextTypeAfter(block.type);
  const newId = blockId();
  const afterText = block.text.slice(offset);
  const beforeText = block.text.slice(0, offset);

  // A-B-A dialogue pattern: auto-insert character cue
  if (newType === 'action' && block.type === 'dialogue') {
    const guessed = guessNextCharacter(doc.blocks, idx);
    if (guessed) {
      // Split into: [before] [CHARACTER] [dialogue with afterText]
      tx.push({ op: 'set_text', blockId: bid, text: beforeText });
      const charBlock = createBlock('character', guessed);
      tx.push({ op: 'insert_block', afterId: bid, block: charBlock });
      const dialogueBlock = createBlock('dialogue', afterText);
      tx.push({ op: 'insert_block', afterId: charBlock.id, block: dialogueBlock });
      tx.push({ op: 'set_cursor', position: { blockId: dialogueBlock.id, offset: 0 } });
      return tx;
    }
  }

  // Standard split
  tx.push({ op: 'split_block', blockId: bid, offset, newBlockId: newId, newType });
  tx.push({ op: 'set_cursor', position: { blockId: newId, offset: 0 } });

  return tx;
}

// ─── Delete Backward (Backspace) ───

function resolveDeleteBackward(doc: Doc, bid: string, offset: number): TransactionBuilder {
  const idx = doc.blocks.findIndex(b => b.id === bid);
  const block = doc.blocks[idx];
  const tx = new TransactionBuilder(doc, 'delete_backward');

  // Backspace in middle of text — let browser handle it
  if (offset > 0) return tx; // empty transaction = no-op

  // At beginning of block
  if (block.text === '') {
    // Empty block: reverse type flow
    const reversed = reverseType(block.type);
    if (reversed !== block.type) {
      tx.push({ op: 'set_type', blockId: bid, blockType: reversed, lock: false });
      tx.push({ op: 'set_cursor', position: { blockId: bid, offset: 0 } });
    } else if (idx > 0 && doc.blocks.length > 1) {
      // Can't reverse further, remove empty block
      tx.push({ op: 'remove_block', blockId: bid });
      const prev = doc.blocks[idx - 1];
      tx.push({ op: 'set_cursor', position: { blockId: prev.id, offset: prev.text.length } });
    }
  } else if (offset === 0 && idx > 0) {
    // Non-empty block, cursor at position 0: merge with previous
    const prev = doc.blocks[idx - 1];
    const mergePoint = prev.text.length;
    tx.push({ op: 'merge_blocks', targetId: prev.id, sourceId: bid });
    tx.push({ op: 'set_cursor', position: { blockId: prev.id, offset: mergePoint } });
  }

  return tx;
}

// ─── Cycle Type (Tab) ───

function resolveCycleType(doc: Doc, bid: string): TransactionBuilder {
  const block = doc.blocks.find(b => b.id === bid);
  if (!block) return new TransactionBuilder(doc);
  const tx = new TransactionBuilder(doc, 'cycle_type');
  const newType = cycleType(block.type);
  tx.push({ op: 'set_type', blockId: bid, blockType: newType, lock: true });
  return tx;
}

// ─── Force Type (Cmd+1-6) ───

function resolveForceType(doc: Doc, bid: string, type: BlockType): TransactionBuilder {
  const tx = new TransactionBuilder(doc, 'force_type');
  tx.push({ op: 'set_type', blockId: bid, blockType: type, lock: true });
  return tx;
}

// ─── Update Text ───

function resolveUpdateText(doc: Doc, bid: string, text: string, knownCharacters: string[]): TransactionBuilder {
  const idx = doc.blocks.findIndex(b => b.id === bid);
  const block = doc.blocks[idx];
  if (!block) return new TransactionBuilder(doc);

  const tx = new TransactionBuilder(doc, 'update_text');
  tx.push({ op: 'set_text', blockId: bid, text });

  // Re-classify unless locked
  if (!block.meta.locked) {
    const prevBlock = idx > 0 ? doc.blocks[idx - 1] : null;
    const newType = classify({ ...block, text }, { prevBlock, knownCharacters });
    if (newType !== null && newType !== block.type) {
      tx.push({ op: 'set_type', blockId: bid, blockType: newType, lock: false });
    }
  }

  return tx;
}

// ─── Toggle Bookmark ───

function resolveToggleBookmark(doc: Doc, bid: string): TransactionBuilder {
  const block = doc.blocks.find(b => b.id === bid);
  if (!block) return new TransactionBuilder(doc);
  const tx = new TransactionBuilder(doc, 'toggle_bookmark');
  tx.push({
    op: 'set_meta', blockId: bid, key: 'bookmark',
    value: block.meta.bookmark ? undefined : 'Bookmark',
  });
  return tx;
}

// ─── Toggle Note ───

function resolveToggleNote(doc: Doc, bid: string): TransactionBuilder {
  const block = doc.blocks.find(b => b.id === bid);
  if (!block) return new TransactionBuilder(doc);
  const tx = new TransactionBuilder(doc, 'toggle_note');
  tx.push({
    op: 'set_meta', blockId: bid, key: 'note',
    value: block.meta.note ? undefined : ' ',
  });
  return tx;
}

// ─── Paste Multiline ───

function resolvePasteMultiline(doc: Doc, bid: string, offset: number, lines: string[]): TransactionBuilder {
  const idx = doc.blocks.findIndex(b => b.id === bid);
  const block = doc.blocks[idx];
  if (!block || lines.length === 0) return new TransactionBuilder(doc);

  const tx = new TransactionBuilder(doc, 'paste_multiline');
  const beforeText = block.text.slice(0, offset);
  const afterText = block.text.slice(offset);

  // First line merges with text before cursor
  tx.push({ op: 'set_text', blockId: bid, text: beforeText + lines[0] });

  // Middle lines become new action blocks
  let lastId = bid;
  for (let i = 1; i < lines.length; i++) {
    const isLast = i === lines.length - 1;
    const text = isLast ? lines[i] + afterText : lines[i];
    const newBlock = createBlock('action', text);
    tx.push({ op: 'insert_block', afterId: lastId, block: newBlock });
    lastId = newBlock.id;
  }

  tx.push({ op: 'set_cursor', position: { blockId: lastId, offset: lines[lines.length - 1].length } });
  return tx;
}

// ─── Keystroke → Intent mapping ───
// Pure function: takes a keyboard event description and returns an Intent.
// This runs in the UI layer and feeds into resolveIntent.

export interface KeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function keyToIntent(event: KeyEvent, blockId: string, offset: number, blockType: BlockType): Intent | null {
  const mod = event.metaKey || event.ctrlKey;

  // Undo/Redo
  if (mod && event.key === 'z' && !event.shiftKey) return { intent: 'undo' };
  if (mod && event.key === 'z' && event.shiftKey) return { intent: 'redo' };
  if (mod && event.key === 'y') return { intent: 'redo' };

  // Force type: Cmd+1-6
  if (mod && event.key >= '1' && event.key <= '6') {
    const typeMap: Record<string, BlockType> = {
      '1': 'scene-heading', '2': 'action', '3': 'character',
      '4': 'parenthetical', '5': 'dialogue', '6': 'transition',
    };
    return { intent: 'force_type', blockId, type: typeMap[event.key] };
  }

  // Bookmark toggle: Cmd+M
  if (mod && event.key === 'm') return { intent: 'toggle_bookmark', blockId };

  // Tab: cycle type
  if (event.key === 'Tab' && !mod && !event.shiftKey) return { intent: 'cycle_type', blockId };

  // Enter: split block (Shift+Enter is handled differently — line break within block)
  if (event.key === 'Enter' && !event.shiftKey && !mod) return { intent: 'split_block', blockId, offset };

  // Backspace at position 0
  if (event.key === 'Backspace' && offset === 0) return { intent: 'delete_backward', blockId, offset: 0 };

  return null;
}
