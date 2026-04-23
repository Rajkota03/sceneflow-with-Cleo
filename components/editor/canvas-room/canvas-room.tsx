'use client';
// The Canvas — V2 pre-writing surface.
//
// An infinite 2D plane. Cards drop where you click. They drag, they stack,
// they snap to a spine baseline. Threads are colored cross-cutting tags.
// The Shelf holds what you cut. Ghost Layer holds what you wrote before.
// The Reader is quiet unless asked — and every AI word references a card ID.
//
// This is a separate mode from the existing Story Room — both live side
// by side so the writer can compare and choose.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCanvasRoom, createCard, updateCard, shelveCard, restoreCard, hardDeleteCard,
  restoreGhost, createThread, deleteThread, toggleCardThread, saveViewport,
  saveReaderObservation,
  createImportedFile, updateImportedFile, createStagingSession,
  setReaderSuppressedUntil, getImportFlags,
  type CanvasCard, type CanvasThread, type CardType, type CardStatus, type Emotion,
  type ReaderObservation, type ProposedCard, type SourcePassage,
  CARD_TYPES, CARD_STATUSES, EMOTIONS, EMOTION_COLORS, STATUS_COLORS, TYPE_ICONS, THREAD_PALETTE,
} from '@/lib/canvas-room-store';
import { importStructuralFile } from '@/lib/import/structural';
import { ReaderPanel } from './reader-panel';
import { StagingRoom } from './staging-room';

interface CanvasRoomProps {
  open: boolean;
  onClose: () => void;
}

type ZoomLevel = 'read' | 'shape' | 'waveform';

// ── Main shell ──

export function CanvasRoom({ open, onClose }: CanvasRoomProps) {
  const [cards, setCards] = useState<CanvasCard[]>([]);
  const [threads, setThreads] = useState<CanvasThread[]>([]);
  const [observations, setObservations] = useState<ReaderObservation[]>([]);
  const [viewport, setViewport] = useState({ panX: 0, panY: 0, zoom: 1 });
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [threadFilter, setThreadFilter] = useState<Set<string>>(new Set());
  const [ghostViewing, setGhostViewing] = useState<{ cardId: string; index: number } | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [stagingSessionId, setStagingSessionId] = useState<string | null>(null);
  const [importBanner, setImportBanner] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load ──
  useEffect(() => {
    if (!open) return;
    const state = getCanvasRoom();
    setCards(state.cards);
    setThreads(state.threads);
    setObservations(state.lastReaderSuggestions);
    setViewport(state.viewport);
  }, [open]);

  // Persist viewport (debounced)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => saveViewport(viewport), 300);
    return () => clearTimeout(t);
  }, [viewport, open]);

  // ── Card actions ──

  const handleCreateCardAt = useCallback((screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (screenX - rect.left - viewport.panX) / viewport.zoom;
    const y = (screenY - rect.top - viewport.panY) / viewport.zoom;
    const card = createCard({ position: { x, y } });
    setCards(prev => [card, ...prev]);
    setFocusedCardId(card.id);
  }, [viewport]);

  const handleCreateAtCenter = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const jitter = () => (Math.random() - 0.5) * 40;
    const x = (rect.width / 2 - viewport.panX) / viewport.zoom + jitter();
    const y = (rect.height / 2 - viewport.panY) / viewport.zoom + jitter();
    const card = createCard({ position: { x, y } });
    setCards(prev => [card, ...prev]);
    setFocusedCardId(card.id);
  }, [viewport]);

  const handleUpdateCard = useCallback((id: string, patch: Parameters<typeof updateCard>[1]) => {
    const updated = updateCard(id, patch);
    if (updated) setCards(prev => prev.map(c => c.id === id ? updated : c));
  }, []);

  const handleShelveCard = useCallback((id: string) => {
    const updated = shelveCard(id);
    if (updated) setCards(prev => prev.map(c => c.id === id ? updated : c));
    setFocusedCardId(null);
  }, []);

  const handleRestoreCard = useCallback((id: string) => {
    const updated = restoreCard(id);
    if (updated) setCards(prev => prev.map(c => c.id === id ? updated : c));
  }, []);

  const handleHardDelete = useCallback((id: string) => {
    if (hardDeleteCard(id)) setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleRestoreGhost = useCallback((cardId: string, index: number) => {
    const updated = restoreGhost(cardId, index);
    if (updated) setCards(prev => prev.map(c => c.id === cardId ? updated : c));
    setGhostViewing(null);
  }, []);

  // ── Threads ──

  const handleCreateThread = useCallback((name: string) => {
    const t = createThread(name);
    setThreads(prev => [...prev, t]);
    return t;
  }, []);

  const handleDeleteThread = useCallback((id: string) => {
    deleteThread(id);
    setThreads(prev => prev.filter(t => t.id !== id));
    // Also clear from filter + cards (cards will update on next read)
    setThreadFilter(prev => { const n = new Set(prev); n.delete(id); return n; });
    // Reload cards from store to reflect untagging
    setCards(getCanvasRoom().cards);
  }, []);

  const handleToggleCardThread = useCallback((cardId: string, threadId: string) => {
    const updated = toggleCardThread(cardId, threadId);
    if (updated) setCards(prev => prev.map(c => c.id === cardId ? updated : c));
  }, []);

  const toggleThreadFilter = useCallback((id: string) => {
    setThreadFilter(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  // ── Reader ──

  const handleFocusCard = useCallback((cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    setFocusedCardId(cardId);
    // Pan so the card is centered
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const targetZoom = viewport.zoom;
    const panX = rect.width / 2 - card.position.x * targetZoom - 120 * targetZoom;
    const panY = rect.height / 2 - card.position.y * targetZoom - 70 * targetZoom;
    setViewport(v => ({ ...v, panX, panY }));
  }, [cards, viewport.zoom]);

  const handleNewObservation = useCallback((obs: ReaderObservation) => {
    saveReaderObservation({
      text: obs.text,
      referencedCardIds: obs.referencedCardIds,
    });
    setObservations(prev => [obs, ...prev].slice(0, 20));
  }, []);

  // ── Import ──
  // Detect format, route to structural parser or staging AI pipeline.
  const handleImportFile = useCallback(async (file: File) => {
    const flags = getImportFlags();
    const name = file.name.toLowerCase();
    const isStructural = name.endsWith('.fdx') || name.endsWith('.fountain') || name.endsWith('.ftn');
    const isProse = name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown');

    setImporting(true);
    try {
      if (isStructural && flags.structural) {
        const result = await importStructuralFile(file);
        setCards(getCanvasRoom().cards);
        // 24-hour Reader quiet period post-import
        setReaderSuppressedUntil(Date.now() + 24 * 60 * 60 * 1000);
        setImportBanner(
          result.sceneCount > 0
            ? `Imported ${result.sceneCount} scene${result.sceneCount === 1 ? '' : 's'} from ${file.name}.`
            : `No scenes parsed from ${file.name}. The file may be empty or malformed.`
        );
        return;
      }

      if (isProse && flags.staging) {
        const text = await file.text();
        await startStagingFromText(file.name, text, 'text');
        return;
      }

      // Unsupported format
      setImportBanner(`${file.name} isn't a supported format yet. Try .fdx, .fountain, .txt, or .md.`);
    } catch (err) {
      setImportBanner(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setImporting(false);
    }
  }, []);

  const startStagingFromText = useCallback(async (filename: string, text: string, format: 'text' | 'paste' | 'markdown') => {
    // 1. Create the imported file record (source text preserved)
    const importedFile = createImportedFile({
      originalFilename: filename,
      mimeType: 'text/plain',
      contentBody: text,
      format,
    });

    // 2. Ask the server to propose cards (wording-preservation enforced)
    const res = await fetch('/api/kleo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'import-parse-prose', source: text, parseHint: 'auto' }),
    });
    const data = await res.json() as { proposals: Array<{ text: string; sourceStart: number; sourceEnd: number; sourcePassageRef: string; suggestedType: CardType }>, rejectedCount?: number };
    const rawProposals = Array.isArray(data.proposals) ? data.proposals : [];

    if (rawProposals.length === 0) {
      updateImportedFile(importedFile.id, { parseStatus: 'partial' });
      setImportBanner(`${filename} didn't produce any cards. Try adjusting the text or formatting.`);
      return;
    }

    // 3. Build SourcePassages from returned offsets + update the imported file
    const passages: SourcePassage[] = rawProposals.map(p => ({
      ref: p.sourcePassageRef,
      importedFileId: importedFile.id,
      startOffset: p.sourceStart,
      endOffset: p.sourceEnd,
      pageNumber: null,
      text: text.slice(p.sourceStart, p.sourceEnd),
    }));
    updateImportedFile(importedFile.id, { passages, parseStatus: 'parsed' });

    // 4. Build ProposedCards
    const proposedCards: ProposedCard[] = rawProposals.map((p, i) => ({
      id: `pp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      sourcePassageRef: p.sourcePassageRef,
      text: p.text,
      suggestedType: (['beat', 'moment', 'question', 'fragment'] as CardType[]).includes(p.suggestedType) ? p.suggestedType : 'fragment',
      decision: 'pending',
      acceptedCardId: null,
      editedText: null,
    }));

    // 5. Create the staging session + open the room
    const session = createStagingSession(importedFile.id, proposedCards);
    setReaderSuppressedUntil(Date.now() + 24 * 60 * 60 * 1000);
    setStagingSessionId(session.id);
  }, []);

  const handleFilePickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImportFile(file);
    e.target.value = ''; // reset so picking the same file twice works
  }, [handleImportFile]);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleImportFile(file);
  }, [handleImportFile]);

  const handleCanvasPaste = useCallback(async (e: ClipboardEvent) => {
    // Skip when user is editing a card/input
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
    const flags = getImportFlags();
    if (!flags.staging) return;
    const text = e.clipboardData?.getData('text/plain') || '';
    if (text.length < 200) return; // under threshold — let the browser handle normally
    e.preventDefault();
    await startStagingFromText('Pasted text', text, 'paste');
  }, [startStagingFromText]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('paste', handleCanvasPaste);
    return () => window.removeEventListener('paste', handleCanvasPaste);
  }, [open, handleCanvasPaste]);

  const handleStagingComplete = useCallback(() => {
    setStagingSessionId(null);
    setCards(getCanvasRoom().cards);
  }, []);

  // ── Keyboard shortcuts ──

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
      if (e.key === 'Escape') {
        if (ghostViewing) { setGhostViewing(null); return; }
        if (isEditing) { target.blur(); return; }
        onClose();
        return;
      }
      if (isEditing) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleCreateAtCenter(); }
      if (e.key === '1') setZoomLevel('read');
      if (e.key === '2') setZoomLevel('shape');
      if (e.key === '3') setZoomLevel('waveform');
      if (e.key === '?') setReaderOpen(o => !o);
      if (focusedCardId) {
        if (e.key === 'x' || e.key === 'X') { e.preventDefault(); handleShelveCard(focusedCardId); }
        if (e.key === 'e' || e.key === 'E') {
          // Cycle emotion tag
          const card = cards.find(c => c.id === focusedCardId);
          if (card) {
            const cur = card.emotion ? EMOTIONS.indexOf(card.emotion) : -1;
            const next = EMOTIONS[(cur + 1) % EMOTIONS.length];
            handleUpdateCard(focusedCardId, { emotion: next });
          }
        }
        if (e.key === 'g' || e.key === 'G') {
          const card = cards.find(c => c.id === focusedCardId);
          if (card && card.ghostHistory.length > 0) setGhostViewing({ cardId: focusedCardId, index: 0 });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, handleCreateAtCenter, handleShelveCard, handleUpdateCard, focusedCardId, cards, ghostViewing]);

  // ── Zoom level ──

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('read');
  useEffect(() => {
    // Map semantic zoom to numeric zoom
    const numeric = zoomLevel === 'read' ? 1 : zoomLevel === 'shape' ? 0.55 : 0.25;
    setViewport(v => ({ ...v, zoom: numeric }));
  }, [zoomLevel]);

  // ── Filtering ──

  const visibleCards = useMemo(() => cards.filter(c => !c.shelvedAt), [cards]);
  const shelvedCards = useMemo(
    () => cards.filter(c => c.shelvedAt).sort((a, b) => (b.shelvedAt ?? 0) - (a.shelvedAt ?? 0)),
    [cards],
  );
  const activeFilterIds = threadFilter;

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#13120f',
      display: 'grid',
      gridTemplateColumns: '220px 1fr auto',
      gridTemplateRows: '48px 1fr',
      gridTemplateAreas: '"top top top" "threads canvas right"',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Top bar */}
      <TopBar
        zoomLevel={zoomLevel}
        onZoomLevel={setZoomLevel}
        onClose={onClose}
        onOpenReader={() => setReaderOpen(true)}
        onImportClick={() => fileInputRef.current?.click()}
        importing={importing}
        cardCount={visibleCards.length}
        shelfCount={shelvedCards.length}
      />

      {/* Hidden file input for Import button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".fdx,.fountain,.ftn,.txt,.md,.markdown"
        onChange={handleFilePickerChange}
        style={{ display: 'none' }}
      />

      {/* Import banner — non-modal, dismissable */}
      {importBanner && (
        <div style={{
          position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
          zIndex: 90, padding: '8px 16px', borderRadius: 4,
          background: 'rgba(196,92,74,0.12)', border: '1px solid rgba(196,92,74,0.25)',
          color: '#e5dcc0', fontSize: 12, fontFamily: 'Georgia, serif',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <span>{importBanner}</span>
          <button
            onClick={() => setImportBanner(null)}
            style={{
              background: 'none', border: 'none', color: '#7a7060',
              cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1,
            }}
          >×</button>
        </div>
      )}

      {/* Staging Room overlay — launches from prose import / paste */}
      {stagingSessionId && (
        <StagingRoom
          open={true}
          sessionId={stagingSessionId}
          onClose={() => setStagingSessionId(null)}
          onComplete={handleStagingComplete}
        />
      )}

      {/* Threads panel (left) */}
      <ThreadsPanel
        threads={threads}
        cards={visibleCards}
        activeFilterIds={activeFilterIds}
        onToggleFilter={toggleThreadFilter}
        onCreateThread={handleCreateThread}
        onDeleteThread={handleDeleteThread}
      />

      {/* Canvas (center) */}
      <Canvas
        ref={canvasRef}
        cards={visibleCards}
        threads={threads}
        viewport={viewport}
        zoomLevel={zoomLevel}
        focusedCardId={focusedCardId}
        hoveredCardId={hoveredCardId}
        activeFilterIds={activeFilterIds}
        ghostViewing={ghostViewing}
        onViewportChange={setViewport}
        onFocusCard={setFocusedCardId}
        onHoverCard={setHoveredCardId}
        onClickEmpty={handleCreateCardAt}
        onUpdateCard={handleUpdateCard}
        onShelveCard={handleShelveCard}
        onToggleCardThread={handleToggleCardThread}
        onRestoreGhost={handleRestoreGhost}
        onCloseGhosts={() => setGhostViewing(null)}
        onStepGhost={(delta) => setGhostViewing(prev => {
          if (!prev) return prev;
          const card = cards.find(c => c.id === prev.cardId);
          if (!card) return null;
          const next = Math.max(0, Math.min(card.ghostHistory.length - 1, prev.index + delta));
          return { ...prev, index: next };
        })}
        onFileDrop={handleCanvasDrop}
      />

      {/* Right side: Shelf + Reader */}
      <div style={{ gridArea: 'right', display: 'flex', position: 'relative', height: '100%' }}>
        <Shelf
          cards={shelvedCards}
          onRestore={handleRestoreCard}
          onHardDelete={handleHardDelete}
        />
        <ReaderPanel
          open={readerOpen}
          onClose={() => setReaderOpen(false)}
          cards={visibleCards}
          threads={threads}
          observations={observations}
          onNewObservation={handleNewObservation}
          onFocusCard={handleFocusCard}
        />
      </div>
    </div>
  );
}

// ── Top bar ──

function TopBar({ zoomLevel, onZoomLevel, onClose, onOpenReader, onImportClick, importing, cardCount, shelfCount }: {
  zoomLevel: ZoomLevel;
  onZoomLevel: (z: ZoomLevel) => void;
  onClose: () => void;
  onOpenReader: () => void;
  onImportClick: () => void;
  importing: boolean;
  cardCount: number; shelfCount: number;
}) {
  return (
    <div style={{
      gridArea: 'top', display: 'flex', alignItems: 'center',
      padding: '0 20px', borderBottom: '1px solid rgba(200,189,160,0.08)',
      background: '#17160f',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 500,
          color: '#e5dcc0', margin: 0, letterSpacing: '0.01em',
        }}>
          The Canvas
        </h1>
        <span style={{
          fontSize: 11, color: '#7a7060', fontStyle: 'italic', fontFamily: 'Georgia, serif',
        }}>
          V2 — spatial pre-writing
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Zoom segmented control */}
        <div style={{
          display: 'flex', background: '#1e1c17', borderRadius: 4, padding: 2,
          border: '1px solid rgba(200,189,160,0.08)',
        }}>
          {(['read', 'shape', 'waveform'] as ZoomLevel[]).map(z => (
            <button
              key={z}
              onClick={() => onZoomLevel(z)}
              style={{
                padding: '4px 12px', fontSize: 10, fontWeight: 500,
                background: zoomLevel === z ? '#2a2720' : 'transparent',
                color: zoomLevel === z ? '#e5dcc0' : '#7a7060',
                border: 'none', cursor: 'pointer', borderRadius: 3,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {z}
            </button>
          ))}
        </div>

        <span style={{
          fontSize: 10, color: '#7a7060',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginLeft: 10,
        }}>
          <b style={{ color: '#c8bda0', fontWeight: 500 }}>{cardCount}</b> cards
          {shelfCount > 0 && <> · <b style={{ color: '#7a7060', fontWeight: 500 }}>{shelfCount}</b> shelved</>}
        </span>

        <button
          onClick={onImportClick}
          disabled={importing}
          title="Import FDX, Fountain, or prose (paste also works)"
          style={{
            marginLeft: 10,
            padding: '5px 12px', fontSize: 10, fontWeight: 600,
            background: 'transparent', color: importing ? '#4a4535' : '#c8bda0',
            border: '1px solid rgba(200,189,160,0.16)', borderRadius: 4,
            cursor: importing ? 'wait' : 'pointer',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {importing ? 'Importing…' : 'Import'}
        </button>

        <button
          onClick={onOpenReader}
          title="Open the Reader (?)"
          style={{
            marginLeft: 6,
            padding: '5px 12px', fontSize: 10, fontWeight: 600,
            background: 'rgba(196,92,74,0.12)', color: '#c45c4a',
            border: '1px solid rgba(196,92,74,0.25)', borderRadius: 4,
            cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
          }}
        >
          The Reader
        </button>

        <button
          onClick={onClose}
          style={{
            marginLeft: 6,
            background: 'none', border: 'none', color: '#7a7060',
            cursor: 'pointer', fontSize: 20, padding: '4px 8px', lineHeight: 1,
          }}
          title="Close (Esc)"
        >×</button>
      </div>
    </div>
  );
}

// ── Threads panel ──

function ThreadsPanel({ threads, cards, activeFilterIds, onToggleFilter, onCreateThread, onDeleteThread }: {
  threads: CanvasThread[];
  cards: CanvasCard[];
  activeFilterIds: Set<string>;
  onToggleFilter: (id: string) => void;
  onCreateThread: (name: string) => void;
  onDeleteThread: (id: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const cardCountByThread = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) for (const t of c.threadIds) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [cards]);

  const commit = () => {
    if (newName.trim()) { onCreateThread(newName.trim()); setNewName(''); }
  };

  return (
    <aside style={{
      gridArea: 'threads', borderRight: '1px solid rgba(200,189,160,0.08)',
      padding: '16px 14px', overflowY: 'auto', background: '#17160f',
    }}>
      <div style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', color: '#c45c4a',
        letterSpacing: '0.2em', fontWeight: 600, marginBottom: 12,
        textTransform: 'uppercase',
      }}>
        Threads
      </div>

      {threads.length === 0 && (
        <div style={{
          fontSize: 11, color: '#4a4535', fontStyle: 'italic',
          fontFamily: 'Georgia, serif', marginBottom: 12, lineHeight: 1.5,
        }}>
          No threads yet. Create one to tag cards across the story.
        </div>
      )}

      {threads.map(t => {
        const active = activeFilterIds.has(t.id);
        const count = cardCountByThread.get(t.id) ?? 0;
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 6px', borderRadius: 4,
            background: active ? 'rgba(196,92,74,0.06)' : 'transparent',
            cursor: 'pointer', marginBottom: 2,
          }}
            onClick={() => onToggleFilter(t.id)}
          >
            <span style={{
              width: 10, height: 10, borderRadius: 2, background: t.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: active ? '#e5dcc0' : '#c8bda0', flex: 1, minWidth: 0 }}>
              {t.name}
            </span>
            <span style={{ fontSize: 9, color: '#4a4535', fontFamily: 'var(--font-mono)' }}>{count}</span>
            <button
              onClick={e => { e.stopPropagation(); if (confirm(`Delete thread "${t.name}"?`)) onDeleteThread(t.id); }}
              style={{
                background: 'none', border: 'none', color: '#4a4535',
                cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1,
              }}
              title="Delete thread"
            >×</button>
          </div>
        );
      })}

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(200,189,160,0.06)' }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          placeholder="+ new thread"
          style={{
            width: '100%', background: '#1e1c17',
            border: '1px solid rgba(200,189,160,0.08)', borderRadius: 4,
            padding: '6px 10px', fontSize: 11, color: '#c8bda0',
            outline: 'none', fontFamily: 'var(--font-sans)',
          }}
        />
      </div>
    </aside>
  );
}

// ── Canvas (pan/zoom + cards) ──

interface CanvasProps {
  cards: CanvasCard[];
  threads: CanvasThread[];
  viewport: { panX: number; panY: number; zoom: number };
  zoomLevel: ZoomLevel;
  focusedCardId: string | null;
  hoveredCardId: string | null;
  activeFilterIds: Set<string>;
  ghostViewing: { cardId: string; index: number } | null;
  onViewportChange: (v: { panX: number; panY: number; zoom: number }) => void;
  onFocusCard: (id: string | null) => void;
  onHoverCard: (id: string | null) => void;
  onClickEmpty: (screenX: number, screenY: number) => void;
  onUpdateCard: (id: string, patch: Parameters<typeof updateCard>[1]) => void;
  onShelveCard: (id: string) => void;
  onToggleCardThread: (cardId: string, threadId: string) => void;
  onRestoreGhost: (cardId: string, index: number) => void;
  onCloseGhosts: () => void;
  onStepGhost: (delta: number) => void;
  onFileDrop: (e: React.DragEvent) => void;
}

const Canvas = ({ cards, threads, viewport, zoomLevel, focusedCardId, activeFilterIds,
  ghostViewing,
  onViewportChange, onFocusCard, onClickEmpty, onUpdateCard, onShelveCard,
  onToggleCardThread, onRestoreGhost, onCloseGhosts, onStepGhost,
  onFileDrop,
  ref,
}: CanvasProps & { ref: React.RefObject<HTMLDivElement | null> }) => {
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Space+drag or middle-click to pan. Regular drag on empty = also pan.
    if (e.button === 1 || e.target === e.currentTarget) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    onViewportChange({
      ...viewport,
      panX: panStart.current.panX + (e.clientX - panStart.current.x),
      panY: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = Math.abs(e.clientX - panStart.current.x);
      const dy = Math.abs(e.clientY - panStart.current.y);
      setIsPanning(false);
      // Click (no drag) on empty → create card
      if (dx < 4 && dy < 4 && e.target === e.currentTarget) {
        onClickEmpty(e.clientX, e.clientY);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Wheel zoom (disabled for zoomLevel switching via keys 1/2/3)
    // But allow trackpad pan (shift+wheel or two-finger)
    if (e.ctrlKey || e.metaKey) {
      // pinch-zoom — not handled for MVP to keep zoom semantic
      return;
    }
    onViewportChange({
      ...viewport,
      panX: viewport.panX - e.deltaX,
      panY: viewport.panY - e.deltaY,
    });
  };

  const ghostCard = ghostViewing ? cards.find(c => c.id === ghostViewing.cardId) : null;
  const ghostText = ghostCard && ghostCard.ghostHistory[ghostViewing!.index]?.text;

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsPanning(false)}
      onWheel={handleWheel}
      onDragOver={e => e.preventDefault()}
      onDrop={onFileDrop}
      style={{
        gridArea: 'canvas', overflow: 'hidden', position: 'relative',
        background: '#13120f',
        cursor: isPanning ? 'grabbing' : 'default',
      }}
    >
      {/* Canvas content — transformed */}
      <div style={{
        position: 'absolute', left: 0, top: 0,
        transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        transformOrigin: '0 0',
        transition: 'transform 220ms ease-out',
      }}>
        {cards.map(card => {
          const dimmed = activeFilterIds.size > 0 &&
            !card.threadIds.some(tid => activeFilterIds.has(tid));
          const cardThreads = threads.filter(t => card.threadIds.includes(t.id));
          return (
            <Card
              key={card.id}
              card={card}
              cardThreads={cardThreads}
              allThreads={threads}
              focused={focusedCardId === card.id}
              dimmed={dimmed}
              zoomLevel={zoomLevel}
              onFocus={() => onFocusCard(card.id)}
              onBlur={() => onFocusCard(null)}
              onUpdate={(patch) => onUpdateCard(card.id, patch)}
              onShelve={() => onShelveCard(card.id)}
              onToggleThread={(tid) => onToggleCardThread(card.id, tid)}
              onDrag={(dx, dy) => onUpdateCard(card.id, {
                position: { x: card.position.x + dx / viewport.zoom, y: card.position.y + dy / viewport.zoom },
              })}
            />
          );
        })}
      </div>

      {/* Empty state hint */}
      {cards.length === 0 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
            fontSize: 16, color: '#4a4535', marginBottom: 6,
          }}>
            Click anywhere. Or press N.
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: '#3a3528', letterSpacing: '0.1em',
          }}>
            N NEW · TAB TYPE · X SHELVE · E EMOTION · G GHOSTS · ? READER
          </div>
        </div>
      )}

      {/* Ghost viewer overlay */}
      {ghostViewing && ghostCard && ghostText !== undefined && (
        <div
          onClick={onCloseGhosts}
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a1812', border: '1px solid rgba(200,189,160,0.2)',
              borderRadius: 6, padding: '22px 26px', maxWidth: 420,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', color: '#c45c4a',
              letterSpacing: '0.2em', fontWeight: 600, marginBottom: 12,
              textTransform: 'uppercase',
            }}>
              Ghost {ghostViewing.index + 1} of {ghostCard.ghostHistory.length}
            </div>
            <div style={{
              fontFamily: 'Georgia, serif', fontSize: 14, color: '#c8bda0',
              lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-wrap',
            }}>
              {ghostText || <em style={{ color: '#4a4535' }}>(empty)</em>}
            </div>
            <div style={{
              display: 'flex', gap: 8, justifyContent: 'flex-end',
              paddingTop: 12, borderTop: '1px solid rgba(200,189,160,0.08)',
            }}>
              <button
                onClick={() => onStepGhost(-1)}
                disabled={ghostViewing.index === 0}
                style={ghostBtnStyle(ghostViewing.index === 0)}
              >← Newer</button>
              <button
                onClick={() => onStepGhost(1)}
                disabled={ghostViewing.index === ghostCard.ghostHistory.length - 1}
                style={ghostBtnStyle(ghostViewing.index === ghostCard.ghostHistory.length - 1)}
              >Older →</button>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => onRestoreGhost(ghostViewing.cardId, ghostViewing.index)}
                style={{ ...ghostBtnStyle(false), color: '#c45c4a' }}
              >Restore</button>
              <button onClick={onCloseGhosts} style={ghostBtnStyle(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ghostBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
    color: disabled ? '#3a3528' : '#7a7060',
    fontSize: 10, fontFamily: 'var(--font-mono)',
    letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 8px',
    fontWeight: 600,
  };
}

// ── Individual card ──

interface CardProps {
  card: CanvasCard;
  cardThreads: CanvasThread[];
  allThreads: CanvasThread[];
  focused: boolean;
  dimmed: boolean;
  zoomLevel: ZoomLevel;
  onFocus: () => void;
  onBlur: () => void;
  onUpdate: (patch: Parameters<typeof updateCard>[1]) => void;
  onShelve: () => void;
  onToggleThread: (threadId: string) => void;
  onDrag: (dx: number, dy: number) => void;
}

function Card({ card, cardThreads, allThreads, focused, dimmed, zoomLevel,
  onFocus, onBlur, onUpdate, onShelve, onToggleThread, onDrag }: CardProps) {
  const [editing, setEditing] = useState(!card.text);
  const [draft, setDraft] = useState(card.text);
  const [showThreadPicker, setShowThreadPicker] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => { setDraft(card.text); }, [card.text]);

  const commit = () => {
    const t = draft.trim();
    if (t !== card.text) onUpdate({ text: t });
    setEditing(false);
  };

  const startDrag = (e: React.MouseEvent) => {
    if (editing) return;
    e.stopPropagation();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      onDrag(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
      dragStart.current = { x: e.clientX, y: e.clientY };
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragging, onDrag]);

  const cycleType = () => {
    const cur = CARD_TYPES.indexOf(card.type);
    onUpdate({ type: CARD_TYPES[(cur + 1) % CARD_TYPES.length] });
  };

  const cycleStatus = () => {
    const cur = CARD_STATUSES.indexOf(card.status);
    onUpdate({ status: CARD_STATUSES[(cur + 1) % CARD_STATUSES.length] });
  };

  // Semantic zoom view
  const isShapeZoom = zoomLevel === 'shape';
  const isWaveform = zoomLevel === 'waveform';
  const width = isWaveform ? 18 : 240;
  const height = isWaveform ? 18 : 140;
  const radius = isWaveform ? '50%' : '6px';

  return (
    <div
      style={{
        position: 'absolute', left: card.position.x, top: card.position.y,
        width, height, borderRadius: radius,
        background: isWaveform
          ? (card.emotion ? EMOTION_COLORS[card.emotion] : '#3a3528')
          : '#1e1c17',
        border: `1px solid ${focused ? '#c45c4a' : 'rgba(200,189,160,0.1)'}`,
        boxShadow: focused ? '0 4px 24px rgba(196,92,74,0.2)' : dragging ? '0 8px 20px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.3)',
        opacity: dimmed ? 0.3 : 1,
        transition: 'opacity 150ms, box-shadow 150ms',
        cursor: dragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseDown={startDrag}
      onClick={e => { e.stopPropagation(); onFocus(); }}
    >
      {!isWaveform && (
        <>
          {/* Top bar: type icon, status dot */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 10px 4px', fontSize: 11, color: '#7a7060',
            flexShrink: 0,
          }}>
            <button
              onClick={e => { e.stopPropagation(); cycleType(); }}
              title={`Type: ${card.type} — click to cycle`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#c45c4a', fontSize: 13, fontWeight: 700, padding: 0,
                fontFamily: 'Georgia, serif',
              }}
            >{TYPE_ICONS[card.type]}</button>
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
              color: '#4a4535', textTransform: 'uppercase',
            }}>
              {card.type}
            </span>
            <button
              onClick={e => { e.stopPropagation(); cycleStatus(); }}
              title={`Status: ${card.status} — click to cycle`}
              style={{
                width: 9, height: 9, borderRadius: '50%',
                background: STATUS_COLORS[card.status],
                border: 'none', padding: 0, cursor: 'pointer',
              }}
            />
          </div>

          {/* Body (text) */}
          <div style={{ flex: 1, padding: '2px 12px 6px', overflow: 'hidden' }}>
            {editing ? (
              <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
                  if (e.key === 'Escape') { setDraft(card.text); setEditing(false); (e.target as HTMLTextAreaElement).blur(); }
                  if (e.key === 'Tab') { e.preventDefault(); cycleType(); }
                }}
                placeholder="Type an idea…"
                style={{
                  width: '100%', height: '100%', background: 'transparent',
                  border: 'none', color: '#e5dcc0',
                  fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.45,
                  resize: 'none', outline: 'none', padding: 0,
                }}
              />
            ) : (
              <div
                onDoubleClick={e => { e.stopPropagation(); setEditing(true); }}
                style={{
                  fontFamily: 'Georgia, serif', fontSize: isShapeZoom ? 11 : 13, lineHeight: 1.45,
                  color: '#c8bda0', whiteSpace: 'pre-wrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: isShapeZoom ? 1 : 5,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {card.text || <span style={{ color: '#4a4535', fontStyle: 'italic' }}>empty</span>}
              </div>
            )}
          </div>

          {/* Bottom bar: thread bars + emotion dot + actions */}
          <div style={{
            padding: '4px 10px', display: 'flex', alignItems: 'center',
            gap: 4, flexShrink: 0, minHeight: 20,
            borderTop: '1px solid rgba(200,189,160,0.05)',
          }}>
            {/* Thread color bars */}
            {cardThreads.slice(0, 4).map(t => (
              <span key={t.id} title={t.name} style={{
                width: 10, height: 3, borderRadius: 1, background: t.color,
              }} />
            ))}
            {cardThreads.length > 4 && (
              <span style={{ fontSize: 8, color: '#7a7060', fontFamily: 'var(--font-mono)' }}>
                +{cardThreads.length - 4}
              </span>
            )}
            <button
              onClick={e => { e.stopPropagation(); setShowThreadPicker(s => !s); }}
              title="Tag threads (T)"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#4a4535', fontSize: 11, padding: '0 2px', lineHeight: 1,
              }}
            >＋</button>

            <div style={{ flex: 1 }} />

            {/* Emotion dot */}
            <button
              onClick={e => { e.stopPropagation(); }}
              title={card.emotion ? `Emotion: ${card.emotion} (E to cycle)` : 'No emotion (E to tag)'}
              style={{
                width: 9, height: 9, borderRadius: '50%',
                background: card.emotion ? EMOTION_COLORS[card.emotion] : 'rgba(200,189,160,0.15)',
                border: 'none', padding: 0, cursor: 'pointer',
              }}
            />

            {focused && (
              <button
                onClick={e => { e.stopPropagation(); onShelve(); }}
                title="Cut to shelf (X)"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#4a4535', fontSize: 10, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em', padding: '0 4px', textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >Cut</button>
            )}
          </div>

          {/* Thread picker popover */}
          {showThreadPicker && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4,
                background: '#23201a', border: '1px solid rgba(200,189,160,0.16)',
                borderRadius: 4, padding: 6, zIndex: 10, minWidth: 160,
                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              }}
            >
              {allThreads.length === 0 ? (
                <div style={{ fontSize: 10, color: '#7a7060', padding: 4, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
                  No threads yet. Create one in the left panel.
                </div>
              ) : allThreads.map(t => {
                const on = card.threadIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => onToggleThread(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      width: '100%', padding: '4px 6px', borderRadius: 3,
                      background: on ? 'rgba(196,92,74,0.08)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 11, color: '#c8bda0',
                    }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: t.color }} />
                    <span style={{ flex: 1 }}>{t.name}</span>
                    {on && <span style={{ color: '#c45c4a', fontSize: 10 }}>✓</span>}
                  </button>
                );
              })}
              <button
                onClick={() => setShowThreadPicker(false)}
                style={{
                  display: 'block', width: '100%', marginTop: 4, padding: '3px 6px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#4a4535', fontSize: 9, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}
              >Close</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── The Shelf ──

function Shelf({ cards, onRestore, onHardDelete }: {
  cards: CanvasCard[];
  onRestore: (id: string) => void;
  onHardDelete: (id: string) => void;
}) {
  if (cards.length === 0) return null;

  const opacityForAge = (shelvedAt: number) => {
    const days = (Date.now() - shelvedAt) / (1000 * 60 * 60 * 24);
    if (days > 60) return 0.25;
    if (days > 14) return 0.4;
    return 0.6;
  };

  return (
    <aside style={{
      width: 140, borderLeft: '1px solid rgba(200,189,160,0.08)',
      padding: '14px 10px', overflowY: 'auto', background: '#17160f',
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', color: '#7a7060',
        letterSpacing: '0.2em', fontWeight: 600, marginBottom: 12,
        textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Shelf</span>
        <span style={{ color: '#4a4535' }}>{cards.length}</span>
      </div>

      {cards.map(c => (
        <div
          key={c.id}
          style={{
            background: '#1e1c17', border: '1px solid rgba(200,189,160,0.06)',
            borderRadius: 4, padding: '6px 8px', marginBottom: 6,
            opacity: opacityForAge(c.shelvedAt ?? Date.now()),
            cursor: 'pointer', transition: 'opacity 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = String(opacityForAge(c.shelvedAt ?? Date.now())); }}
          title={c.text}
        >
          <div style={{
            fontSize: 10, color: '#c8bda0',
            fontFamily: 'Georgia, serif', lineHeight: 1.35,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            marginBottom: 4,
          }}>
            {c.text || <em style={{ color: '#4a4535' }}>empty</em>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
            <button
              onClick={() => onRestore(c.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#7a9a6a', fontSize: 8, fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em', padding: 0, fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >Restore</button>
            <button
              onClick={() => { if (confirm('Delete permanently?')) onHardDelete(c.id); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#4a4535', fontSize: 10, padding: 0, lineHeight: 1,
              }}
              title="Delete permanently"
            >×</button>
          </div>
        </div>
      ))}
    </aside>
  );
}
