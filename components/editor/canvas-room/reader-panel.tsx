'use client';
// The Reader — a thinking partner, not a co-writer.
// Right-edge collapsible sidebar in Canvas mode. Reads the board and offers
// grounded observations. Every observation must reference a specific card ID.
// Silence beats slop: if the API returns null, we say so plainly.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasCard, CanvasThread, ReaderObservation } from '@/lib/canvas-room-store';

interface ReaderPanelProps {
  open: boolean;
  onClose: () => void;
  cards: CanvasCard[];
  threads: CanvasThread[];
  observations: ReaderObservation[];
  onNewObservation: (obs: ReaderObservation) => void;
  onFocusCard: (cardId: string) => void;
}

type ReaderKind = 'read-spine' | 'whats-missing' | 'emotional-shape' | 'open-question';

const C = {
  bg:      '#13120f',
  surface: '#1a1812',
  border:  'rgba(200,189,160,0.08)',
  accent:  '#c45c4a',
  ink:     '#e5dcc0',
  muted:   '#7a7060',
  faint:   '#4a4535',
};

const PANEL_WIDTH = 320;
const RAIL_WIDTH = 22;

export function ReaderPanel({
  open, onClose, cards, threads, observations, onNewObservation, onFocusCard,
}: ReaderPanelProps) {
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(false);
  const [nullNotice, setNullNotice] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Focus composer on open (only if nothing else has focus)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (document.activeElement === document.body || document.activeElement === null) {
        composerRef.current?.focus();
      }
    }, 240);
    return () => clearTimeout(t);
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const ask = useCallback(async (kind: ReaderKind, question?: string) => {
    if (loading) return;
    setLoading(true);
    setNullNotice(false);
    try {
      const res = await fetch('/api/kleo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'canvas-reader',
          kind,
          question,
          cards: cards.map(c => ({
            id: c.id, type: c.type, text: c.text, status: c.status,
            emotion: c.emotion, threadIds: c.threadIds, position: c.position,
          })),
          threads: threads.map(t => ({ id: t.id, name: t.name, color: t.color })),
        }),
      });
      const data = await res.json();
      if (!data || data.observation == null || typeof data.observation !== 'string') {
        setNullNotice(true);
        return;
      }
      const obs: ReaderObservation = {
        id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: data.observation,
        referencedCardIds: Array.isArray(data.referencedCardIds) ? data.referencedCardIds : [],
        generatedAt: Date.now(),
      };
      onNewObservation(obs);
    } catch {
      setNullNotice(true);
    } finally {
      setLoading(false);
    }
  }, [cards, threads, loading, onNewObservation]);

  const submitComposer = useCallback(() => {
    const q = composer.trim();
    if (!q || loading) return;
    setComposer('');
    ask('open-question', q);
  }, [composer, loading, ask]);

  const hasDot = observations.length > 0;

  return (
    <>
      {/* Closed-state rail — thin right-edge button */}
      <button
        onClick={() => { if (!open) onClose(); /* parent toggles */ }}
        aria-label="Open The Reader"
        title="The Reader"
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh',
          width: RAIL_WIDTH, zIndex: 150,
          background: C.bg, border: 'none',
          borderLeft: `1px solid ${C.border}`,
          cursor: open ? 'default' : 'pointer',
          display: open ? 'none' : 'flex',
          flexDirection: 'column', alignItems: 'center',
          padding: '16px 0', gap: 10,
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontSize: 9, letterSpacing: '0.3em', color: C.muted,
          textTransform: 'uppercase', fontWeight: 600,
        }}>
          The Reader
        </span>
        {hasDot && (
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: C.accent,
              animation: 'readerDotPulse 1.8s ease-in-out infinite',
              marginTop: 'auto',
            }}
          />
        )}
      </button>

      {/* Slide-in panel */}
      <aside
        aria-hidden={!open}
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh',
          width: PANEL_WIDTH, zIndex: 160,
          background: C.bg,
          borderLeft: `1px solid ${C.border}`,
          transform: open ? 'translateX(0)' : `translateX(${PANEL_WIDTH}px)`,
          transition: 'transform 220ms ease-out',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-sans)',
          boxShadow: open ? '-20px 0 60px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 18px 10px', borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              color: C.accent, letterSpacing: '0.25em', textTransform: 'uppercase',
            }}>
              The Reader
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              title="Close (Esc)"
              style={{
                background: 'none', border: 'none', color: C.muted,
                cursor: 'pointer', fontSize: 18, lineHeight: 1,
                padding: '2px 6px',
              }}
            >×</button>
          </div>
          <div style={{
            marginTop: 6, fontFamily: 'Georgia, serif', fontStyle: 'italic',
            fontSize: 12, color: C.muted, lineHeight: 1.5,
          }}>
            a thinking partner, not a co-writer
          </div>
        </div>

        {/* Action buttons */}
        <div style={{
          padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 6,
          borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <ActionPill label="Read the spine"   onClick={() => ask('read-spine')}       disabled={loading} />
          <ActionPill label="What's missing?"  onClick={() => ask('whats-missing')}    disabled={loading} />
          <ActionPill label="Emotional shape"  onClick={() => ask('emotional-shape')}  disabled={loading} />
        </div>

        {/* Composer */}
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <textarea
            ref={composerRef}
            value={composer}
            onChange={e => setComposer(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitComposer();
              }
            }}
            placeholder="Ask the Reader…"
            rows={2}
            disabled={loading}
            style={{
              width: '100%', background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 4,
              padding: '9px 11px', fontSize: 13, color: C.ink,
              fontFamily: 'Georgia, serif', resize: 'none',
              outline: 'none', lineHeight: 1.5,
              opacity: loading ? 0.5 : 1,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,92,74,0.3)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
          />
          <div style={{
            marginTop: 6, fontSize: 9, color: C.faint,
            fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
          }}>
            ↵ SEND · ⇧↵ NEW LINE
          </div>
        </div>

        {/* Feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 24px' }}>
          {loading && (
            <div style={{
              color: C.muted, fontStyle: 'italic', fontFamily: 'Georgia, serif',
              fontSize: 13, padding: '8px 0',
            }}>
              reading…
            </div>
          )}

          {nullNotice && !loading && (
            <div style={{
              color: C.muted, fontStyle: 'italic', fontFamily: 'Georgia, serif',
              fontSize: 13, padding: '8px 10px', marginBottom: 12,
              background: C.surface, borderLeft: `2px solid ${C.faint}`,
              borderRadius: 3,
            }}>
              Nothing grounded to say yet.
            </div>
          )}

          {observations.length === 0 && !loading && !nullNotice && (
            <div style={{
              color: C.muted, fontStyle: 'italic', fontFamily: 'Georgia, serif',
              fontSize: 13, lineHeight: 1.6, padding: '24px 4px',
            }}>
              The Reader is quiet. Ask me something specific about your board.
            </div>
          )}

          {observations.map(obs => (
            <ObservationCard
              key={obs.id}
              obs={obs}
              cards={cards}
              onFocusCard={onFocusCard}
            />
          ))}
        </div>
      </aside>

      {/* Keyframe for the dot pulse — scoped via inline style tag. */}
      <style>{`
        @keyframes readerDotPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.25); }
        }
      `}</style>
    </>
  );
}

// ── Sub-components ──

function ActionPill({ label, onClick, disabled }: {
  label: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 11px', fontSize: 10,
        background: 'rgba(196,92,74,0.08)',
        color: C.accent,
        border: '1px solid rgba(196,92,74,0.25)',
        borderRadius: 999,
        cursor: disabled ? 'wait' : 'pointer',
        letterSpacing: '0.08em',
        fontFamily: 'var(--font-sans)', fontWeight: 500,
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(196,92,74,0.16)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(196,92,74,0.08)'; }}
    >
      {label}
    </button>
  );
}

function ObservationCard({ obs, cards, onFocusCard }: {
  obs: ReaderObservation;
  cards: CanvasCard[];
  onFocusCard: (cardId: string) => void;
}) {
  const cardById = new Map(cards.map(c => [c.id, c]));
  const validRefs = obs.referencedCardIds.filter(id => cardById.has(id));

  return (
    <div style={{
      background: C.surface, borderLeft: `2px solid ${C.accent}`,
      borderTop: `1px solid ${C.border}`,
      borderRight: `1px solid ${C.border}`,
      borderBottom: `1px solid ${C.border}`,
      borderRadius: 3,
      padding: '12px 14px', marginBottom: 12,
    }}>
      <div style={{
        fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.6,
        color: C.ink, whiteSpace: 'pre-wrap',
      }}>
        {obs.text}
      </div>

      {validRefs.length > 0 && (
        <div style={{
          marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5,
          paddingTop: 8, borderTop: `1px solid ${C.border}`,
        }}>
          {validRefs.map(id => {
            const card = cardById.get(id);
            const preview = card ? previewText(card.text) : id;
            return (
              <button
                key={id}
                onClick={() => onFocusCard(id)}
                title={card?.text || id}
                style={{
                  padding: '2px 7px', fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  color: C.accent,
                  background: 'transparent',
                  border: '1px solid rgba(196,92,74,0.3)',
                  borderRadius: 3,
                  cursor: 'pointer', letterSpacing: '0.08em',
                  whiteSpace: 'nowrap', maxWidth: 180,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,92,74,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {preview}
              </button>
            );
          })}
        </div>
      )}

      <div style={{
        marginTop: 8, fontSize: 9, color: C.faint,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
      }}>
        {formatTime(obs.generatedAt)}
      </div>
    </div>
  );
}

// ── Helpers ──

function previewText(text: string): string {
  const t = text.trim();
  if (!t) return '(empty)';
  return t.length > 22 ? t.slice(0, 22) + '…' : t;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
