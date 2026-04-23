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

// ── Import provenance ──

export type ImportFormat =
  | 'fdx' | 'fountain' | 'pdf_screenplay' | 'scrivener'
  | 'csv' | 'opml'
  | 'docx' | 'gdoc' | 'markdown' | 'text' | 'pdf_prose'
  | 'image_typed' | 'image_handwritten' | 'folder' | 'paste';

export interface ImportOrigin {
  sourceFileId: string;
  sourcePassageRef: string;
  parsedBy: 'structural' | 'ai';
  parsedAt: number;
}

export interface SourcePassage {
  ref: string;
  importedFileId: string;
  startOffset: number;
  endOffset: number;
  pageNumber: number | null;
  text: string;
}

export interface ImportedFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  contentBody: string;                    // source text, kept for provenance display (localStorage only for now)
  contentHash: string;                    // hash of contentBody
  importedAt: number;
  sourceLastModified: number | null;
  format: ImportFormat;
  parseStatus: 'pending' | 'parsed' | 'failed' | 'partial';
  referenceCardId: string | null;
  passages: SourcePassage[];
}

export interface ProposedCard {
  id: string;
  sourcePassageRef: string;
  text: string;                            // original wording from source
  suggestedType: CardType;
  decision: 'pending' | 'accepted' | 'dismissed' | 'edited';
  acceptedCardId: string | null;
  editedText: string | null;
}

export interface StagingSession {
  id: string;
  importedFileId: string;
  status: 'open' | 'completed' | 'abandoned';
  proposedCards: ProposedCard[];
  createdAt: number;
  lastActiveAt: number;
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
  importOrigin?: ImportOrigin | null;      // NEW — null/undefined for hand-created cards
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
  importedFiles: ImportedFile[];
  stagingSessions: StagingSession[];
  readerSuppressedUntil: number | null;     // Reader auto-observations suppressed until this timestamp
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
    importedFiles: [],
    stagingSessions: [],
    readerSuppressedUntil: null,
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

// ── Feature flags ──
// Default: structural + staging on, others off. All runtime-flippable from dev console.

export interface ImportFeatureFlags {
  structural: boolean;
  staging: boolean;
  images: boolean;
  gdocs: boolean;
  resurrection: boolean;
}

const FEATURE_FLAG_KEY = 'sceneflow_feature_import';

export function getImportFlags(): ImportFeatureFlags {
  if (typeof window === 'undefined') return defaultImportFlags();
  try {
    const raw = localStorage.getItem(FEATURE_FLAG_KEY);
    if (!raw) return defaultImportFlags();
    return { ...defaultImportFlags(), ...JSON.parse(raw) };
  } catch { return defaultImportFlags(); }
}

export function setImportFlags(flags: Partial<ImportFeatureFlags>) {
  if (typeof window === 'undefined') return;
  const next = { ...getImportFlags(), ...flags };
  localStorage.setItem(FEATURE_FLAG_KEY, JSON.stringify(next));
}

function defaultImportFlags(): ImportFeatureFlags {
  return {
    structural: true,    // FDX, Fountain
    staging: true,       // paste prose
    images: false,       // OCR — needs backend
    gdocs: false,        // OAuth — needs backend
    resurrection: false, // AI diagnostic — ship after staging is proven
  };
}

// ── Import mutations ──

function hashText(s: string): string {
  // Cheap stable hash for content dedup / integrity check (not cryptographic)
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `h${h.toString(36)}_${s.length}`;
}

export function createImportedFile(params: {
  originalFilename: string;
  mimeType: string;
  contentBody: string;
  format: ImportFormat;
  sourceLastModified?: number | null;
  passages?: SourcePassage[];
}): ImportedFile {
  const state = readState();
  const file: ImportedFile = {
    id: uid('f'),
    originalFilename: params.originalFilename,
    mimeType: params.mimeType,
    sizeBytes: params.contentBody.length,
    contentBody: params.contentBody,
    contentHash: hashText(params.contentBody),
    importedAt: Date.now(),
    sourceLastModified: params.sourceLastModified ?? null,
    format: params.format,
    parseStatus: 'pending',
    referenceCardId: null,
    passages: params.passages ?? [],
  };
  state.importedFiles.push(file);
  writeState(state);
  return file;
}

export function updateImportedFile(id: string, patch: Partial<Pick<ImportedFile,
  'parseStatus' | 'referenceCardId' | 'passages'
>>): ImportedFile | null {
  const state = readState();
  const idx = state.importedFiles.findIndex(f => f.id === id);
  if (idx === -1) return null;
  state.importedFiles[idx] = { ...state.importedFiles[idx], ...patch };
  writeState(state);
  return state.importedFiles[idx];
}

export function getImportedFile(id: string): ImportedFile | null {
  return readState().importedFiles.find(f => f.id === id) ?? null;
}

export function createStagingSession(importedFileId: string, proposedCards: ProposedCard[]): StagingSession {
  const state = readState();
  const now = Date.now();
  const session: StagingSession = {
    id: uid('s'),
    importedFileId,
    status: 'open',
    proposedCards,
    createdAt: now,
    lastActiveAt: now,
  };
  state.stagingSessions.push(session);
  writeState(state);
  return session;
}

export function updateStagingSession(id: string, patch: Partial<Pick<StagingSession,
  'status' | 'proposedCards' | 'lastActiveAt'
>>): StagingSession | null {
  const state = readState();
  const idx = state.stagingSessions.findIndex(s => s.id === id);
  if (idx === -1) return null;
  state.stagingSessions[idx] = { ...state.stagingSessions[idx], ...patch, lastActiveAt: Date.now() };
  writeState(state);
  return state.stagingSessions[idx];
}

export function getStagingSession(id: string): StagingSession | null {
  return readState().stagingSessions.find(s => s.id === id) ?? null;
}

/**
 * Create a card from a staging proposal. Links the card back to its source passage.
 * The card appears on the Canvas immediately; the staging session is updated.
 */
export function acceptProposal(sessionId: string, proposalId: string, position: { x: number; y: number }, overrideText?: string): CanvasCard | null {
  const state = readState();
  const sessionIdx = state.stagingSessions.findIndex(s => s.id === sessionId);
  if (sessionIdx === -1) return null;
  const session = state.stagingSessions[sessionIdx];
  const propIdx = session.proposedCards.findIndex(p => p.id === proposalId);
  if (propIdx === -1) return null;
  const proposal = session.proposedCards[propIdx];
  if (proposal.decision === 'accepted') return null;

  const now = Date.now();
  const card: CanvasCard = {
    id: uid('c'),
    type: proposal.suggestedType,
    text: overrideText ?? proposal.editedText ?? proposal.text,
    position,
    status: 'raw',
    emotion: null,                   // per spec — never auto-tag emotion on import
    threadIds: [],
    ghostHistory: [],
    createdAt: now,
    updatedAt: now,
    shelvedAt: null,
    importOrigin: {
      sourceFileId: session.importedFileId,
      sourcePassageRef: proposal.sourcePassageRef,
      parsedBy: 'ai',
      parsedAt: now,
    },
  };
  state.cards.unshift(card);

  // Mark proposal accepted
  session.proposedCards[propIdx] = {
    ...proposal,
    decision: overrideText ? 'edited' : 'accepted',
    acceptedCardId: card.id,
    editedText: overrideText ?? proposal.editedText,
  };

  writeState(state);
  return card;
}

export function dismissProposal(sessionId: string, proposalId: string): boolean {
  const state = readState();
  const session = state.stagingSessions.find(s => s.id === sessionId);
  if (!session) return false;
  const prop = session.proposedCards.find(p => p.id === proposalId);
  if (!prop || prop.decision === 'accepted') return false;
  prop.decision = 'dismissed';
  session.lastActiveAt = Date.now();
  writeState(state);
  return true;
}

/**
 * Change the suggested card type for a proposal.
 * Allowed while decision is 'pending' or 'dismissed' — not after the card has been created.
 */
export function setProposalType(sessionId: string, proposalId: string, type: CardType): boolean {
  const state = readState();
  const session = state.stagingSessions.find(s => s.id === sessionId);
  if (!session) return false;
  const prop = session.proposedCards.find(p => p.id === proposalId);
  if (!prop) return false;
  if (prop.decision === 'accepted' || prop.decision === 'edited') return false;
  prop.suggestedType = type;
  session.lastActiveAt = Date.now();
  writeState(state);
  return true;
}

/**
 * Store an in-progress edit to a proposal's text WITHOUT changing its decision.
 * Empty text clears the edit (so the original `text` is used again on accept).
 */
export function setProposalEditedText(sessionId: string, proposalId: string, text: string): boolean {
  const state = readState();
  const session = state.stagingSessions.find(s => s.id === sessionId);
  if (!session) return false;
  const prop = session.proposedCards.find(p => p.id === proposalId);
  if (!prop) return false;
  const trimmed = text.trim();
  prop.editedText = trimmed.length === 0 || trimmed === prop.text ? null : text;
  session.lastActiveAt = Date.now();
  writeState(state);
  return true;
}

/**
 * Accept every pending proposal in one pass. Positions laid out in a 4-col loose cluster,
 * starting from `startingAcceptedCount` so cards don't collide with previously accepted ones.
 */
export function acceptAllPending(sessionId: string, startingAcceptedCount: number): { accepted: CanvasCard[] } {
  const state = readState();
  const session = state.stagingSessions.find(s => s.id === sessionId);
  if (!session) return { accepted: [] };
  const accepted: CanvasCard[] = [];
  let i = startingAcceptedCount;
  const now = Date.now();
  for (const prop of session.proposedCards) {
    if (prop.decision !== 'pending') continue;
    const position = {
      x: 300 + (i % 4) * 270,
      y: 100 + Math.floor(i / 4) * 160,
    };
    const card: CanvasCard = {
      id: uid('c'),
      type: prop.suggestedType,
      text: prop.editedText ?? prop.text,
      position,
      status: 'raw',
      emotion: null,
      threadIds: [],
      ghostHistory: [],
      createdAt: now,
      updatedAt: now,
      shelvedAt: null,
      importOrigin: {
        sourceFileId: session.importedFileId,
        sourcePassageRef: prop.sourcePassageRef,
        parsedBy: 'ai',
        parsedAt: now,
      },
    };
    state.cards.unshift(card);
    prop.decision = prop.editedText ? 'edited' : 'accepted';
    prop.acceptedCardId = card.id;
    accepted.push(card);
    i++;
  }
  if (accepted.length > 0) {
    session.lastActiveAt = Date.now();
    writeState(state);
  }
  return { accepted };
}

/**
 * Create a batch of cards in one transaction (for structural imports: FDX, Fountain).
 * Each card has importOrigin set.
 */
export function createCardsFromImport(
  importedFileId: string,
  items: Array<{ text: string; type: CardType; sourcePassageRef: string; position: { x: number; y: number } }>
): CanvasCard[] {
  const state = readState();
  const now = Date.now();
  const newCards: CanvasCard[] = items.map(item => ({
    id: uid('c'),
    type: item.type,
    text: item.text,
    position: item.position,
    status: 'raw',
    emotion: null,
    threadIds: [],
    ghostHistory: [],
    createdAt: now,
    updatedAt: now,
    shelvedAt: null,
    importOrigin: {
      sourceFileId: importedFileId,
      sourcePassageRef: item.sourcePassageRef,
      parsedBy: 'structural',
      parsedAt: now,
    },
  }));
  state.cards = [...newCards, ...state.cards];
  writeState(state);
  return newCards;
}

export function setReaderSuppressedUntil(ts: number | null) {
  const state = readState();
  state.readerSuppressedUntil = ts;
  writeState(state);
}

export function isReaderSuppressed(): boolean {
  const ts = readState().readerSuppressedUntil;
  return ts !== null && ts > Date.now();
}
