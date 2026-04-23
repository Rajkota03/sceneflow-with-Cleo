'use client';
// Story Room — the discussion room before the pages.
// A pile of ideas. Some float. Some find a spot. Some become versions
// of what's already written. Kleo can read the pile and tell you what
// story is taking shape.
//
// This is NOT a corkboard metaphor. It's a conversation surface.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenplayScene } from '@/lib/types';
import type { KleoIdentity, KleoTasteProfile } from '@/lib/kleo-store';
import {
  type StoryNote, type NoteAnchor, type StorySummary,
  getStoryRoom, addNote, updateNote, deleteNote, spawnVersion, saveSummary,
  describeAnchor, getAnchorSceneId,
} from '@/lib/story-room-store';
import type { EditorPalette } from './theme-picker';

interface StoryRoomProps {
  open: boolean;
  scenes: ScreenplayScene[];
  identity: KleoIdentity;
  taste: KleoTasteProfile | null;
  palette: EditorPalette | null;
  onClose: () => void;
}

// ── Main overlay ──

export function StoryRoom({ open, scenes, identity, taste, palette, onClose }: StoryRoomProps) {
  const [notes, setNotes] = useState<StoryNote[]>([]);
  const [summary, setSummary] = useState<StorySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [placingNoteId, setPlacingNoteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load on open
  useEffect(() => {
    if (!open) return;
    const state = getStoryRoom();
    setNotes(state.notes);
    setSummary(state.lastSummary ?? null);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !placingNoteId) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose, placingNoteId]);

  // ── Actions ──

  const handleAddNote = useCallback(() => {
    const text = newNoteText.trim();
    if (!text) return;
    const note = addNote(text);
    setNotes(prev => [note, ...prev]);
    setNewNoteText('');
  }, [newNoteText]);

  const handleUpdateNote = useCallback((id: string, patch: Partial<Pick<StoryNote, 'text' | 'anchor'>>) => {
    const updated = updateNote(id, patch);
    if (updated) setNotes(prev => prev.map(n => n.id === id ? updated : n));
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (deleteNote(id)) setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleSpawnVersion = useCallback((parentId: string) => {
    const n = spawnVersion(parentId, '');
    if (n) setNotes(prev => [n, ...prev]);
  }, []);

  const handleSummary = useCallback(async () => {
    setSummaryLoading(true);
    setShowSummary(true);
    try {
      const res = await fetch('/api/kleo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'room-summary',
          notes: notes.map(n => ({
            text: n.text,
            anchor: describeAnchor(n.anchor, sceneHeadingById(scenes, getAnchorSceneId(n.anchor))),
          })),
          scenes,
          identity, taste,
        }),
      });
      const data = await res.json();
      const s: Omit<StorySummary, 'generatedAt'> = {
        paragraph: data.paragraph || '',
        threads: Array.isArray(data.threads) ? data.threads : [],
      };
      saveSummary(s);
      setSummary({ ...s, generatedAt: Date.now() });
    } catch {
      // Silent — keep the last summary
    } finally {
      setSummaryLoading(false);
    }
  }, [notes, scenes, identity, taste]);

  // ── Grouping ──

  const { floating, placed, versions } = useMemo(() => groupNotes(notes), [notes]);

  if (!open) return null;

  // ── Palette ──
  const c = {
    bg: '#13120f',
    surface: '#1a1812',
    surface2: '#23201a',
    border: 'rgba(200,189,160,0.08)',
    borderStrong: 'rgba(200,189,160,0.16)',
    ink: '#e5dcc0',
    muted: '#7a7060',
    faint: '#4a4535',
    accent: palette?.cursor ?? '#c45c4a',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: c.bg,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', borderBottom: `1px solid ${c.border}`,
        flexShrink: 0, gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 500,
            color: c.ink, margin: 0, letterSpacing: '0.005em',
          }}>
            Story Room
          </h1>
          <span style={{
            fontSize: 11, color: c.muted, fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
          }}>
            the pile, before the pages
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleSummary}
            disabled={summaryLoading}
            style={{
              padding: '7px 14px', fontSize: 11, fontWeight: 600,
              background: 'rgba(196,92,74,0.12)',
              color: c.accent,
              border: `1px solid rgba(196,92,74,0.25)`,
              borderRadius: 4, cursor: summaryLoading ? 'wait' : 'pointer',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              opacity: summaryLoading ? 0.6 : 1,
            }}
          >
            {summaryLoading ? 'Reading…' : 'What am I writing?'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: c.muted,
              cursor: 'pointer', fontSize: 20, padding: '4px 8px',
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >×</button>
        </div>
      </div>

      {/* Input row */}
      <div style={{
        padding: '18px 28px 14px', borderBottom: `1px solid ${c.border}`,
        flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={newNoteText}
          onChange={e => setNewNoteText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
              e.preventDefault();
              handleAddNote();
            }
          }}
          placeholder="Drop an idea. A fragment. A line. Anything — hit enter to keep it."
          rows={2}
          style={{
            width: '100%', background: c.surface,
            border: `1px solid ${c.border}`, borderRadius: 6,
            padding: '12px 14px', fontSize: 14, color: c.ink,
            fontFamily: 'Georgia, serif', resize: 'vertical',
            outline: 'none', lineHeight: 1.6,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,92,74,0.3)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = c.border; }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: c.faint, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            ↵  ENTER TO ADD · ⇧↵ NEW LINE
          </span>
          <button
            onClick={handleAddNote}
            disabled={!newNoteText.trim()}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 600,
              background: newNoteText.trim() ? c.accent : 'transparent',
              color: newNoteText.trim() ? '#fff' : c.faint,
              border: `1px solid ${newNoteText.trim() ? c.accent : c.border}`,
              borderRadius: 4, cursor: newNoteText.trim() ? 'pointer' : 'default',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >Add</button>
        </div>
      </div>

      {/* Body: notes column + script spine rail */}
      <div style={{
        flex: 1, overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '1fr 260px',
        minHeight: 0,
      }}>
        {/* Notes column */}
        <div style={{ overflowY: 'auto', padding: '20px 28px 40px' }}>
          {notes.length === 0 && (
            <EmptyRoom c={c} />
          )}

          {floating.length > 0 && (
            <NoteSection
              title="Floating"
              sub="Not placed yet"
              count={floating.length}
              c={c}
              notes={floating}
              scenes={scenes}
              identity={identity}
              placingNoteId={placingNoteId}
              setPlacingNoteId={setPlacingNoteId}
              onUpdate={handleUpdateNote}
              onDelete={handleDelete}
              onSpawnVersion={handleSpawnVersion}
            />
          )}
          {placed.length > 0 && (
            <NoteSection
              title="Placed"
              sub="Anchored to the script"
              count={placed.length}
              c={c}
              notes={placed}
              scenes={scenes}
              identity={identity}
              placingNoteId={placingNoteId}
              setPlacingNoteId={setPlacingNoteId}
              onUpdate={handleUpdateNote}
              onDelete={handleDelete}
              onSpawnVersion={handleSpawnVersion}
            />
          )}
          {versions.length > 0 && (
            <NoteSection
              title="Versions"
              sub="Alternate takes on existing scenes"
              count={versions.length}
              c={c}
              notes={versions}
              scenes={scenes}
              identity={identity}
              placingNoteId={placingNoteId}
              setPlacingNoteId={setPlacingNoteId}
              onUpdate={handleUpdateNote}
              onDelete={handleDelete}
              onSpawnVersion={handleSpawnVersion}
            />
          )}
        </div>

        {/* Script spine rail */}
        <ScriptSpineRail scenes={scenes} notes={notes} c={c} />
      </div>

      {/* Summary overlay */}
      {showSummary && (
        <StorySummaryPanel
          summary={summary}
          loading={summaryLoading}
          c={c}
          onClose={() => setShowSummary(false)}
          onRegenerate={handleSummary}
        />
      )}
    </div>
  );
}

// ── Sub-components ──

interface Colors {
  bg: string; surface: string; surface2: string;
  border: string; borderStrong: string;
  ink: string; muted: string; faint: string; accent: string;
}

function EmptyRoom({ c }: { c: Colors }) {
  return (
    <div style={{
      padding: '80px 20px', textAlign: 'center', color: c.muted,
      fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.7,
      maxWidth: 520, margin: '0 auto',
    }}>
      The room is empty.<br/>
      <span style={{ color: c.faint, fontSize: 13 }}>
        Ideas that won't become scenes yet.<br/>
        Fragments. Half-thoughts. What-ifs. Drop them here.
      </span>
    </div>
  );
}

function NoteSection(props: {
  title: string; sub: string; count: number;
  c: Colors; notes: StoryNote[]; scenes: ScreenplayScene[];
  identity: KleoIdentity;
  placingNoteId: string | null;
  setPlacingNoteId: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Pick<StoryNote, 'text' | 'anchor'>>) => void;
  onDelete: (id: string) => void;
  onSpawnVersion: (id: string) => void;
}) {
  const { title, sub, count, c, notes, scenes, identity, placingNoteId, setPlacingNoteId, onUpdate, onDelete, onSpawnVersion } = props;
  return (
    <section style={{ marginBottom: 32 }}>
      <header style={{
        display: 'flex', alignItems: 'baseline', gap: 10,
        marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${c.border}`,
      }}>
        <h2 style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: c.accent, letterSpacing: '0.2em',
          textTransform: 'uppercase', margin: 0,
        }}>
          {title}
        </h2>
        <span style={{ fontSize: 10, color: c.faint, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
          {count}
        </span>
        <span style={{ fontSize: 11, color: c.muted, fontStyle: 'italic', fontFamily: 'Georgia, serif', marginLeft: 4 }}>
          — {sub}
        </span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {notes.map(n => (
          <NoteCard
            key={n.id}
            note={n}
            scenes={scenes}
            identity={identity}
            c={c}
            isPlacing={placingNoteId === n.id}
            onStartPlacing={() => setPlacingNoteId(n.id)}
            onStopPlacing={() => setPlacingNoteId(null)}
            onUpdate={patch => onUpdate(n.id, patch)}
            onDelete={() => onDelete(n.id)}
            onSpawnVersion={() => onSpawnVersion(n.id)}
          />
        ))}
      </div>
    </section>
  );
}

// ── Individual note card ──

interface NoteCardProps {
  note: StoryNote;
  scenes: ScreenplayScene[];
  identity: KleoIdentity;
  c: Colors;
  isPlacing: boolean;
  onStartPlacing: () => void;
  onStopPlacing: () => void;
  onUpdate: (patch: Partial<Pick<StoryNote, 'text' | 'anchor'>>) => void;
  onDelete: () => void;
  onSpawnVersion: () => void;
}

function NoteCard({ note, scenes, identity, c, isPlacing, onStartPlacing, onStopPlacing, onUpdate, onDelete, onSpawnVersion }: NoteCardProps) {
  const [editing, setEditing] = useState(!note.text);
  const [draft, setDraft] = useState(note.text);
  const [suggestions, setSuggestions] = useState<PlacementSuggestion[] | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);

  useEffect(() => { setDraft(note.text); }, [note.text]);

  const sceneHeading = sceneHeadingById(scenes, getAnchorSceneId(note.anchor));

  const fetchPlacements = useCallback(async () => {
    setPlaceLoading(true);
    try {
      const res = await fetch('/api/kleo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'room-place',
          noteText: note.text,
          scenes,
          identity,
        }),
      });
      const data = await res.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      setSuggestions([]);
    } finally {
      setPlaceLoading(false);
    }
  }, [note.text, scenes, identity]);

  const handlePlace = () => {
    if (!note.text.trim()) return;
    onStartPlacing();
    if (!suggestions) fetchPlacements();
  };

  const commitPlacement = (s: PlacementSuggestion) => {
    const anchor = suggestionToAnchor(s, scenes);
    onUpdate({ anchor });
    onStopPlacing();
    setSuggestions(null);
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed) { onDelete(); return; }
    onUpdate({ text: trimmed });
    setEditing(false);
  };

  return (
    <div style={{
      background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'border-color 0.15s',
    }}>
      {/* Anchor pill */}
      {note.anchor.type !== 'floating' && (
        <span style={{
          display: 'inline-block', alignSelf: 'flex-start',
          fontSize: 9, fontFamily: 'var(--font-mono)',
          color: c.accent, letterSpacing: '0.12em',
          padding: '2px 7px', borderRadius: 3,
          background: 'rgba(196,92,74,0.1)',
          border: '1px solid rgba(196,92,74,0.2)',
          textTransform: 'uppercase',
        }}>
          {describeAnchor(note.anchor, sceneHeading)}
        </span>
      )}

      {/* Text (inline editable) */}
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitEdit(); }
            if (e.key === 'Escape') { setDraft(note.text); setEditing(false); }
          }}
          style={{
            width: '100%', minHeight: 70, background: 'transparent',
            border: 'none', color: c.ink,
            fontFamily: 'Georgia, serif', fontSize: 13.5, lineHeight: 1.55,
            resize: 'vertical', outline: 'none', padding: 0,
          }}
          placeholder="Write the idea…"
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{
            fontFamily: 'Georgia, serif', fontSize: 13.5, lineHeight: 1.55,
            color: c.ink, cursor: 'text', whiteSpace: 'pre-wrap',
            minHeight: 20,
          }}
        >
          {note.text || <span style={{ color: c.faint, fontStyle: 'italic' }}>empty — click to write</span>}
        </div>
      )}

      {/* Placement suggestions panel */}
      {isPlacing && (
        <div style={{
          marginTop: 2, padding: '10px 12px',
          background: c.surface2, border: `1px solid ${c.borderStrong}`,
          borderRadius: 4,
        }}>
          <div style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', color: c.accent,
            letterSpacing: '0.15em', marginBottom: 8, fontWeight: 600,
          }}>
            KLEO — WHERE DOES THIS GO?
          </div>
          {placeLoading && (
            <div style={{ color: c.muted, fontSize: 12, fontStyle: 'italic', padding: '4px 0' }}>
              reading the pile…
            </div>
          )}
          {!placeLoading && suggestions && suggestions.length === 0 && (
            <div style={{ color: c.muted, fontSize: 12 }}>
              No suggestions — keep it floating for now.
            </div>
          )}
          {!placeLoading && suggestions?.map((s, i) => {
            const label = placementLabel(s, scenes);
            return (
              <button
                key={i}
                onClick={() => commitPlacement(s)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'transparent', border: `1px solid ${c.border}`,
                  borderRadius: 4, padding: '8px 10px',
                  marginBottom: 6, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.background = 'rgba(196,92,74,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: c.ink, marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 11, color: c.muted, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
                  {s.reason}
                </div>
              </button>
            );
          })}
          <button
            onClick={() => { onStopPlacing(); setSuggestions(null); }}
            style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', color: c.muted,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 0', letterSpacing: '0.12em', textTransform: 'uppercase',
              marginTop: 4,
            }}
          >Cancel</button>
        </div>
      )}

      {/* Actions row */}
      {!editing && !isPlacing && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          paddingTop: 6, borderTop: `1px solid ${c.border}`,
        }}>
          <button
            onClick={handlePlace}
            disabled={!note.text.trim()}
            style={{
              background: 'none', border: 'none', cursor: note.text.trim() ? 'pointer' : 'default',
              color: note.text.trim() ? c.accent : c.faint,
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
              textTransform: 'uppercase', fontWeight: 600, padding: 0,
            }}
          >Place ↗</button>
          <button
            onClick={onSpawnVersion}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: c.muted,
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
              textTransform: 'uppercase', padding: 0,
            }}
          >New version</button>
          <button
            onClick={() => setEditing(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: c.muted,
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
              textTransform: 'uppercase', padding: 0,
            }}
          >Edit</button>
          <button
            onClick={onDelete}
            style={{
              marginLeft: 'auto',
              background: 'none', border: 'none', cursor: 'pointer', color: c.faint,
              fontSize: 14, lineHeight: 1, padding: '2px 4px',
            }}
            title="Delete"
          >×</button>
        </div>
      )}
    </div>
  );
}

// ── Script spine rail ──

function ScriptSpineRail({ scenes, notes, c }: { scenes: ScreenplayScene[]; notes: StoryNote[]; c: Colors }) {
  const noteCountsByScene = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes) {
      const sid = getAnchorSceneId(n.anchor);
      if (sid) map.set(sid, (map.get(sid) ?? 0) + 1);
    }
    return map;
  }, [notes]);

  return (
    <aside style={{
      borderLeft: `1px solid ${c.border}`, background: c.bg,
      overflowY: 'auto', padding: '20px 18px',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
        color: c.accent, letterSpacing: '0.2em',
        textTransform: 'uppercase', marginBottom: 14,
      }}>
        Script
      </div>
      {scenes.length === 0 ? (
        <div style={{ color: c.muted, fontSize: 12, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          No scenes yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {scenes.map((s, i) => {
            const count = noteCountsByScene.get(s.id) ?? 0;
            return (
              <div key={s.id} style={{
                padding: '6px 8px', borderRadius: 3,
                background: count > 0 ? 'rgba(196,92,74,0.05)' : 'transparent',
                borderLeft: count > 0 ? `2px solid ${c.accent}` : '2px solid transparent',
                display: 'flex', alignItems: 'baseline', gap: 8,
              }}>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', color: c.faint,
                  minWidth: 20, letterSpacing: '0.04em',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{
                  fontSize: 11, color: c.ink, letterSpacing: '0.02em',
                  textTransform: 'uppercase', flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.heading}
                </span>
                {count > 0 && (
                  <span style={{ fontSize: 9, color: c.accent, fontFamily: 'var(--font-mono)' }}>
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

// ── Summary panel ──

function StorySummaryPanel({ summary, loading, c, onClose, onRegenerate }: {
  summary: StorySummary | null; loading: boolean; c: Colors;
  onClose: () => void; onRegenerate: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 210,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: c.surface, border: `1px solid ${c.borderStrong}`,
          borderRadius: 8, padding: '28px 32px',
          maxWidth: 620, width: '100%', maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', color: c.accent,
          letterSpacing: '0.2em', fontWeight: 600, marginBottom: 16,
          textTransform: 'uppercase',
        }}>
          Kleo — What You're Writing
        </div>

        {loading && !summary && (
          <p style={{
            fontFamily: 'Georgia, serif', fontSize: 15, fontStyle: 'italic',
            color: c.muted, lineHeight: 1.6, margin: 0,
          }}>
            reading the room…
          </p>
        )}

        {summary && (
          <>
            <p style={{
              fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.7,
              color: c.ink, margin: 0, opacity: loading ? 0.5 : 1,
            }}>
              {summary.paragraph}
            </p>

            {summary.threads.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', color: c.muted,
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10,
                }}>
                  Threads I see
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {summary.threads.map((t, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: '4px 10px',
                      background: 'rgba(196,92,74,0.08)',
                      border: '1px solid rgba(196,92,74,0.2)',
                      borderRadius: 3, color: c.accent,
                      fontFamily: 'Georgia, serif',
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              marginTop: 24, paddingTop: 16, borderTop: `1px solid ${c.border}`,
              fontSize: 10, color: c.faint, fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between',
            }}>
              <span>
                {new Date(summary.generatedAt).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
              <span style={{ display: 'flex', gap: 14 }}>
                <button
                  onClick={onRegenerate}
                  disabled={loading}
                  style={{
                    background: 'none', border: 'none', cursor: loading ? 'wait' : 'pointer',
                    color: c.accent, fontSize: 10, fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.12em', textTransform: 'uppercase', padding: 0,
                    fontWeight: 600, opacity: loading ? 0.5 : 1,
                  }}
                >{loading ? 'reading…' : 'Regenerate'}</button>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: c.muted, fontSize: 10, fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.12em', textTransform: 'uppercase', padding: 0,
                  }}
                >Close</button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──

interface PlacementSuggestion {
  anchorType: 'floating' | 'before-scene' | 'after-scene' | 'inside-scene' | 'version-of';
  sceneIndex: number | null;
  reason: string;
  label?: string;
}

function suggestionToAnchor(s: PlacementSuggestion, scenes: ScreenplayScene[]): NoteAnchor {
  if (s.anchorType === 'floating' || s.sceneIndex === null) return { type: 'floating' };
  const idx = Math.max(0, Math.min(scenes.length - 1, s.sceneIndex - 1));
  const sceneId = scenes[idx]?.id;
  if (!sceneId) return { type: 'floating' };
  return { type: s.anchorType, sceneId } as NoteAnchor;
}

function placementLabel(s: PlacementSuggestion, scenes: ScreenplayScene[]): string {
  if (s.label) return s.label;
  if (s.anchorType === 'floating' || s.sceneIndex === null) return 'Keep it floating';
  const idx = Math.max(0, Math.min(scenes.length - 1, s.sceneIndex - 1));
  const scene = scenes[idx];
  const heading = scene?.heading ?? '';
  const verb = {
    'before-scene': 'Before',
    'after-scene':  'After',
    'inside-scene': 'Inside',
    'version-of':   'Version of',
  }[s.anchorType];
  return `${verb} Scene ${s.sceneIndex} — ${heading}`;
}

function sceneHeadingById(scenes: ScreenplayScene[], sceneId: string | null): string | undefined {
  if (!sceneId) return undefined;
  return scenes.find(s => s.id === sceneId)?.heading;
}

function groupNotes(notes: StoryNote[]) {
  const floating: StoryNote[] = [];
  const placed: StoryNote[] = [];
  const versions: StoryNote[] = [];
  for (const n of notes) {
    if (n.anchor.type === 'floating') floating.push(n);
    else if (n.anchor.type === 'version-of') versions.push(n);
    else placed.push(n);
  }
  return { floating, placed, versions };
}
