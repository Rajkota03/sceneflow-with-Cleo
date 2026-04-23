// The Canvas — V2 pre-writing surface.
// Free 2D placement. Cards with types, states, threads, emotions, ghost history.
// Soft deletion to the Shelf. Never destroy.

export type CardType = 'beat' | 'moment' | 'question' | 'fragment';
export type CardStatus = 'raw' | 'developing' | 'outlined' | 'written' | 'cut';
export type Emotion = 'dread' | 'hope' | 'grief' | 'anger' | 'tenderness' | 'awe';

export const CARD_TYPES: CardType[] = ['beat', 'moment', 'question', 'fragment'];
export const CARD_STATUSES: CardStatus[] = ['raw', 'developing', 'outlined', 'written', 'cut'];
export const EMOTIONS: Emotion[] = ['dread', 'hope', 'grief', 'anger', 'tenderness', 'awe'];

export const EMOTION_COLORS: Record<Emotion, string> = {
  dread:      '#3a5a8c',
  hope:       '#d4a24a',
  grief:      '#5a6878',
  anger:      '#c45c4a',
  tenderness: '#c08494',
  awe:        '#7a9a6a',
};

export const STATUS_COLORS: Record<CardStatus, string> = {
  raw:        '#5a5440',
  developing: '#8a8578',
  outlined:   '#d4a24a',
  written:    '#7a9a6a',
  cut:        '#c45c4a',
};

export const TYPE_ICONS: Record<CardType, string> = {
  beat:     '◆',
  moment:   '✦',
  question: '?',
  fragment: '/',
};

export const THREAD_PALETTE = [
  '#c45c4a', '#d4a24a', '#7a9a6a', '#6888cc',
  '#8a7a9a', '#c08494', '#5a8474', '#a87a5a',
];

export interface CardGhost {
  text: string;
  updatedAt: number;
}

export interface CanvasCard {
  id: string;
  type: CardType;
  text: string;
  position: { x: number; y: number };
  status: CardStatus;
  emotion: Emotion | null;
  threadIds: string[];
  ghostHistory: CardGhost[];  // max 5, newest first
  createdAt: number;
  updatedAt: number;
  shelvedAt: number | null;
}

export interface CanvasThread {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface CanvasRoomState {
  cards: CanvasCard[];
  threads: CanvasThread[];
  viewport: { panX: number; panY: number; zoom: number };
  lastReaderSuggestions: ReaderObservation[];
}

export interface ReaderObservation {
  id: string;
  text: string;
  referencedCardIds: string[];
  generatedAt: number;
}

const STORAGE_KEY = 'sceneflow_canvas_room';

function defaultState(): CanvasRoomState {
  return {
    cards: [],
    threads: [],
    viewport: { panX: 0, panY: 0, zoom: 1 },
    lastReaderSuggestions: [],
  };
}

function readState(): CanvasRoomState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function writeState(state: CanvasRoomState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota — silent
  }
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Queries ──

export function getCanvasRoom(): CanvasRoomState {
  return readState();
}

// ── Card mutations ──

export function createCard(params: {
  text?: string;
  type?: CardType;
  position: { x: number; y: number };
}): CanvasCard {
  const state = readState();
  const now = Date.now();
  const card: CanvasCard = {
    id: uid('c'),
    type: params.type ?? 'beat',
    text: params.text ?? '',
    position: params.position,
    status: 'raw',
    emotion: null,
    threadIds: [],
    ghostHistory: [],
    createdAt: now,
    updatedAt: now,
    shelvedAt: null,
  };
  state.cards = [card, ...state.cards];
  writeState(state);
  return card;
}

export function updateCard(id: string, patch: Partial<Pick<CanvasCard,
  'text' | 'type' | 'status' | 'emotion' | 'position' | 'threadIds'
>>): CanvasCard | null {
  const state = readState();
  const idx = state.cards.findIndex(c => c.id === id);
  if (idx === -1) return null;
  const prev = state.cards[idx];
  // If text changed meaningfully, push to ghost history (cap 5)
  let ghostHistory = prev.ghostHistory;
  if (patch.text !== undefined && patch.text !== prev.text && prev.text.trim().length > 0) {
    ghostHistory = [{ text: prev.text, updatedAt: prev.updatedAt }, ...ghostHistory].slice(0, 5);
  }
  // If emotion is set for the first time, auto-advance status raw → developing
  let status = patch.status ?? prev.status;
  if (patch.emotion && !prev.emotion && status === 'raw') status = 'developing';
  const next: CanvasCard = {
    ...prev, ...patch,
    status,
    ghostHistory,
    updatedAt: Date.now(),
  };
  state.cards[idx] = next;
  writeState(state);
  return next;
}

export function shelveCard(id: string): CanvasCard | null {
  return updateCard(id, { status: 'cut' }) && markShelved(id, true);
}

function markShelved(id: string, shelved: boolean): CanvasCard | null {
  const state = readState();
  const idx = state.cards.findIndex(c => c.id === id);
  if (idx === -1) return null;
  state.cards[idx] = {
    ...state.cards[idx],
    shelvedAt: shelved ? Date.now() : null,
    updatedAt: Date.now(),
  };
  writeState(state);
  return state.cards[idx];
}

export function restoreCard(id: string): CanvasCard | null {
  return markShelved(id, false) && updateCard(id, { status: 'developing' });
}

export function hardDeleteCard(id: string): boolean {
  const state = readState();
  const before = state.cards.length;
  state.cards = state.cards.filter(c => c.id !== id);
  if (state.cards.length === before) return false;
  writeState(state);
  return true;
}

export function restoreGhost(cardId: string, ghostIndex: number): CanvasCard | null {
  const state = readState();
  const idx = state.cards.findIndex(c => c.id === cardId);
  if (idx === -1) return null;
  const card = state.cards[idx];
  const ghost = card.ghostHistory[ghostIndex];
  if (!ghost) return null;
  // Push current text to ghost history, then apply ghost as current
  const newGhosts = [
    { text: card.text, updatedAt: card.updatedAt },
    ...card.ghostHistory.filter((_, i) => i !== ghostIndex),
  ].slice(0, 5);
  state.cards[idx] = {
    ...card,
    text: ghost.text,
    ghostHistory: newGhosts,
    updatedAt: Date.now(),
  };
  writeState(state);
  return state.cards[idx];
}

// ── Thread mutations ──

export function createThread(name: string, color?: string): CanvasThread {
  const state = readState();
  const existingColors = new Set(state.threads.map(t => t.color));
  const nextColor = color ?? THREAD_PALETTE.find(c => !existingColors.has(c)) ?? THREAD_PALETTE[0];
  const thread: CanvasThread = {
    id: uid('t'),
    name: name.trim() || 'untitled',
    color: nextColor,
    createdAt: Date.now(),
  };
  state.threads.push(thread);
  writeState(state);
  return thread;
}

export function deleteThread(id: string) {
  const state = readState();
  state.threads = state.threads.filter(t => t.id !== id);
  // Untag all cards
  state.cards = state.cards.map(c =>
    c.threadIds.includes(id)
      ? { ...c, threadIds: c.threadIds.filter(tid => tid !== id), updatedAt: Date.now() }
      : c
  );
  writeState(state);
}

export function toggleCardThread(cardId: string, threadId: string): CanvasCard | null {
  const state = readState();
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return null;
  const has = card.threadIds.includes(threadId);
  return updateCard(cardId, {
    threadIds: has
      ? card.threadIds.filter(t => t !== threadId)
      : [...card.threadIds, threadId],
  });
}

// ── Viewport ──

export function saveViewport(v: { panX: number; panY: number; zoom: number }) {
  const state = readState();
  state.viewport = v;
  writeState(state);
}

// ── Reader suggestions ──

export function saveReaderObservation(obs: Omit<ReaderObservation, 'id' | 'generatedAt'>) {
  const state = readState();
  const next: ReaderObservation = {
    id: uid('o'),
    generatedAt: Date.now(),
    ...obs,
  };
  state.lastReaderSuggestions = [next, ...state.lastReaderSuggestions].slice(0, 20);
  writeState(state);
  return next;
}

export function clearRoom() {
  writeState(defaultState());
}
