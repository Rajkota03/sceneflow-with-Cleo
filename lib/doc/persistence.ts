// ============================================================
// DOC PERSISTENCE — localStorage adapter for the Doc model
// ============================================================
// Replaces the old screenplay-store for Doc-native storage.
// All docs stored under a single key as a JSON record keyed by doc ID.

import type { Doc } from './model';
import type { Screenplay } from '../types';
import { screenplayToDoc } from './bridge';

const STORAGE_KEY = 'sceneflow_docs';
const OLD_STORAGE_KEY = 'sceneflow_screenplays';

// ─── Internal helpers ───

function readAllDocs(): Record<string, Doc> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAllDocs(data: Record<string, Doc>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function countWords(doc: Doc): number {
  let count = 0;
  for (const block of doc.blocks) {
    const trimmed = block.text.trim();
    if (trimmed.length > 0) {
      count += trimmed.split(/\s+/).length;
    }
  }
  return count;
}

// ─── Public API ───

export function saveDoc(doc: Doc): void {
  const all = readAllDocs();
  all[doc.id] = doc;
  writeAllDocs(all);
}

export function loadDoc(id: string): Doc | null {
  return readAllDocs()[id] ?? null;
}

export function listDocs(): Array<{ id: string; title: string; updatedAt: number; wordCount: number }> {
  const all = readAllDocs();
  return Object.values(all).map(doc => ({
    id: doc.id,
    title: doc.title,
    updatedAt: doc.version, // version increments per transaction, serves as a logical timestamp
    wordCount: countWords(doc),
  }));
}

export function deleteDoc(id: string): void {
  const all = readAllDocs();
  delete all[id];
  writeAllDocs(all);
}

// ─── Migration from old Screenplay format ───

export function migrateScreenplay(sp: Screenplay): Doc {
  const doc = screenplayToDoc(sp);
  saveDoc(doc);
  return doc;
}

export function migrateAllScreenplays(): Doc[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (!raw) return [];
    const screenplays: Record<string, Screenplay> = JSON.parse(raw);
    const existing = readAllDocs();
    const migrated: Doc[] = [];

    for (const sp of Object.values(screenplays)) {
      // Skip if already migrated (same ID exists in doc storage)
      if (existing[sp.sessionId]) continue;
      const doc = screenplayToDoc(sp);
      existing[doc.id] = doc;
      migrated.push(doc);
    }

    if (migrated.length > 0) {
      writeAllDocs(existing);
    }
    return migrated;
  } catch {
    return [];
  }
}

// ─── Auto-save with debounce ───

let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function autoSave(doc: Doc, debounceMs = 1000): () => void {
  if (_autoSaveTimer) {
    clearTimeout(_autoSaveTimer);
  }
  _autoSaveTimer = setTimeout(() => {
    saveDoc(doc);
    _autoSaveTimer = null;
  }, debounceMs);

  return () => {
    if (_autoSaveTimer) {
      clearTimeout(_autoSaveTimer);
      _autoSaveTimer = null;
    }
  };
}
