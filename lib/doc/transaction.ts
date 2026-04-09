// ============================================================
// TRANSACTION SYSTEM
// ============================================================
// Groups operations into undoable units.
// Each transaction captures: operations + inverse operations + cursor state.
// History is a stack of transactions with configurable depth.

import type { Doc, Cursor } from './model';
import type { Operation } from './operations';
import { applyOp, applyOps, invertOp } from './operations';

export interface Transaction {
  ops: Operation[];
  inverseOps: Operation[];  // pre-computed at commit time from correct doc state
  cursorBefore: Cursor;
  cursorAfter: Cursor;
  timestamp: number;
  label?: string;  // human-readable description for debugging
}

export interface DocHistory {
  doc: Doc;
  undoStack: Transaction[];
  redoStack: Transaction[];
  maxHistory: number;
}

export function createHistory(doc: Doc, maxHistory = 100): DocHistory {
  return { doc, undoStack: [], redoStack: [], maxHistory };
}

// ─── Transaction Builder ───
// Collects operations, then commits them as one undoable unit.

export class TransactionBuilder {
  private ops: Operation[] = [];
  private cursorBefore: Cursor;
  private doc: Doc;
  private label?: string;

  constructor(doc: Doc, label?: string) {
    this.doc = doc;
    this.cursorBefore = { ...doc.cursor, position: { ...doc.cursor.position } };
    this.label = label;
  }

  /** Add an operation to this transaction. */
  push(op: Operation): this {
    this.ops.push(op);
    return this;
  }

  /** Add multiple operations. */
  pushAll(ops: Operation[]): this {
    this.ops.push(...ops);
    return this;
  }

  /** Get the operations collected so far. */
  getOps(): readonly Operation[] {
    return this.ops;
  }

  /** Check if any operations were added. */
  isEmpty(): boolean {
    return this.ops.length === 0;
  }

  /** Commit: apply all ops to the doc and return a Transaction for undo. */
  commit(cursorAfter?: Cursor): { doc: Doc; transaction: Transaction } {
    // Compute inverse ops BEFORE applying, walking forward through ops
    // so each invertOp sees the doc state right before that op was applied.
    const inverseOps: Operation[] = [];
    let walkDoc = this.doc;
    for (const op of this.ops) {
      const inv = invertOp(walkDoc, op);
      if (inv) inverseOps.push(inv);
      walkDoc = applyOp(walkDoc, op);
    }
    inverseOps.reverse(); // reverse so they undo in correct order

    const finalCursor = cursorAfter ?? walkDoc.cursor;
    const doc: Doc = {
      ...walkDoc,
      cursor: finalCursor,
      version: this.doc.version + 1,
    };

    const transaction: Transaction = {
      ops: this.ops,
      inverseOps,
      cursorBefore: this.cursorBefore,
      cursorAfter: finalCursor,
      timestamp: Date.now(),
      label: this.label,
    };

    return { doc, transaction };
  }
}

// ─── History Operations ───

/** Apply a transaction and push it onto the undo stack. */
export function commit(history: DocHistory, builder: TransactionBuilder, cursorAfter?: Cursor): DocHistory {
  if (builder.isEmpty()) return history;

  const { doc, transaction } = builder.commit(cursorAfter);

  const undoStack = [...history.undoStack, transaction];
  if (undoStack.length > history.maxHistory) undoStack.shift();

  return {
    ...history,
    doc,
    undoStack,
    redoStack: [], // clear redo on new edit
    maxHistory: history.maxHistory,
  };
}

/** Undo the last transaction. Returns null if nothing to undo. */
export function undo(history: DocHistory): DocHistory | null {
  if (history.undoStack.length === 0) return null;

  const txn = history.undoStack[history.undoStack.length - 1];

  // Apply pre-computed inverse ops (already in correct reverse order)
  const undoneDoc = applyOps(history.doc, txn.inverseOps);

  const doc: Doc = {
    ...undoneDoc,
    cursor: txn.cursorBefore,
    version: history.doc.version + 1,
  };

  return {
    doc,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, txn],
    maxHistory: history.maxHistory,
  };
}

/** Redo the last undone transaction. Returns null if nothing to redo. */
export function redo(history: DocHistory): DocHistory | null {
  if (history.redoStack.length === 0) return null;

  const txn = history.redoStack[history.redoStack.length - 1];
  const doc = applyOps(history.doc, txn.ops);
  const finalDoc: Doc = {
    ...doc,
    cursor: txn.cursorAfter,
    version: history.doc.version + 1,
  };

  return {
    doc: finalDoc,
    undoStack: [...history.undoStack, txn],
    redoStack: history.redoStack.slice(0, -1),
    maxHistory: history.maxHistory,
  };
}

// ─── Transaction coalescing ───
// Merge rapid text edits into a single undo step (like typing a word).

const COALESCE_WINDOW_MS = 500;

export function shouldCoalesce(prev: Transaction | undefined, next: TransactionBuilder): boolean {
  if (!prev) return false;
  if (Date.now() - prev.timestamp > COALESCE_WINDOW_MS) return false;

  // Only coalesce single insert_text or delete_text operations
  const nextOps = next.getOps();
  if (prev.ops.length !== 1 || nextOps.length !== 1) return false;

  const prevOp = prev.ops[0];
  const nextOp = nextOps[0];

  // Coalesce consecutive inserts in the same block
  if (prevOp.op === 'insert_text' && nextOp.op === 'insert_text') {
    return prevOp.blockId === nextOp.blockId
      && nextOp.offset === prevOp.offset + prevOp.text.length;
  }

  // Coalesce consecutive deletes in the same block
  if (prevOp.op === 'delete_text' && nextOp.op === 'delete_text') {
    return prevOp.blockId === nextOp.blockId
      && (nextOp.offset === prevOp.offset || nextOp.offset === prevOp.offset - nextOp.length);
  }

  return false;
}

/** Merge a new transaction into the previous one. */
export function coalesce(prev: Transaction, builder: TransactionBuilder, cursorAfter: Cursor): Transaction {
  const { transaction } = builder.commit(cursorAfter);
  return {
    ops: [...prev.ops, ...transaction.ops],
    inverseOps: [...transaction.inverseOps, ...prev.inverseOps], // new inverse first, then old
    cursorBefore: prev.cursorBefore,
    cursorAfter: transaction.cursorAfter,
    timestamp: transaction.timestamp,
    label: prev.label,
  };
}

/** Commit with auto-coalescing for text edits. */
export function commitWithCoalesce(history: DocHistory, builder: TransactionBuilder, cursorAfter?: Cursor): DocHistory {
  if (builder.isEmpty()) return history;

  const lastTxn = history.undoStack[history.undoStack.length - 1];

  if (shouldCoalesce(lastTxn, builder)) {
    const { doc } = builder.commit(cursorAfter);
    const finalDoc: Doc = { ...doc, version: history.doc.version + 1 };
    const merged = coalesce(lastTxn, builder, finalDoc.cursor);

    return {
      doc: finalDoc,
      undoStack: [...history.undoStack.slice(0, -1), merged],
      redoStack: [],
      maxHistory: history.maxHistory,
    };
  }

  return commit(history, builder, cursorAfter);
}
