// Story Room — the scratchpad. Ideas that haven't earned a scene yet.
// Each note has a relationship to the script (floating, anchored, version).
// Persisted in its own localStorage key — separate from Kleo's memory.

export type NoteAnchor =
  | { type: 'floating' }
  | { type: 'before-scene'; sceneId: string }
  | { type: 'after-scene'; sceneId: string }
  | { type: 'inside-scene'; sceneId: string }
  | { type: 'version-of'; sceneId: string };

export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green';

export interface StoryNote {
  id: string;
  text: string;
  anchor: NoteAnchor;
  parentNoteId?: string;      // set when spawned via "Try another version"
  createdAt: number;
  updatedAt: number;
  color?: NoteColor;
  promoted?: boolean;          // true if it became an actual scene
}

export interface StorySummary {
  paragraph: string;
  threads: string[];
  generatedAt: number;
}

export interface StoryRoomState {
  notes: StoryNote[];
  lastSummary?: StorySummary;
}

const STORAGE_KEY = 'sceneflow_story_room';

function defaultState(): StoryRoomState {
  return { notes: [] };
}

function readState(): StoryRoomState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function writeState(state: StoryRoomState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota or disabled — silent
  }
}

export function getStoryRoom(): StoryRoomState {
  return readState();
}

function uid(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addNote(text: string, anchor: NoteAnchor = { type: 'floating' }, parentNoteId?: string): StoryNote {
  const state = readState();
  const now = Date.now();
  const note: StoryNote = {
    id: uid(),
    text: text.trim(),
    anchor,
    parentNoteId,
    createdAt: now,
    updatedAt: now,
  };
  state.notes = [note, ...state.notes];
  writeState(state);
  return note;
}

export function updateNote(id: string, patch: Partial<Pick<StoryNote, 'text' | 'anchor' | 'color' | 'promoted'>>): StoryNote | null {
  const state = readState();
  const idx = state.notes.findIndex(n => n.id === id);
  if (idx === -1) return null;
  state.notes[idx] = { ...state.notes[idx], ...patch, updatedAt: Date.now() };
  writeState(state);
  return state.notes[idx];
}

export function deleteNote(id: string): boolean {
  const state = readState();
  const before = state.notes.length;
  state.notes = state.notes.filter(n => n.id !== id);
  if (state.notes.length === before) return false;
  writeState(state);
  return true;
}

export function spawnVersion(parentId: string, text?: string): StoryNote | null {
  const state = readState();
  const parent = state.notes.find(n => n.id === parentId);
  if (!parent) return null;
  // Inherit parent's anchor — if the parent is itself a version-of, point at the same scene
  const anchor: NoteAnchor = parent.anchor.type === 'version-of'
    ? parent.anchor
    : (parent.anchor.type === 'floating'
        ? { type: 'floating' }
        : { type: 'version-of', sceneId: getAnchorSceneId(parent.anchor) ?? '' });
  return addNote(text ?? '', anchor, parent.id);
}

export function saveSummary(summary: Omit<StorySummary, 'generatedAt'>) {
  const state = readState();
  state.lastSummary = { ...summary, generatedAt: Date.now() };
  writeState(state);
}

export function clearRoom() {
  writeState(defaultState());
}

// ── Helpers ──

export function getAnchorSceneId(anchor: NoteAnchor): string | null {
  if (anchor.type === 'floating') return null;
  return anchor.sceneId;
}

export function describeAnchor(anchor: NoteAnchor, sceneHeading?: string): string {
  if (anchor.type === 'floating') return 'Floating';
  const short = sceneHeading ? ` — ${sceneHeading}` : '';
  switch (anchor.type) {
    case 'before-scene':  return `Before scene${short}`;
    case 'after-scene':   return `After scene${short}`;
    case 'inside-scene':  return `Inside scene${short}`;
    case 'version-of':    return `Version of${short}`;
  }
}
