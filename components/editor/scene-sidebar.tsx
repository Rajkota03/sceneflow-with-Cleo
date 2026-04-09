'use client';
import { useState, useRef, useCallback } from 'react';
import type { ScreenplayScene } from '@/lib/types';

const SCENE_COLORS = ['#cc5f5f', '#c45c4a', '#5cb88a', '#4d8be8', '#9b7ed8', '#e8884d', '#6dd4a0', '#cc7eb8'];

interface SceneSidebarProps {
  scenes: ScreenplayScene[];
  activeSceneId: string | null;
  palette?: { ink: string; inkFaint: string; muted?: string } | null;
  onSelectScene: (id: string) => void;
  onAddScene: () => void;
  onDeleteScene: (id: string) => void;
  onReorderScenes: (scenes: ScreenplayScene[]) => void;
  onSceneColorChange?: (sceneId: string, color: string | undefined) => void;
  onExport: () => void;
}

function sceneWordCount(scene: ScreenplayScene): number {
  const text = scene.elements.map(e => e.text).join(' ').trim();
  return text ? text.split(/\s+/).length : 0;
}

function sceneTimeEstimate(words: number): string {
  if (words === 0) return '';
  const minutes = words / 250; // 1 page ≈ 1 min screen time
  if (minutes < 1) return `~${Math.round(minutes * 60)}s`;
  return `~${Math.round(minutes * 10) / 10}min`;
}

export function SceneSidebar({
  scenes,
  activeSceneId,
  palette,
  onSelectScene,
  onAddScene,
  onDeleteScene,
  onReorderScenes,
  onSceneColorChange,
  onExport,
}: SceneSidebarProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [colorPickerScene, setColorPickerScene] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteClick = useCallback((e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    if (deleteConfirm === sceneId) {
      // Second click — confirm delete
      onDeleteScene(sceneId);
      setDeleteConfirm(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    } else {
      // First click — show confirmation
      setDeleteConfirm(sceneId);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setDeleteConfirm(null), 3000);
    }
  }, [deleteConfirm, onDeleteScene]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    dragNode.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
    // Make ghost transparent
    requestAnimationFrame(() => {
      if (dragNode.current) dragNode.current.style.opacity = '0.4';
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNode.current) dragNode.current.style.opacity = '1';
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const reordered = [...scenes];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(dragOverIdx, 0, moved);
      onReorderScenes(reordered);
    }
    setDragIdx(null);
    setDragOverIdx(null);
    dragNode.current = null;
  }, [dragIdx, dragOverIdx, scenes, onReorderScenes]);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }, []);

  const totalWords = scenes.reduce((sum, s) => sum + sceneWordCount(s), 0);

  return (
    <aside
      className="shrink-0 flex flex-col h-full"
      style={{ width: 160, borderRight: '1px solid #1e1c17', background: 'transparent', paddingTop: 32 }}
    >
      {/* Scene list — minimal, just numbers and names */}
      <div className="flex-1 overflow-y-auto">
        {scenes.map((scene, i) => {
          const isActive = scene.id === activeSceneId;
          const heading = scene.heading
            ? scene.heading.replace(/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*/i, '').replace(/\s*-\s*.*$/, '').trim()
            : 'Untitled';

          return (
            <div
              key={scene.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnter={(e) => { e.preventDefault(); setDragOverIdx(i); }}
              className="flex flex-col px-4 py-3 cursor-pointer transition-all"
              style={{
                opacity: isActive ? 1 : 0.2,
                transition: 'opacity 0.2s ease',
                borderTop: dragIdx !== null && dragOverIdx === i && dragIdx !== i && dragIdx !== i - 1
                  ? `2px solid ${palette?.ink ?? '#c8bda0'}`
                  : '2px solid transparent',
              }}
              onClick={() => onSelectScene(scene.id)}
            >
              <span style={{ fontSize: 11, color: palette?.muted ?? '#7a7060', fontFamily: 'var(--font-mono)' }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 9, color: palette?.ink ?? '#c8bda0', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                {heading}
              </span>
            </div>
          );
        })}

        {/* Add scene — barely visible, appears on hover */}
        <div
          className="px-4 py-3 cursor-pointer transition-opacity hover:opacity-60"
          style={{ opacity: 0.15 }}
          onClick={onAddScene}
        >
          <span style={{ fontSize: 11, color: palette?.muted ?? '#7a7060' }}>+</span>
        </div>
      </div>
    </aside>
  );
}
