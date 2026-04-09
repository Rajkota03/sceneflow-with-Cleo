'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ScreenplayScene } from '@/lib/types';

interface Beat {
  id: number;
  name: string;
  pageRange: string;
  description: string;
}

const SAVE_THE_CAT_BEATS: Beat[] = [
  { id: 1, name: 'Opening Image', pageRange: 'p.1', description: 'A snapshot of the main character\'s world before' },
  { id: 2, name: 'Theme Stated', pageRange: 'p.5', description: 'A hint of the movie\'s theme, usually in dialogue' },
  { id: 3, name: 'Set-Up', pageRange: 'p.1-10', description: 'Establish the hero\'s world, introduce characters' },
  { id: 4, name: 'Catalyst', pageRange: 'p.12', description: 'The inciting incident that changes everything' },
  { id: 5, name: 'Debate', pageRange: 'p.12-25', description: 'The hero questions whether to accept the call' },
  { id: 6, name: 'Break Into Two', pageRange: 'p.25', description: 'The hero makes a decision, enters a new world' },
  { id: 7, name: 'B Story', pageRange: 'p.30', description: 'The love story or subplot that carries the theme' },
  { id: 8, name: 'Fun & Games', pageRange: 'p.30-55', description: 'The promise of the premise, the "trailer moments"' },
  { id: 9, name: 'Midpoint', pageRange: 'p.55', description: 'A false victory or false defeat that raises the stakes' },
  { id: 10, name: 'Bad Guys Close In', pageRange: 'p.55-75', description: 'Internal and external forces tighten' },
  { id: 11, name: 'All Is Lost', pageRange: 'p.75', description: 'The lowest point, a whiff of death' },
  { id: 12, name: 'Dark Night of the Soul', pageRange: 'p.75-85', description: 'The hero wallows before the epiphany' },
  { id: 13, name: 'Break Into Three', pageRange: 'p.85', description: 'The solution is found, combining A & B stories' },
  { id: 14, name: 'Finale', pageRange: 'p.85-110', description: 'The hero applies lessons and transforms' },
  { id: 15, name: 'Final Image', pageRange: 'p.110', description: 'The opposite of the Opening Image, showing change' },
];

// Act boundaries for visual grouping
const ACT_BREAKS: Record<number, string> = {
  1: 'ACT ONE — Setup',
  7: 'ACT TWO — Confrontation',
  13: 'ACT THREE — Resolution',
};

interface BeatEntry {
  text: string;
  linkedSceneId: string | null;
}

type BeatSheetData = Record<number, BeatEntry>;

function storageKey(sessionId: string): string {
  return `sceneflow-beatsheet-${sessionId}`;
}

function loadBeatSheet(sessionId: string): BeatSheetData {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted data, start fresh
  }
  return {};
}

function saveBeatSheet(sessionId: string, data: BeatSheetData): void {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(data));
  } catch {
    // storage full — silent fail
  }
}

interface BeatSheetProps {
  scenes: ScreenplayScene[];
  sessionId: string;
  open: boolean;
  onClose: () => void;
}

export function BeatSheet({ scenes, sessionId, open, onClose }: BeatSheetProps) {
  const [data, setData] = useState<BeatSheetData>({});
  const [expandedBeat, setExpandedBeat] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount / session change
  useEffect(() => {
    setData(loadBeatSheet(sessionId));
  }, [sessionId]);

  // Debounced auto-save
  const queueSave = useCallback(
    (next: BeatSheetData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveBeatSheet(sessionId, next), 400);
    },
    [sessionId],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updateBeat = useCallback(
    (beatId: number, patch: Partial<BeatEntry>) => {
      setData((prev) => {
        const existing = prev[beatId] || { text: '', linkedSceneId: null };
        const next = { ...prev, [beatId]: { ...existing, ...patch } };
        queueSave(next);
        return next;
      });
    },
    [queueSave],
  );

  const filledCount = Object.values(data).filter((e) => e.text.trim().length > 0).length;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(6, 8, 12, 0.6)' }}
          onClick={onClose}
        />
      )}

      {/* Sliding panel */}
      <aside
        ref={panelRef}
        className="fixed top-0 right-0 z-50 h-full flex flex-col transition-transform duration-300 ease-out"
        style={{
          width: 420,
          maxWidth: '100vw',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          background: 'var(--color-deep)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          <div>
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: '#c45c4a' }}
            >
              Beat Sheet
            </h2>
            <p className="text-[10px] mt-0.5" style={{ color: '#8a8578' }}>
              Save the Cat — {filledCount} / 15 beats
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none cursor-pointer transition-colors px-2 py-1 rounded"
            style={{ color: '#4a4740' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#8a8578')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#4a4740')}
            aria-label="Close beat sheet"
          >
            &times;
          </button>
        </div>

        {/* Progress bar */}
        <div className="shrink-0 px-5 pt-3 pb-1">
          <div
            className="h-1 w-full rounded-full overflow-hidden"
            style={{ background: 'rgba(255, 255, 255, 0.04)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${(filledCount / 15) * 100}%`,
                background: 'linear-gradient(90deg, #c45c4a, #d47a6a)',
              }}
            />
          </div>
        </div>

        {/* Beat list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {SAVE_THE_CAT_BEATS.map((beat) => {
            const actLabel = ACT_BREAKS[beat.id];
            const entry = data[beat.id] || { text: '', linkedSceneId: null };
            const isExpanded = expandedBeat === beat.id;
            const isFilled = entry.text.trim().length > 0;

            return (
              <div key={beat.id}>
                {/* Act divider */}
                {actLabel && (
                  <div
                    className="flex items-center gap-3 pt-4 pb-2"
                    style={{ color: '#4a4740' }}
                  >
                    <div className="flex-1 h-px" style={{ background: 'rgba(196, 92, 74, 0.12)' }} />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#c45c4a' }}>
                      {actLabel}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(196, 92, 74, 0.12)' }} />
                  </div>
                )}

                {/* Beat row */}
                <div
                  className="rounded-lg transition-all"
                  style={{
                    background: isExpanded ? 'rgba(196, 92, 74, 0.04)' : 'transparent',
                    border: isExpanded
                      ? '1px solid rgba(196, 92, 74, 0.1)'
                      : '1px solid transparent',
                  }}
                >
                  {/* Collapsed header — always visible */}
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer group"
                    onClick={() => setExpandedBeat(isExpanded ? null : beat.id)}
                  >
                    {/* Beat number pill */}
                    <span
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{
                        background: isFilled
                          ? 'rgba(196, 92, 74, 0.15)'
                          : 'rgba(255, 255, 255, 0.03)',
                        color: isFilled ? '#c45c4a' : '#4a4740',
                      }}
                    >
                      {beat.id}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: isFilled ? 'var(--color-text)' : '#8a8578' }}
                        >
                          {beat.name}
                        </span>
                        <span className="text-[9px] shrink-0" style={{ color: '#4a4740' }}>
                          {beat.pageRange}
                        </span>
                      </div>
                      {/* Preview of user text when collapsed */}
                      {!isExpanded && isFilled && (
                        <p
                          className="text-[11px] mt-0.5 truncate"
                          style={{ color: '#8a8578' }}
                        >
                          {entry.text}
                        </p>
                      )}
                    </div>

                    {/* Expand chevron */}
                    <span
                      className="shrink-0 text-[10px] transition-transform duration-200"
                      style={{
                        color: '#4a4740',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▼
                    </span>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 animate-fade-in">
                      {/* Description */}
                      <p
                        className="text-[11px] italic pl-9"
                        style={{ color: '#8a8578' }}
                      >
                        {beat.description}
                      </p>

                      {/* Text area */}
                      <textarea
                        value={entry.text}
                        onChange={(e) => updateBeat(beat.id, { text: e.target.value })}
                        placeholder={`What happens at "${beat.name}"?`}
                        rows={3}
                        className="w-full resize-none rounded-md px-3 py-2 text-xs leading-relaxed outline-none transition-all"
                        style={{
                          background: 'var(--color-parchment)',
                          border: '1px solid var(--color-parchment-border)',
                          color: 'var(--color-ink)',
                          fontFamily: 'var(--font-screenplay)',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-parchment-border-focus)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-parchment-border)';
                        }}
                      />

                      {/* Scene linking dropdown */}
                      {scenes.length > 0 && (
                        <div className="flex items-center gap-2 pl-1">
                          <span className="text-[10px]" style={{ color: '#4a4740' }}>
                            Scene:
                          </span>
                          <select
                            value={entry.linkedSceneId || ''}
                            onChange={(e) =>
                              updateBeat(beat.id, {
                                linkedSceneId: e.target.value || null,
                              })
                            }
                            className="flex-1 text-[11px] rounded px-2 py-1 outline-none cursor-pointer"
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              color: '#8a8578',
                            }}
                          >
                            <option value="">— None —</option>
                            {scenes.map((scene, i) => (
                              <option key={scene.id} value={scene.id}>
                                {i + 1}. {scene.heading || 'Untitled Scene'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Bottom spacer */}
          <div className="h-6" />
        </div>

        {/* Footer */}
        <div
          className="shrink-0 px-5 py-3 border-t flex items-center justify-between"
          style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#4a4740' }}>
            {filledCount === 15 ? 'All beats complete' : `${15 - filledCount} beats remaining`}
          </span>
          <button
            onClick={() => {
              if (filledCount === 0) return;
              if (!window.confirm('Clear all beat sheet entries?')) return;
              const empty: BeatSheetData = {};
              setData(empty);
              saveBeatSheet(sessionId, empty);
            }}
            className="text-[10px] uppercase tracking-wider cursor-pointer transition-opacity hover:opacity-80"
            style={{ color: filledCount > 0 ? '#cc5f5f' : '#2c2f38' }}
            disabled={filledCount === 0}
          >
            Clear All
          </button>
        </div>
      </aside>
    </>
  );
}
