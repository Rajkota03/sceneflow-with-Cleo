'use client';
// The Staging Room — review AI-proposed cards before they land on the Canvas.
//
// Left: the source prose, immutable, with the passage for the hovered proposal
// lit up in terracotta. Right: the proposed cards, each with type + text + a
// decision. Bottom: counts + Accept all + Done.
//
// Every mutation goes through the store; after each one we re-fetch the
// session so the UI reflects exactly what's persisted. Muji discipline:
// no popups, no animation longer than 200ms, whitespace does the work.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getStagingSession, getImportedFile, acceptProposal, dismissProposal,
  updateStagingSession, setProposalType, setProposalEditedText, acceptAllPending,
  CARD_TYPES, TYPE_ICONS,
  type StagingSession, type ImportedFile, type ProposedCard, type CardType,
} from '@/lib/canvas-room-store';

interface StagingRoomProps {
  open: boolean;
  sessionId: string;
  onClose: () => void;
  onComplete: () => void;
}

// Palette — match the Canvas/Reader sibling components.
const C = {
  bg:       '#13120f',
  topBar:   '#17160f',
  surface:  '#1a1812',
  cardBg:   '#1e1c17',
  border:   'rgba(200,189,160,0.08)',
  borderStrong: 'rgba(200,189,160,0.16)',
  accent:   '#c45c4a',
  accentSoft: 'rgba(196,92,74,0.15)',
  ink:      '#e5dcc0',
  inkSoft:  '#c8bda0',
  muted:    '#7a7060',
  faint:    '#4a4535',
  green:    '#7a9a6a',
};

type DecisionFilter = 'all' | 'pending' | 'accepted' | 'dismissed';

export function StagingRoom({ open, sessionId, onClose, onComplete }: StagingRoomProps) {
  const [session, setSession] = useState<StagingSession | null>(null);
  const [file, setFile] = useState<ImportedFile | null>(null);
  const [hoveredProposalId, setHoveredProposalId] = useState<string | null>(null);
  const [focusedProposalId, setFocusedProposalId] = useState<string | null>(null);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DecisionFilter>('all');

  // ── Load ──
  useEffect(() => {
    if (!open) return;
    const s = getStagingSession(sessionId);
    if (!s) { setSession(null); setFile(null); return; }
    setSession(s);
    setFile(getImportedFile(s.importedFileId));
  }, [open, sessionId]);

  const refetch = useCallback(() => {
    const s = getStagingSession(sessionId);
    if (s) setSession(s);
  }, [sessionId]);

  // ── Derived counts ──
  const counts = useMemo(() => {
    if (!session) return { accepted: 0, dismissed: 0, pending: 0, total: 0 };
    let accepted = 0, dismissed = 0, pending = 0;
    for (const p of session.proposedCards) {
      if (p.decision === 'accepted' || p.decision === 'edited') accepted++;
      else if (p.decision === 'dismissed') dismissed++;
      else pending++;
    }
    return { accepted, dismissed, pending, total: session.proposedCards.length };
  }, [session]);

  const visibleProposals = useMemo(() => {
    if (!session) return [];
    return session.proposedCards.filter(p => {
      if (filter === 'all') return true;
      if (filter === 'pending') return p.decision === 'pending';
      if (filter === 'accepted') return p.decision === 'accepted' || p.decision === 'edited';
      if (filter === 'dismissed') return p.decision === 'dismissed';
      return true;
    });
  }, [session, filter]);

  // ── Mutations ──
  const handleAccept = useCallback((proposalId: string) => {
    if (!session) return;
    const prop = session.proposedCards.find(p => p.id === proposalId);
    if (!prop || prop.decision === 'accepted' || prop.decision === 'edited') return;
    const position = {
      x: 300 + (counts.accepted % 4) * 270,
      y: 100 + Math.floor(counts.accepted / 4) * 160,
    };
    acceptProposal(sessionId, proposalId, position);
    refetch();
  }, [session, sessionId, counts.accepted, refetch]);

  const handleDismiss = useCallback((proposalId: string) => {
    dismissProposal(sessionId, proposalId);
    refetch();
  }, [sessionId, refetch]);

  const handleSetType = useCallback((proposalId: string, type: CardType) => {
    setProposalType(sessionId, proposalId, type);
    refetch();
  }, [sessionId, refetch]);

  const handleCommitEdit = useCallback((proposalId: string, text: string) => {
    setProposalEditedText(sessionId, proposalId, text);
    refetch();
    setEditingProposalId(null);
  }, [sessionId, refetch]);

  const handleAcceptAll = useCallback(() => {
    if (!session) return;
    acceptAllPending(sessionId, counts.accepted);
    refetch();
  }, [session, sessionId, counts.accepted, refetch]);

  const handleDone = useCallback(() => {
    updateStagingSession(sessionId, { status: 'completed' });
    onComplete();
  }, [sessionId, onComplete]);

  // ── Keyboard ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT';

      if (e.key === 'Escape') {
        if (editingProposalId) { setEditingProposalId(null); return; }
        if (isEditing) { target.blur(); return; }
        onClose();
        return;
      }

      if (isEditing) return;
      if (!focusedProposalId) return;

      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); handleAccept(focusedProposalId); }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); handleDismiss(focusedProposalId); }
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); setEditingProposalId(focusedProposalId); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, focusedProposalId, editingProposalId, handleAccept, handleDismiss]);

  if (!open) return null;

  // Session missing — show a sober empty frame rather than a blank screen.
  if (!session || !file) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200, background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 14,
          color: C.muted,
        }}>
          Staging session not found.
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: 'none', color: C.muted,
            cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '4px 8px',
          }}
          aria-label="Close"
        >×</button>
      </div>
    );
  }

  const hoveredPassageRef = hoveredProposalId
    ? session.proposedCards.find(p => p.id === hoveredProposalId)?.sourcePassageRef ?? null
    : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: C.bg,
      display: 'grid',
      gridTemplateRows: '48px 1fr 44px',
      gridTemplateColumns: '1fr 1fr',
      fontFamily: 'var(--font-sans)',
      color: C.ink,
    }}>
      {/* Top bar */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: `1px solid ${C.border}`,
        background: C.topBar,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', color: C.accent,
            letterSpacing: '0.25em', fontWeight: 600, textTransform: 'uppercase',
          }}>
            Staging
          </span>
          <span style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 15,
            color: C.ink,
          }}>
            {file.originalFilename}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close staging (Esc)"
          title="Close (Esc) — accepted cards kept, session not marked done"
          style={{
            background: 'none', border: 'none', color: C.muted,
            cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '4px 8px',
          }}
        >×</button>
      </div>

      {/* Source column */}
      <SourceColumn
        file={file}
        hoveredPassageRef={hoveredPassageRef}
      />

      {/* Proposals column */}
      <ProposalsColumn
        proposals={visibleProposals}
        totalCount={session.proposedCards.length}
        pendingCount={counts.pending}
        filter={filter}
        onFilterChange={setFilter}
        hoveredProposalId={hoveredProposalId}
        focusedProposalId={focusedProposalId}
        editingProposalId={editingProposalId}
        onHover={setHoveredProposalId}
        onFocus={setFocusedProposalId}
        onBeginEdit={setEditingProposalId}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
        onSetType={handleSetType}
        onCommitEdit={handleCommitEdit}
        onAcceptAll={handleAcceptAll}
      />

      {/* Bottom bar */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderTop: `1px solid ${C.border}`,
        background: C.topBar,
      }}>
        <span style={{
          fontSize: 10, color: C.muted, fontFamily: 'var(--font-mono)',
          letterSpacing: '0.08em',
        }}>
          <b style={{ color: C.green, fontWeight: 500 }}>{counts.accepted}</b> accepted
          {' · '}
          <b style={{ color: C.muted, fontWeight: 500 }}>{counts.dismissed}</b> dismissed
          {' · '}
          <b style={{ color: counts.pending > 0 ? C.accent : C.muted, fontWeight: 500 }}>
            {counts.pending}
          </b> pending
        </span>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {counts.pending > 0 && (
            <button
              onClick={handleAcceptAll}
              style={{
                padding: '6px 14px', fontSize: 10, fontWeight: 600,
                background: 'transparent', color: C.muted,
                border: `1px solid ${C.border}`, borderRadius: 4,
                cursor: 'pointer', letterSpacing: '0.12em',
                textTransform: 'uppercase', fontFamily: 'var(--font-mono)',
                transition: 'color 150ms, border-color 150ms',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = C.ink;
                e.currentTarget.style.borderColor = C.borderStrong;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = C.muted;
                e.currentTarget.style.borderColor = C.border;
              }}
              title={`Accept all ${counts.pending} pending proposals`}
            >
              Accept all
            </button>
          )}

          <button
            onClick={handleDone}
            style={{
              padding: '6px 16px', fontSize: 10, fontWeight: 600,
              background: C.accentSoft, color: C.accent,
              border: '1px solid rgba(196,92,74,0.35)', borderRadius: 4,
              cursor: 'pointer', letterSpacing: '0.12em',
              textTransform: 'uppercase', fontFamily: 'var(--font-mono)',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,92,74,0.24)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.accentSoft; }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Source column ──

function SourceColumn({ file, hoveredPassageRef }: {
  file: ImportedFile;
  hoveredPassageRef: string | null;
}) {
  // Build a flat list of render segments: each chunk is either a passage span
  // (with a ref we can match) or an unassigned gap. Passages are assumed
  // non-overlapping and sorted by startOffset — but we sort defensively.
  const segments = useMemo(() => {
    const body = file.contentBody;
    const passages = [...file.passages].sort((a, b) => a.startOffset - b.startOffset);
    const out: Array<{ ref: string | null; text: string }> = [];
    let cursor = 0;
    for (const p of passages) {
      const start = Math.max(p.startOffset, cursor);
      const end = Math.min(p.endOffset, body.length);
      if (end <= start) continue;
      if (start > cursor) {
        out.push({ ref: null, text: body.slice(cursor, start) });
      }
      out.push({ ref: p.ref, text: body.slice(start, end) });
      cursor = end;
    }
    if (cursor < body.length) {
      out.push({ ref: null, text: body.slice(cursor) });
    }
    // If there are no passages at all, fall back to the whole body as one gap.
    if (out.length === 0) out.push({ ref: null, text: body });
    return out;
  }, [file]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLSpanElement>(null);

  // When a passage is highlighted, scroll it into view (centered-ish).
  useEffect(() => {
    if (!hoveredPassageRef) return;
    const el = highlightedRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hoveredPassageRef]);

  return (
    <div style={{
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: C.bg,
    }}>
      <div style={{
        padding: '10px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', color: C.accent,
          letterSpacing: '0.25em', fontWeight: 600, textTransform: 'uppercase',
        }}>
          Source
        </span>
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '24px 28px',
          fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.65,
          color: C.inkSoft, userSelect: 'none',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
      >
        {segments.map((seg, i) => {
          if (seg.ref === null) {
            return <span key={`gap-${i}`}>{seg.text}</span>;
          }
          const isHot = seg.ref === hoveredPassageRef;
          return (
            <span
              key={`${seg.ref}-${i}`}
              ref={isHot ? highlightedRef : undefined}
              style={{
                background: isHot ? C.accentSoft : 'transparent',
                borderRadius: 2,
                transition: 'background 150ms ease-out',
                padding: isHot ? '0 2px' : 0,
                margin: isHot ? '0 -2px' : 0,
              }}
            >
              {seg.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Proposals column ──

interface ProposalsColumnProps {
  proposals: ProposedCard[];
  totalCount: number;
  pendingCount: number;
  filter: DecisionFilter;
  onFilterChange: (f: DecisionFilter) => void;
  hoveredProposalId: string | null;
  focusedProposalId: string | null;
  editingProposalId: string | null;
  onHover: (id: string | null) => void;
  onFocus: (id: string | null) => void;
  onBeginEdit: (id: string | null) => void;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onSetType: (id: string, type: CardType) => void;
  onCommitEdit: (id: string, text: string) => void;
  onAcceptAll: () => void;
}

function ProposalsColumn({
  proposals, totalCount, pendingCount, filter, onFilterChange,
  hoveredProposalId, focusedProposalId, editingProposalId,
  onHover, onFocus, onBeginEdit,
  onAccept, onDismiss, onSetType, onCommitEdit, onAcceptAll,
}: ProposalsColumnProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: C.bg,
    }}>
      {/* Header with count + filter + bulk accept */}
      <div style={{
        padding: '10px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', color: C.accent,
          letterSpacing: '0.25em', fontWeight: 600, textTransform: 'uppercase',
        }}>
          Proposed Cards
        </span>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', color: C.muted,
          letterSpacing: '0.08em',
        }}>
          {totalCount}
        </span>

        <div style={{ flex: 1 }} />

        {/* Filter chips */}
        <div style={{
          display: 'flex', gap: 2, background: C.cardBg, borderRadius: 4, padding: 2,
          border: `1px solid ${C.border}`,
        }}>
          {(['all', 'pending', 'accepted', 'dismissed'] as DecisionFilter[]).map(f => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              style={{
                padding: '3px 10px', fontSize: 9, fontWeight: 500,
                background: filter === f ? '#2a2720' : 'transparent',
                color: filter === f ? C.ink : C.muted,
                border: 'none', cursor: 'pointer', borderRadius: 3,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {pendingCount > 0 && (
          <button
            onClick={onAcceptAll}
            style={{
              padding: '4px 10px', fontSize: 9, fontWeight: 600,
              background: 'rgba(196,92,74,0.08)', color: C.accent,
              border: '1px solid rgba(196,92,74,0.25)', borderRadius: 999,
              cursor: 'pointer', letterSpacing: '0.1em',
              textTransform: 'uppercase', fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}
            title={`Accept all ${pendingCount} pending proposals`}
          >
            Accept pending
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
        {proposals.length === 0 && (
          <div style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 13,
            color: C.muted, padding: '20px 4px', lineHeight: 1.6,
          }}>
            {filter === 'all'
              ? 'No proposals in this session.'
              : `No ${filter} proposals.`}
          </div>
        )}

        {proposals.map(p => (
          <ProposalCard
            key={p.id}
            proposal={p}
            hovered={hoveredProposalId === p.id}
            focused={focusedProposalId === p.id}
            editing={editingProposalId === p.id}
            onHover={hover => onHover(hover ? p.id : null)}
            onFocus={() => onFocus(p.id)}
            onBeginEdit={() => onBeginEdit(p.id)}
            onCancelEdit={() => onBeginEdit(null)}
            onAccept={() => onAccept(p.id)}
            onDismiss={() => onDismiss(p.id)}
            onSetType={type => onSetType(p.id, type)}
            onCommitEdit={text => onCommitEdit(p.id, text)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single proposal card ──

interface ProposalCardProps {
  proposal: ProposedCard;
  hovered: boolean;
  focused: boolean;
  editing: boolean;
  onHover: (hover: boolean) => void;
  onFocus: () => void;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onAccept: () => void;
  onDismiss: () => void;
  onSetType: (type: CardType) => void;
  onCommitEdit: (text: string) => void;
}

function ProposalCard({
  proposal, hovered, focused, editing,
  onHover, onFocus, onBeginEdit, onCancelEdit,
  onAccept, onDismiss, onSetType, onCommitEdit,
}: ProposalCardProps) {
  const isAccepted = proposal.decision === 'accepted' || proposal.decision === 'edited';
  const isDismissed = proposal.decision === 'dismissed';
  const isPending = proposal.decision === 'pending';
  const locked = isAccepted; // type/text immutable once on canvas

  const leftBorder = isAccepted ? C.green : isDismissed ? C.faint : 'transparent';
  const displayText = proposal.editedText ?? proposal.text;

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`Proposal: ${displayText.slice(0, 60)}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={onFocus}
      onClick={onFocus}
      style={{
        background: C.cardBg,
        border: `1px solid ${focused ? 'rgba(196,92,74,0.3)' : C.border}`,
        borderLeft: `3px solid ${leftBorder}`,
        borderRadius: 4,
        padding: '12px 14px', marginBottom: 10,
        opacity: isDismissed ? 0.5 : 1,
        boxShadow: hovered ? '-4px 6px 18px rgba(0,0,0,0.3)' : 'none',
        transition: 'box-shadow 150ms ease-out, border-color 150ms, opacity 150ms',
        outline: 'none',
      }}
    >
      {/* Top row: type pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
      }}>
        <TypePill
          type={proposal.suggestedType}
          locked={locked}
          onChange={onSetType}
        />
        <div style={{ flex: 1 }} />
        {isAccepted && (
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', color: C.green,
            letterSpacing: '0.15em', fontWeight: 600, textTransform: 'uppercase',
          }}>
            ✓ on canvas
          </span>
        )}
        {isDismissed && (
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', color: C.faint,
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            dismissed
          </span>
        )}
      </div>

      {/* Body */}
      {editing ? (
        <EditableBody
          initial={displayText}
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <div
          onClick={e => { if (!locked) { e.stopPropagation(); onBeginEdit(); } }}
          style={{
            fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.55,
            color: C.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            cursor: locked ? 'default' : 'text',
            padding: '2px 0',
          }}
          title={locked ? undefined : 'Click to edit'}
        >
          {displayText || <em style={{ color: C.faint }}>(empty)</em>}
          {proposal.editedText && !isAccepted && (
            <span style={{
              marginLeft: 6, fontSize: 9, color: C.muted,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
              textTransform: 'uppercase', fontStyle: 'normal',
            }}>
              · edited
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {isPending && !editing && (
        <div style={{
          marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.border}`,
          display: 'flex', gap: 4, alignItems: 'center',
        }}>
          <ActionBtn label="Accept" accent onClick={onAccept} hint="I" />
          <ActionBtn label="Edit"   onClick={onBeginEdit}   hint="E" />
          <ActionBtn label="Dismiss" muted onClick={onDismiss} hint="D" />
        </div>
      )}
    </div>
  );
}

// ── Type pill with dropdown ──

function TypePill({ type, locked, onChange }: {
  type: CardType;
  locked: boolean;
  onChange: (t: CardType) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); if (!locked) setOpen(o => !o); }}
        disabled={locked}
        title={locked ? `Type: ${type} (locked — already on canvas)` : `Type: ${type} — click to change`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 9px',
          background: 'rgba(196,92,74,0.08)',
          color: C.accent,
          border: '1px solid rgba(196,92,74,0.25)',
          borderRadius: 999,
          fontSize: 9, fontFamily: 'var(--font-mono)',
          letterSpacing: '0.15em', fontWeight: 600,
          textTransform: 'uppercase',
          cursor: locked ? 'default' : 'pointer',
          opacity: locked ? 0.7 : 1,
        }}
      >
        <span style={{ fontSize: 11 }}>{TYPE_ICONS[type]}</span>
        <span>{type}</span>
        {!locked && <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
          background: '#23201a', border: `1px solid ${C.borderStrong}`,
          borderRadius: 4, padding: 4, minWidth: 130,
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        }}>
          {CARD_TYPES.map(t => (
            <button
              key={t}
              onClick={e => { e.stopPropagation(); onChange(t); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '5px 8px', borderRadius: 3,
                background: t === type ? 'rgba(196,92,74,0.08)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 11, color: t === type ? C.accent : C.inkSoft,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
                textTransform: 'uppercase', fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,92,74,0.12)'; }}
              onMouseLeave={e => {
                e.currentTarget.style.background = t === type ? 'rgba(196,92,74,0.08)' : 'transparent';
              }}
            >
              <span style={{ color: C.accent, fontFamily: 'Georgia, serif', fontSize: 13 }}>
                {TYPE_ICONS[t]}
              </span>
              <span>{t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editable body (textarea, commit on blur / Enter) ──

function EditableBody({ initial, onCommit, onCancel }: {
  initial: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // Auto-size to content so Georgia reads naturally.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(60, el.scrollHeight)}px`;
  }, [value]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      onCancel();
      return;
    }
    onCommit(value);
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setValue(initial);
          onCancel();
        }
      }}
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%', background: 'transparent',
        border: `1px solid ${C.border}`, borderRadius: 3,
        padding: '8px 10px',
        fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.55,
        color: C.ink, resize: 'none', outline: 'none',
        minHeight: 60,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,92,74,0.3)'; }}
    />
  );
}

// ── Action button ──

function ActionBtn({ label, onClick, accent, muted, hint }: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  const color = accent ? C.accent : muted ? C.muted : C.inkSoft;
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={hint ? `${label} (${hint})` : label}
      style={{
        padding: '4px 10px', fontSize: 9, fontWeight: 600,
        background: 'transparent', color,
        border: `1px solid ${accent ? 'rgba(196,92,74,0.25)' : C.border}`,
        borderRadius: 3, cursor: 'pointer',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = accent
          ? 'rgba(196,92,74,0.12)'
          : 'rgba(200,189,160,0.04)';
      }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
}
