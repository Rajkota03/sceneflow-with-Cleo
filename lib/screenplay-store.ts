import type { Screenplay } from './types';

const STORAGE_KEY = 'sceneflow_screenplays';

function readAll(): Record<string, Screenplay> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, Screenplay>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getScreenplay(sessionId: string): Screenplay | null {
  return readAll()[sessionId] ?? null;
}

export function saveScreenplay(sp: Screenplay) {
  const all = readAll();
  all[sp.sessionId] = { ...sp, updatedAt: Date.now() };
  writeAll(all);
}

export function deleteScreenplay(sessionId: string) {
  const all = readAll();
  delete all[sessionId];
  writeAll(all);
}

export function createEmptyScreenplay(sessionId: string, title: string): Screenplay {
  return {
    sessionId,
    title,
    scenes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

let idCounter = 0;
export function uid(): string {
  return `el_${Date.now()}_${++idCounter}`;
}

// ─── Draft Snapshots ───

export interface DraftSnapshot {
  id: string;
  label: string;
  screenplay: Screenplay;
  createdAt: number;
}

function snapshotKey(sessionId: string): string {
  return `sceneflow_snapshots_${sessionId}`;
}

export function getSnapshots(sessionId: string): DraftSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(snapshotKey(sessionId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSnapshot(sessionId: string, label: string, screenplay: Screenplay): void {
  const snapshots = getSnapshots(sessionId);
  snapshots.unshift({
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label,
    screenplay: JSON.parse(JSON.stringify(screenplay)),
    createdAt: Date.now(),
  });
  // Keep max 20 snapshots
  if (snapshots.length > 20) snapshots.length = 20;
  localStorage.setItem(snapshotKey(sessionId), JSON.stringify(snapshots));
}

export function restoreSnapshot(snapshot: DraftSnapshot): Screenplay {
  return JSON.parse(JSON.stringify(snapshot.screenplay));
}

export function deleteSnapshot(sessionId: string, snapshotId: string): void {
  const snapshots = getSnapshots(sessionId).filter(s => s.id !== snapshotId);
  localStorage.setItem(snapshotKey(sessionId), JSON.stringify(snapshots));
}
