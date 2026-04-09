'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { ScreenplayScene, ScreenplayElement } from '@/lib/types';

interface SceneCardsProps {
  scenes: ScreenplayScene[];
  onReorder: (scenes: ScreenplayScene[]) => void;
  onSelectScene: (id: string) => void;
  onAddScene?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// Deterministic "random" rotation per card so it stays stable across renders
function cardRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return ((hash % 5) - 2) * 0.6; // -1.2 to 1.2 degrees
}

function getSceneStats(elements: ScreenplayElement[]) {
  let dialogueWords = 0;
  let actionWords = 0;
  let totalWords = 0;
  const characters = new Set<string>();
  let firstAction = '';

  for (const el of elements) {
    const words = el.text.trim().split(/\s+/).filter(Boolean).length;
    totalWords += words;

    if (el.type === 'dialogue' || el.type === 'parenthetical') {
      dialogueWords += words;
    }
    if (el.type === 'action') {
      actionWords += words;
      if (!firstAction) {
        firstAction = el.text.trim();
      }
    }
    if (el.type === 'character') {
      characters.add(el.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase());
    }
  }

  const isDialogueHeavy = dialogueWords > actionWords;
  const truncatedAction = firstAction.length > 50
    ? firstAction.slice(0, 50).replace(/\s\S*$/, '...') // break at word boundary
    : firstAction;

  return {
    totalWords,
    isDialogueHeavy,
    characters: Array.from(characters),
    firstAction: truncatedAction,
  };
}

// Pushpin SVG rendered inline -- small and sharp
function Pushpin({ color }: { color: string }) {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="none" className="shrink-0">
      <circle cx="6" cy="4" r="3.5" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      <rect x="5.25" y="7" width="1.5" height="7" rx="0.5" fill="rgba(0,0,0,0.25)" />
      <circle cx="6" cy="4" r="1.5" fill="rgba(255,255,255,0.25)" />
    </svg>
  );
}

export function SceneCards({ scenes, onReorder, onSelectScene, onAddScene, isOpen, onClose }: SceneCardsProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const dragIdx = useRef<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string, idx: number) => {
    setDragId(id);
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    // Ghost image: use the card itself
    const target = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(target, target.offsetWidth / 2, 20);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragId) setOverId(id);
  }, [dragId]);

  const handleDragLeave = useCallback(() => {
    setOverId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === -1 || fromIdx === targetIdx) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const reordered = [...scenes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    onReorder(reordered);
    setDragId(null);
    setOverId(null);
  }, [scenes, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setOverId(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--color-void)' }}
    >
      {/* Header bar */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-deep)' }}
      >
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="1" y="1" width="7" height="7" rx="1.5" stroke="#c45c4a" strokeWidth="1.2" />
            <rect x="12" y="1" width="7" height="7" rx="1.5" stroke="#c45c4a" strokeWidth="1.2" />
            <rect x="1" y="12" width="7" height="7" rx="1.5" stroke="#c45c4a" strokeWidth="1.2" />
            <rect x="12" y="12" width="7" height="7" rx="1.5" stroke="#c45c4a" strokeWidth="1.2" />
          </svg>
          <h2
            className="text-sm font-medium uppercase tracking-widest"
            style={{ color: '#c45c4a' }}
          >
            Scene Cards
          </h2>
          <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>
            {scenes.length} scene{scenes.length !== 1 ? 's' : ''} &middot; drag to reorder
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-xs uppercase tracking-wider rounded-md cursor-pointer transition-all hover:opacity-90"
          style={{
            backgroundColor: 'rgba(196, 92, 74, 0.08)',
            color: '#c45c4a',
            border: '1px solid rgba(196, 92, 74, 0.15)',
          }}
        >
          Back to Editor
        </button>
      </div>

      {/* Cork board */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-8"
        style={{
          background: `
            radial-gradient(ellipse at 20% 30%, rgba(196,92,74,0.03) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 70%, rgba(77,139,232,0.02) 0%, transparent 60%),
            var(--color-deep)
          `,
        }}
      >
        {scenes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm italic" style={{ color: 'var(--color-text-3)' }}>
              No scenes to display. Add scenes in the editor first.
            </p>
          </div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {/* Add new scene card */}
            {onAddScene && (
              <div
                onClick={onAddScene}
                className="group relative cursor-pointer select-none"
                style={{ transform: 'rotate(0deg)' }}
              >
                <div
                  className="relative rounded-lg p-5 flex flex-col items-center justify-center group-hover:shadow-xl"
                  style={{
                    background: 'rgba(196, 92, 74, 0.03)',
                    border: '2px dashed rgba(196, 92, 74, 0.15)',
                    minHeight: '180px',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(196,92,74,0.4)'; e.currentTarget.style.background = 'rgba(196,92,74,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(196,92,74,0.15)'; e.currentTarget.style.background = 'rgba(196,92,74,0.03)'; }}
                >
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ marginBottom: 8, opacity: 0.5 }}>
                    <path d="M14 6v16M6 14h16" stroke="#c45c4a" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 12, color: '#c45c4a', opacity: 0.7, fontWeight: 500 }}>New Scene</span>
                </div>
              </div>
            )}

            {scenes.map((scene, idx) => {
              const stats = getSceneStats(scene.elements);
              const rotation = cardRotation(scene.id);
              const isDragging = dragId === scene.id;
              const isOver = overId === scene.id;

              // Tint: warm (amber) for dialogue-heavy, cool (blue-gray) for action-heavy
              const cardBg = stats.isDialogueHeavy
                ? 'rgba(196, 92, 74, 0.04)'
                : 'rgba(77, 139, 232, 0.03)';
              const cardBorder = stats.isDialogueHeavy
                ? 'rgba(196, 92, 74, 0.12)'
                : 'rgba(77, 139, 232, 0.10)';
              const tintDot = stats.isDialogueHeavy ? '#c45c4a' : '#4d8be8';

              return (
                <div
                  key={scene.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, scene.id, idx)}
                  onDragOver={(e) => handleDragOver(e, scene.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectScene(scene.id)}
                  className="group relative cursor-pointer select-none"
                  style={{
                    transform: `rotate(${isDragging ? 0 : rotation}deg) ${isOver ? 'scale(1.03)' : 'scale(1)'}`,
                    opacity: isDragging ? 0.4 : 1,
                    transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s, box-shadow 0.25s',
                  }}
                >
                  {/* Drop indicator */}
                  {isOver && !isDragging && (
                    <div
                      className="absolute -inset-1 rounded-xl pointer-events-none"
                      style={{
                        border: '2px dashed #c45c4a',
                        borderRadius: '12px',
                      }}
                    />
                  )}

                  {/* Card */}
                  <div
                    className="relative rounded-lg p-5 pb-4 group-hover:shadow-xl"
                    style={{
                      background: cardBg,
                      border: `1px solid ${cardBorder}`,
                      boxShadow: `
                        0 2px 8px rgba(0,0,0,0.3),
                        0 1px 2px rgba(0,0,0,0.2),
                        inset 0 1px 0 rgba(255,255,255,0.02)
                      `,
                      minHeight: '180px',
                    }}
                  >
                    {/* Pushpin */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <Pushpin color={tintDot} />
                    </div>

                    {/* Scene number badge */}
                    <div className="flex items-start justify-between mb-3 pt-1">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          color: tintDot,
                        }}
                      >
                        Scene {idx + 1}
                      </span>
                      <span
                        className="text-[10px] tabular-nums"
                        style={{ color: 'var(--color-text-3)' }}
                      >
                        {stats.totalWords} word{stats.totalWords !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Heading */}
                    <h3
                      className="text-xs font-bold uppercase leading-snug mb-2 line-clamp-2"
                      style={{
                        fontFamily: 'var(--font-screenplay)',
                        color: 'var(--color-text)',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {scene.heading || 'UNTITLED SCENE'}
                    </h3>

                    {/* First action line */}
                    {stats.firstAction ? (
                      <p
                        className="text-[11px] leading-relaxed mb-3 line-clamp-2"
                        style={{
                          color: 'var(--color-text-2)',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {stats.firstAction}
                      </p>
                    ) : (
                      <p
                        className="text-[11px] italic mb-3"
                        style={{ color: 'var(--color-text-3)' }}
                      >
                        No action text
                      </p>
                    )}

                    {/* Characters */}
                    {stats.characters.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        {stats.characters.slice(0, 4).map((name) => (
                          <span
                            key={name}
                            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              color: 'var(--color-text-2)',
                            }}
                          >
                            {name}
                          </span>
                        ))}
                        {stats.characters.length > 4 && (
                          <span
                            className="text-[9px] px-1.5 py-0.5"
                            style={{ color: 'var(--color-text-3)' }}
                          >
                            +{stats.characters.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Tint indicator line at bottom */}
                    <div
                      className="absolute bottom-0 left-3 right-3 h-px"
                      style={{
                        background: `linear-gradient(to right, transparent, ${tintDot}33, transparent)`,
                      }}
                    />

                    {/* Hover overlay */}
                    <div
                      className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{
                        background: 'rgba(196, 92, 74, 0.02)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(196,92,74,0.15)',
                        borderRadius: 'inherit',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
