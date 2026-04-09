// ============================================================
// DOCUMENT OPERATIONS
// ============================================================
// Atomic, composable operations on the document model.
// Each operation is a pure function: (Doc, Op) → Doc
// Operations are invertible for undo.

import type { Doc, Block, BlockType, BlockMeta, CursorPosition } from './model';
import { blockId } from './model';

// ─── Operation Types ───

export type Operation =
  | { op: 'insert_text'; blockId: string; offset: number; text: string }
  | { op: 'delete_text'; blockId: string; offset: number; length: number }
  | { op: 'split_block'; blockId: string; offset: number; newBlockId: string; newType: BlockType }
  | { op: 'merge_blocks'; targetId: string; sourceId: string }
  | { op: 'set_type'; blockId: string; blockType: BlockType; lock: boolean }
  | { op: 'set_text'; blockId: string; text: string }
  | { op: 'insert_block'; afterId: string | null; block: Block }
  | { op: 'remove_block'; blockId: string }
  | { op: 'move_block'; blockId: string; afterId: string | null }
  | { op: 'set_meta'; blockId: string; key: keyof BlockMeta; value: unknown }
  | { op: 'set_cursor'; position: CursorPosition };

// ─── Apply a single operation ───

export function applyOp(doc: Doc, operation: Operation): Doc {
  switch (operation.op) {
    case 'insert_text': {
      const blocks = doc.blocks.map(b =>
        b.id === operation.blockId
          ? { ...b, text: b.text.slice(0, operation.offset) + operation.text + b.text.slice(operation.offset) }
          : b
      );
      return { ...doc, blocks };
    }

    case 'delete_text': {
      const blocks = doc.blocks.map(b =>
        b.id === operation.blockId
          ? { ...b, text: b.text.slice(0, operation.offset) + b.text.slice(operation.offset + operation.length) }
          : b
      );
      return { ...doc, blocks };
    }

    case 'split_block': {
      const idx = doc.blocks.findIndex(b => b.id === operation.blockId);
      if (idx === -1) return doc;
      const block = doc.blocks[idx];
      const before = { ...block, text: block.text.slice(0, operation.offset) };
      const after: Block = {
        id: operation.newBlockId,
        type: operation.newType,
        text: block.text.slice(operation.offset),
        meta: {},
      };
      const blocks = [...doc.blocks];
      blocks.splice(idx, 1, before, after);
      return { ...doc, blocks };
    }

    case 'merge_blocks': {
      const targetIdx = doc.blocks.findIndex(b => b.id === operation.targetId);
      const sourceIdx = doc.blocks.findIndex(b => b.id === operation.sourceId);
      if (targetIdx === -1 || sourceIdx === -1) return doc;
      const target = doc.blocks[targetIdx];
      const source = doc.blocks[sourceIdx];
      const merged = { ...target, text: target.text + source.text };
      const blocks = doc.blocks.filter(b => b.id !== operation.sourceId);
      return { ...doc, blocks: blocks.map(b => b.id === operation.targetId ? merged : b) };
    }

    case 'set_type': {
      const blocks = doc.blocks.map(b =>
        b.id === operation.blockId
          ? { ...b, type: operation.blockType, meta: { ...b.meta, locked: operation.lock || undefined } }
          : b
      );
      return { ...doc, blocks };
    }

    case 'set_text': {
      const blocks = doc.blocks.map(b =>
        b.id === operation.blockId ? { ...b, text: operation.text } : b
      );
      return { ...doc, blocks };
    }

    case 'insert_block': {
      const blocks = [...doc.blocks];
      if (operation.afterId === null) {
        blocks.unshift(operation.block);
      } else {
        const idx = blocks.findIndex(b => b.id === operation.afterId);
        if (idx === -1) blocks.push(operation.block);
        else blocks.splice(idx + 1, 0, operation.block);
      }
      return { ...doc, blocks };
    }

    case 'remove_block': {
      return { ...doc, blocks: doc.blocks.filter(b => b.id !== operation.blockId) };
    }

    case 'move_block': {
      const block = doc.blocks.find(b => b.id === operation.blockId);
      if (!block) return doc;
      const without = doc.blocks.filter(b => b.id !== operation.blockId);
      if (operation.afterId === null) {
        return { ...doc, blocks: [block, ...without] };
      }
      const idx = without.findIndex(b => b.id === operation.afterId);
      if (idx === -1) return { ...doc, blocks: [...without, block] };
      const blocks = [...without];
      blocks.splice(idx + 1, 0, block);
      return { ...doc, blocks };
    }

    case 'set_meta': {
      const blocks = doc.blocks.map(b =>
        b.id === operation.blockId
          ? { ...b, meta: { ...b.meta, [operation.key]: operation.value } }
          : b
      );
      return { ...doc, blocks };
    }

    case 'set_cursor': {
      return { ...doc, cursor: { position: operation.position, selection: null } };
    }
  }
}

// ─── Inverse operations (for undo) ───

export function invertOp(doc: Doc, operation: Operation): Operation | null {
  switch (operation.op) {
    case 'insert_text':
      return { op: 'delete_text', blockId: operation.blockId, offset: operation.offset, length: operation.text.length };

    case 'delete_text': {
      const block = doc.blocks.find(b => b.id === operation.blockId);
      if (!block) return null;
      const deleted = block.text.slice(operation.offset, operation.offset + operation.length);
      return { op: 'insert_text', blockId: operation.blockId, offset: operation.offset, text: deleted };
    }

    case 'split_block':
      return { op: 'merge_blocks', targetId: operation.blockId, sourceId: operation.newBlockId };

    case 'merge_blocks': {
      const target = doc.blocks.find(b => b.id === operation.targetId);
      const source = doc.blocks.find(b => b.id === operation.sourceId);
      if (!target || !source) return null;
      return { op: 'split_block', blockId: operation.targetId, offset: target.text.length, newBlockId: operation.sourceId, newType: source.type };
    }

    case 'set_type': {
      const block = doc.blocks.find(b => b.id === operation.blockId);
      if (!block) return null;
      return { op: 'set_type', blockId: operation.blockId, blockType: block.type, lock: !!block.meta.locked };
    }

    case 'set_text': {
      const block = doc.blocks.find(b => b.id === operation.blockId);
      if (!block) return null;
      return { op: 'set_text', blockId: operation.blockId, text: block.text };
    }

    case 'insert_block':
      return { op: 'remove_block', blockId: operation.block.id };

    case 'remove_block': {
      const idx = doc.blocks.findIndex(b => b.id === operation.blockId);
      if (idx === -1) return null;
      const block = doc.blocks[idx];
      const afterId = idx > 0 ? doc.blocks[idx - 1].id : null;
      return { op: 'insert_block', afterId, block: { ...block } };
    }

    case 'move_block': {
      const idx = doc.blocks.findIndex(b => b.id === operation.blockId);
      if (idx === -1) return null;
      const afterId = idx > 0 ? doc.blocks[idx - 1].id : null;
      return { op: 'move_block', blockId: operation.blockId, afterId };
    }

    case 'set_meta': {
      const block = doc.blocks.find(b => b.id === operation.blockId);
      if (!block) return null;
      return { op: 'set_meta', blockId: operation.blockId, key: operation.key, value: block.meta[operation.key] };
    }

    case 'set_cursor':
      return { op: 'set_cursor', position: doc.cursor.position };
  }
}

// ─── Apply multiple operations atomically ───

export function applyOps(doc: Doc, operations: Operation[]): Doc {
  let result = doc;
  for (const op of operations) {
    result = applyOp(result, op);
  }
  return result;
}
