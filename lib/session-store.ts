// Lightweight session persistence via localStorage
// Each "project" is a story session with its logline, characters, and progress

import type { Character, DimensionAnswer, CharacterPortrait } from './types';

export interface StoredSession {
  id: string;
  logline: string;
  characters: Character[];
  exploredIds: string[];
  portraits: Record<string, CharacterPortrait>;
  // Per-character answers for resume (optional, saves explore progress)
  answers: Record<string, DimensionAnswer[]>;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'sceneflow_sessions';

function readAll(): StoredSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: StoredSession[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getSessions(): StoredSession[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): StoredSession | null {
  return readAll().find(s => s.id === id) ?? null;
}

export function saveSession(session: StoredSession) {
  const all = readAll();
  const idx = all.findIndex(s => s.id === session.id);
  const updated = { ...session, updatedAt: Date.now() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  writeAll(all);
}

export function deleteSession(id: string) {
  writeAll(readAll().filter(s => s.id !== id));
}

export function createSessionId(): string {
  return `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
