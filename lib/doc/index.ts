// ============================================================
// SCENEFLOW DOCUMENT ENGINE — PUBLIC API
// ============================================================

// Model
export type { Doc, Block, BlockType, BlockMeta, CursorPosition, Selection, Cursor, TitlePageData, DerivedScene, BlockIndex } from './model';
export { deriveScenes, buildIndex, blockId, createBlock, createDoc } from './model';

// Operations
export type { Operation } from './operations';
export { applyOp, applyOps, invertOp } from './operations';

// Transactions
export type { Transaction, DocHistory } from './transaction';
export { TransactionBuilder, createHistory, commit, undo, redo, commitWithCoalesce } from './transaction';

// Classifier
export { classify, nextTypeAfter, cycleType, reverseType, extractCharacters, matchCharacters, guessNextCharacter, classifyAll } from './classifier';
export type { ClassifierContext } from './classifier';

// Intent Engine
export type { Intent, KeyEvent } from './intent';
export { resolveIntent, keyToIntent } from './intent';

// Bridge (old ↔ new)
export { screenplayToDoc, docToScreenplay, patchScreenplayFromDoc } from './bridge';

// Persistence
export { saveDoc, loadDoc, listDocs, deleteDoc, migrateScreenplay, migrateAllScreenplays, autoSave } from './persistence';

// FDX Import
export { parseFdxToDoc } from './fdx';

// Fountain Import
export { parseFountain } from './fountain';

// PDF Export
export { docToPdf } from './pdf';

// Layout & Statistics
export type { PageBreakInfo, DocStats, SceneStats } from './layout';
export { estimateBlockLines, computePageBreaks, computePageLayout, computeStats, computeSceneStats } from './layout';

// React Hook
export { useDoc } from './use-doc';
export type { UseDocReturn } from './use-doc';
