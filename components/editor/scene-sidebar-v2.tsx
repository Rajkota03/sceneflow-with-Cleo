'use client';
import { useState, useRef, useCallback, useMemo } from 'react';
import type { Doc, Block, DerivedScene } from '@/lib/doc';
import { deriveScenes } from '@/lib/doc';

interface SceneSidebarV2Props {
  doc: Doc;
  activeSceneId: string | null;
  palette?: { ink: string; inkFaint: string; muted: string; headerBg: string; border: string; cursor: string; paper: string } | null;
  onSceneSelect: (blockId: string) => void;
  onDocChange: (doc: Doc) => void;
  onAddScene: () => void;
}

// --- Helpers ---

function countWords(blocks: Block[], startIdx: number, endIdx: number): number {
  let total = 0;
  for (let i = startIdx; i <= endIdx; i++) {
    const text = blocks[i].text.trim();
    if (text) total += text.split(/\s+/).length;
  }
  return total;
}

function estimateTime(blocks: Block[], startIdx: number, endIdx: number): string {
  // ~56 lines per page, ~1 page per minute of screen time
  const lineCount = endIdx - startIdx + 1;
  const pages = lineCount / 56;
  const minutes = pages;
  if (minutes < 0.1) return '';
  if (minutes < 1) return `~${Math.round(minutes * 60)}s`;
  return `~${Math.round(minutes * 10) / 10}min`;
}

function trimHeading(heading: string): string {
  if (!heading) return 'Untitled';
  return heading
    .replace(/^(INT\.|EXT\.|INT\.\/EXT\.|INT\/EXT\.|I\/E\.)\s*/i, '')
    .replace(/\s*-\s*.*$/, '')
    .trim() || 'Untitled';
}

function sceneSummary(blocks: Block[], startIdx: number, endIdx: number): string {
  for (let i = startIdx; i <= endIdx; i++) {
    if (blocks[i].type === 'action' && blocks[i].text.trim()) {
      const text = blocks[i].text.trim();
      return text.length > 60 ? text.slice(0, 57) + '...' : text;
    }
  }
  return '';
}

function sceneCharacters(blocks: Block[], startIdx: number, endIdx: number): string[] {
  const chars = new Set<string>();
  for (let i = startIdx; i <= endIdx; i++) {
    if (blocks[i].type === 'character' && blocks[i].text.trim()) {
      chars.add(blocks[i].text.trim().replace(/\s*\(.*\)$/, '').toUpperCase());
    }
  }
  return Array.from(chars).slice(0, 4);
}

// Drag handle grip icon — six dots in a 2x3 grid
function DragGrip({ color }: { color: string }) {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill={color} style={{ flexShrink: 0, opacity: 0.5 }}>
      <circle cx="2" cy="2" r="1.2" />
      <circle cx="6" cy="2" r="1.2" />
      <circle cx="2" cy="7" r="1.2" />
      <circle cx="6" cy="7" r="1.2" />
      <circle cx="2" cy="12" r="1.2" />
      <circle cx="6" cy="12" r="1.2" />
    </svg>
  );
}

// Lock icon — simple padlock
function LockIcon({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="10" height="7" rx="1.5" fill={color} fillOpacity={0.15} />
      <path d="M5 8V5.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

// Unlock icon — padlock with shackle open
function UnlockIcon({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="10" height="7" rx="1.5" />
      <path d="M5 8V5.5a3 3 0 0 1 6 0" />
    </svg>
  );
}

// Drop indicator line shown between scenes during drag
function DropLine({ color }: { color: string }) {
  return (
    <div style={{
      height: 2,
      background: color,
      borderRadius: 1,
      margin: '0 12px',
      boxShadow: `0 0 4px ${color}40`,
      pointerEvents: 'none',
    }} />
  );
}

export function SceneSidebarV2({
  doc,
  activeSceneId,
  palette,
  onSceneSelect,
  onDocChange,
  onAddScene,
}: SceneSidebarV2Props) {
  const scenes = useMemo(() => deriveScenes(doc.blocks), [doc.blocks]);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingNumberId, setEditingNumberId] = useState<string | null>(null);
  const [editingNumberValue, setEditingNumberValue] = useState('');
  const numberInputRef = useRef<HTMLInputElement | null>(null);

  // Drag state: dropIdx can be 0..scenes.length (scenes.length = drop after last)
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggle scene lock: sets meta.locked on ALL blocks in the scene
  const handleLockToggle = useCallback((e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    const scene = scenes.find(s => s.headingBlockId === sceneId);
    if (!scene) return;

    const isCurrentlyLocked = !!scene.locked;
    const newBlocks = doc.blocks.map((block, idx) => {
      if (idx >= scene.startIndex && idx <= scene.endIndex) {
        const newMeta = { ...block.meta };
        if (isCurrentlyLocked) {
          delete newMeta.locked;
        } else {
          newMeta.locked = true;
        }
        return { ...block, meta: newMeta };
      }
      return block;
    });

    onDocChange({ ...doc, blocks: newBlocks, version: doc.version + 1 });
  }, [scenes, doc, onDocChange]);

  // Save a custom scene number to the heading block's meta
  const handleSceneNumberSave = useCallback((sceneId: string, value: string) => {
    const trimmed = value.trim();
    const newBlocks = doc.blocks.map(block => {
      if (block.id === sceneId) {
        const newMeta = { ...block.meta };
        if (trimmed) {
          newMeta.sceneNumber = trimmed;
        } else {
          delete newMeta.sceneNumber;
        }
        return { ...block, meta: newMeta };
      }
      return block;
    });
    onDocChange({ ...doc, blocks: newBlocks, version: doc.version + 1 });
    setEditingNumberId(null);
  }, [doc, onDocChange]);

  // Auto-number all scenes sequentially, clearing any custom numbers
  const handleResetNumbers = useCallback(() => {
    let counter = 1;
    const newBlocks = doc.blocks.map(block => {
      if (block.type === 'scene-heading') {
        const newMeta = { ...block.meta, sceneNumber: String(counter) };
        counter++;
        return { ...block, meta: newMeta };
      }
      return block;
    });
    onDocChange({ ...doc, blocks: newBlocks, version: doc.version + 1 });
  }, [doc, onDocChange]);

  // Clear all custom numbers (revert to auto-index)
  const handleClearNumbers = useCallback(() => {
    const newBlocks = doc.blocks.map(block => {
      if (block.type === 'scene-heading' && block.meta.sceneNumber) {
        const newMeta = { ...block.meta };
        delete newMeta.sceneNumber;
        return { ...block, meta: newMeta };
      }
      return block;
    });
    onDocChange({ ...doc, blocks: newBlocks, version: doc.version + 1 });
  }, [doc, onDocChange]);

  // Double-click to confirm delete
  const handleDeleteClick = useCallback((e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    if (scenes.length <= 1) return; // don't delete last scene

    if (deleteConfirm === sceneId) {
      // Second click: perform delete
      const scene = scenes.find(s => s.headingBlockId === sceneId);
      if (!scene) return;

      const newBlocks = [
        ...doc.blocks.slice(0, scene.startIndex),
        ...doc.blocks.slice(scene.endIndex + 1),
      ];

      // If we wiped everything, don't allow empty doc
      if (newBlocks.length === 0) return;

      onDocChange({ ...doc, blocks: newBlocks, version: doc.version + 1 });
      setDeleteConfirm(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    } else {
      // First click: arm confirmation
      setDeleteConfirm(sceneId);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setDeleteConfirm(null), 3000);
    }
  }, [deleteConfirm, scenes, doc, onDocChange]);

  // --- Drag to reorder ---
  // dropIdx represents the insertion point: scene will be placed BEFORE dropIdx.
  // dropIdx === scenes.length means "after the last scene".

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    dragNode.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIdx !== null && dropIdx !== null) {
      // Dropping at dropIdx means: insert BEFORE scene[dropIdx].
      // No-op if dropping at same position or the position right after (same logical spot).
      const isNoop = dropIdx === dragIdx || dropIdx === dragIdx + 1;

      if (!isNoop) {
        const fromScene = scenes[dragIdx];
        if (!fromScene) {
          setDragIdx(null);
          setDropIdx(null);
          dragNode.current = null;
          return;
        }

        // Extract the dragged scene's blocks
        const movedBlocks = doc.blocks.slice(fromScene.startIndex, fromScene.endIndex + 1);

        // Remove dragged scene from blocks
        const without = [
          ...doc.blocks.slice(0, fromScene.startIndex),
          ...doc.blocks.slice(fromScene.endIndex + 1),
        ];

        // Calculate insertion point in the "without" array
        let insertAt: number;

        if (dropIdx >= scenes.length) {
          // Drop after last scene -> append to end
          insertAt = without.length;
        } else {
          // Drop before scene[dropIdx]
          const targetScene = scenes[dropIdx];
          // After removal, find where the target scene's heading is in the "without" array
          const targetPos = without.findIndex(b => b.id === targetScene.headingBlockId);
          insertAt = targetPos === -1 ? without.length : targetPos;
        }

        const newBlocks = [
          ...without.slice(0, insertAt),
          ...movedBlocks,
          ...without.slice(insertAt),
        ];

        onDocChange({ ...doc, blocks: newBlocks, version: doc.version + 1 });
      }
    }

    setDragIdx(null);
    setDropIdx(null);
    dragNode.current = null;
  }, [dragIdx, dropIdx, scenes, doc, onDocChange]);

  // Compute drop position from mouse Y relative to scene items
  const handleDragOverList = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const list = listRef.current;
    if (!list || dragIdx === null) return;

    // Get all scene item elements (they have data-scene-idx attribute)
    const items = list.querySelectorAll<HTMLElement>('[data-scene-idx]');
    if (items.length === 0) return;

    const mouseY = e.clientY;
    let newDropIdx = scenes.length; // default: after last

    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (mouseY < midY) {
        newDropIdx = i;
        break;
      }
    }

    setDropIdx(newDropIdx);
  }, [dragIdx, scenes.length]);

  return (
    <aside
      className="shrink-0 flex flex-col"
      style={{
        width: 180,
        height: '100%',
        overflow: 'hidden',
        borderRight: '1px solid #1e1c17',
        background: 'transparent',
        paddingTop: 12,
        transition: 'width 0.2s ease',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2" style={{ borderBottom: `1px solid ${palette?.border ?? 'rgba(200,189,160,0.04)'}` }}>
        <span style={{
          fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em',
          color: palette?.cursor ?? '#c45c4a', fontWeight: 600,
          padding: '4px 0',
        }}>
          Scenes
        </span>
        <div className="flex items-center gap-1">
          {/* Auto-number: assign 1, 2, 3... to all scenes */}
          <button
            title="Number all scenes (1, 2, 3...)"
            style={{
              cursor: 'pointer', border: 'none', background: 'transparent',
              color: palette?.muted ?? '#7a7060', fontSize: 9, padding: '2px 4px',
              borderRadius: 3, fontFamily: 'var(--font-mono)',
              opacity: 0.6, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6' }}
            onClick={handleResetNumbers}
          >
            #1,2,3
          </button>
          {/* Clear custom numbers */}
          {scenes.some(s => s.sceneNumber) && (
            <button
              title="Clear all custom scene numbers"
              style={{
                cursor: 'pointer', border: 'none', background: 'transparent',
                color: palette?.muted ?? '#7a7060', fontSize: 9, padding: '2px 4px',
                borderRadius: 3, opacity: 0.6, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6' }}
              onClick={handleClearNumbers}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingTop: 8 }}>
        {(
          <div
            ref={listRef}
            onDragOver={handleDragOverList}
            onDrop={handleDragEnd}
            onDragLeave={(e) => {
              // Only clear if leaving the list entirely
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropIdx(null);
              }
            }}
          >
            {scenes.map((scene, i) => {
              const isActive = scene.headingBlockId === activeSceneId;
              const heading = trimHeading(scene.heading);
              const words = countWords(doc.blocks, scene.startIndex, scene.endIndex);
              const time = estimateTime(doc.blocks, scene.startIndex, scene.endIndex);
              const isDeleteArmed = deleteConfirm === scene.headingBlockId;
              const isDragging = dragIdx === i;
              const cursorColor = palette?.cursor ?? '#c45c4a';

              // Show drop line before this item?
              const showDropBefore = dragIdx !== null && dropIdx === i
                && dropIdx !== dragIdx && dropIdx !== dragIdx + 1;

              return (
                <div key={scene.headingBlockId || `orphan-${i}`}>
                  {/* Drop indicator line */}
                  {showDropBefore && <DropLine color={cursorColor} />}

                  <div
                    data-scene-idx={i}
                    draggable={!!scene.headingBlockId && !scene.locked}
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="flex items-start px-2 py-3 cursor-grab group"
                    style={{
                      opacity: isDragging ? 0.3 : scene.locked ? 0.7 : 1,
                      background: isActive
                        ? `rgba(196,92,74,0.1)`
                        : 'transparent',
                      borderLeft: isActive
                        ? `2px solid ${palette?.cursor ?? '#c45c4a'}`
                        : scene.locked
                          ? `2px solid ${palette?.cursor ?? '#c45c4a'}40`
                          : '2px solid transparent',
                      transition: 'opacity 0.15s ease, background 0.15s ease',
                      gap: 6,
                      borderRadius: '0 4px 4px 0',
                    }}
                    onClick={() => {
                      // Don't navigate if we just finished dragging
                      if (dragIdx !== null) return;
                      if (scene.headingBlockId) onSceneSelect(scene.headingBlockId);
                    }}
                    onMouseEnter={e => {
                      if (!isDragging && !isActive) {
                        (e.currentTarget as HTMLElement).style.background = `rgba(200,189,160,0.06)`;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }
                    }}
                  >
                    {/* Drag handle — visible on hover */}
                    {scene.headingBlockId && (
                      <span
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          cursor: 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          paddingTop: 1,
                          flexShrink: 0,
                        }}
                      >
                        <DragGrip color={palette?.muted ?? '#7a7060'} />
                      </span>
                    )}

                    {/* Scene content */}
                    <div className="flex flex-col min-w-0" style={{ paddingLeft: scene.headingBlockId ? 0 : 14 }}>
                      {/* Scene number + color dot — clickable to edit */}
                      {editingNumberId === scene.headingBlockId ? (
                        <input
                          ref={numberInputRef}
                          autoFocus
                          value={editingNumberValue}
                          onChange={e => setEditingNumberValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleSceneNumberSave(scene.headingBlockId, editingNumberValue);
                            } else if (e.key === 'Escape') {
                              setEditingNumberId(null);
                            }
                          }}
                          onBlur={() => handleSceneNumberSave(scene.headingBlockId, editingNumberValue)}
                          style={{
                            width: 36, fontSize: 11, fontFamily: 'var(--font-mono)',
                            color: palette?.ink ?? '#c8bda0',
                            background: 'rgba(200,189,160,0.08)',
                            border: `1px solid ${palette?.cursor ?? '#c45c4a'}60`,
                            borderRadius: 3, padding: '1px 4px',
                            outline: 'none',
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="flex items-center gap-1.5"
                          style={{
                            fontSize: 11, color: palette?.muted ?? '#7a7060', fontFamily: 'var(--font-mono)',
                            cursor: scene.headingBlockId ? 'pointer' : 'default',
                            borderRadius: 2,
                          }}
                          title={scene.headingBlockId ? 'Click to edit scene number' : undefined}
                          onClick={e => {
                            if (!scene.headingBlockId) return;
                            e.stopPropagation();
                            setEditingNumberId(scene.headingBlockId);
                            setEditingNumberValue(scene.sceneNumber ?? String(i + 1));
                          }}
                        >
                          {scene.color && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: scene.color,
                                flexShrink: 0,
                              }}
                            />
                          )}
                          {scene.sceneNumber ?? (i + 1)}
                        </span>
                      )}

                      {/* Heading */}
                      <span style={{
                        fontSize: 9,
                        color: palette?.ink ?? '#c8bda0',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {heading}
                      </span>

                      {/* Word count + time — always visible */}
                      <span style={{
                        fontSize: 8,
                        color: palette?.muted ?? '#7a7060',
                        marginTop: 2,
                        opacity: 0.7,
                      }}>
                        {words > 0 && <>{words}w{time ? ` \u00b7 ${time}` : ''}</>}
                      </span>

                      {/* Expanded outline details — visible when active */}
                      {isActive && (() => {
                        const summary = sceneSummary(doc.blocks, scene.startIndex, scene.endIndex);
                        const chars = sceneCharacters(doc.blocks, scene.startIndex, scene.endIndex);
                        return (
                          <>
                            {summary && (
                              <div style={{
                                fontSize: 9, color: palette?.inkFaint ?? '#4a4535',
                                marginTop: 4, lineHeight: 1.4,
                                overflow: 'hidden', textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}>
                                {summary}
                              </div>
                            )}
                            {chars.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {chars.map(c => (
                                  <span key={c} style={{
                                    fontSize: 7, color: palette?.muted ?? '#7a7060',
                                    textTransform: 'uppercase', letterSpacing: '0.06em',
                                    padding: '1px 3px', borderRadius: 2,
                                    background: 'rgba(200,189,160,0.06)',
                                  }}>
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Lock + Delete row */}
                      {scene.headingBlockId && (
                        <div
                          className="flex items-center gap-1 mt-2"
                        >
                          {/* Lock toggle */}
                          <button
                            className={scene.locked ? '' : 'opacity-0 group-hover:opacity-100 transition-all'}
                            style={{
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 3,
                              fontSize: 10, fontFamily: 'inherit',
                              color: scene.locked ? (palette?.cursor ?? '#c45c4a') : (palette?.muted ?? '#7a7060'),
                              background: scene.locked ? 'rgba(196,92,74,0.08)' : 'transparent',
                              border: 'none', borderRadius: 3, padding: '2px 5px',
                            }}
                            title={scene.locked ? 'Unlock scene' : 'Lock scene'}
                            onClick={(e) => handleLockToggle(e, scene.headingBlockId)}
                          >
                            {scene.locked
                              ? <LockIcon color={palette?.cursor ?? '#c45c4a'} size={10} />
                              : <UnlockIcon color={palette?.muted ?? '#7a7060'} size={10} />
                            }
                          </button>

                          {/* Delete button */}
                          {scenes.length > 1 && !scene.locked && (
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-all"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                fontSize: 10, fontFamily: 'inherit',
                                color: isDeleteArmed ? '#e05555' : (palette?.muted ?? '#7a7060'),
                                background: isDeleteArmed ? 'rgba(224,85,85,0.1)' : 'transparent',
                                border: isDeleteArmed ? '1px solid rgba(224,85,85,0.2)' : '1px solid transparent',
                                borderRadius: 3, padding: '2px 5px',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}
                              onClick={(e) => handleDeleteClick(e, scene.headingBlockId)}
                            >
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M2 3h8M4.5 3V2a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M9.5 3v7a1 1 0 01-1 1h-5a1 1 0 01-1-1V3" />
                              </svg>
                              {isDeleteArmed && <span>Confirm</span>}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Drop indicator after last scene */}
            {dragIdx !== null && dropIdx === scenes.length
              && dropIdx !== dragIdx && dropIdx !== dragIdx + 1
              && <DropLine color={palette?.cursor ?? '#c45c4a'} />}

            {/* Add scene button */}
            <div
              className="px-4 py-3 cursor-pointer transition-opacity hover:opacity-60"
              style={{ opacity: 0.15 }}
              onClick={onAddScene}
            >
              <span style={{ fontSize: 11, color: palette?.muted ?? '#7a7060' }}>+</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
