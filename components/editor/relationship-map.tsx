'use client';

import { useMemo } from 'react';
import type { ScreenplayScene } from '@/lib/types';

interface RelationshipMapProps {
  scenes: ScreenplayScene[];
  isOpen: boolean;
  onClose: () => void;
}

const CHAR_COLORS = ['#5cb88a', '#4d8be8', '#c45c4a', '#cc5f5f', '#9b7ed8', '#e88aaf', '#6dd4a0', '#e8c44d'];

interface CharData {
  name: string;
  lineCount: number;
  wordCount: number;
  sceneIds: Set<string>;
  color: string;
}

interface Connection {
  a: string;
  b: string;
  sharedScenes: number;
  dialogueExchanges: number; // times they speak near each other
}

function analyzeScript(scenes: ScreenplayScene[]) {
  const chars = new Map<string, CharData>();
  const connections = new Map<string, Connection>();
  let colorIdx = 0;

  // Pass 1: identify characters and their stats
  for (const scene of scenes) {
    const sceneChars: string[] = [];

    for (let i = 0; i < scene.elements.length; i++) {
      const el = scene.elements[i];
      if (el.type === 'character' && el.text.trim()) {
        const name = el.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
        if (!chars.has(name)) {
          chars.set(name, {
            name,
            lineCount: 0,
            wordCount: 0,
            sceneIds: new Set(),
            color: CHAR_COLORS[colorIdx++ % CHAR_COLORS.length],
          });
        }
        const c = chars.get(name)!;
        c.sceneIds.add(scene.id);
        c.lineCount++;

        // Count dialogue words
        const nextEl = scene.elements[i + 1];
        if (nextEl && (nextEl.type === 'dialogue' || nextEl.type === 'parenthetical')) {
          c.wordCount += nextEl.text.trim().split(/\s+/).filter(Boolean).length;
        }

        sceneChars.push(name);
      }
    }

    // Pass 2: detect dialogue exchanges (characters who speak near each other)
    const speakOrder: string[] = [];
    for (const el of scene.elements) {
      if (el.type === 'character' && el.text.trim()) {
        speakOrder.push(el.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase());
      }
    }
    for (let i = 1; i < speakOrder.length; i++) {
      const a = speakOrder[i - 1];
      const b = speakOrder[i];
      if (a === b) continue;
      const key = [a, b].sort().join('::');
      if (!connections.has(key)) {
        connections.set(key, { a: [a, b].sort()[0], b: [a, b].sort()[1], sharedScenes: 0, dialogueExchanges: 0 });
      }
      connections.get(key)!.dialogueExchanges++;
    }

    // Shared scene connections
    const uniqueInScene = [...new Set(sceneChars)];
    for (let i = 0; i < uniqueInScene.length; i++) {
      for (let j = i + 1; j < uniqueInScene.length; j++) {
        const key = [uniqueInScene[i], uniqueInScene[j]].sort().join('::');
        if (!connections.has(key)) {
          connections.set(key, { a: [uniqueInScene[i], uniqueInScene[j]].sort()[0], b: [uniqueInScene[i], uniqueInScene[j]].sort()[1], sharedScenes: 0, dialogueExchanges: 0 });
        }
        connections.get(key)!.sharedScenes++;
      }
    }
  }

  return { chars: Array.from(chars.values()), connections: Array.from(connections.values()) };
}

// Lay out characters in a circle, sized by importance
function layoutNodes(chars: CharData[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.3;

  return chars.map((c, i) => {
    const angle = (i / chars.length) * Math.PI * 2 - Math.PI / 2;
    return {
      ...c,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });
}

export function RelationshipMap({ scenes, isOpen, onClose }: RelationshipMapProps) {
  const { chars, connections } = useMemo(() => analyzeScript(scenes), [scenes]);

  const W = 700;
  const H = 500;
  const nodes = useMemo(() => layoutNodes(chars, W, H), [chars]);

  if (!isOpen) return null;

  if (chars.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--color-void)' }}>
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-deep)' }}>
          <h2 className="text-sm font-medium uppercase tracking-widest" style={{ color: '#c45c4a' }}>Character Web</h2>
          <button onClick={onClose} className="px-4 py-1.5 text-xs uppercase tracking-wider rounded-md cursor-pointer" style={{ backgroundColor: 'rgba(196, 92, 74, 0.08)', color: '#c45c4a', border: '1px solid rgba(196, 92, 74, 0.15)' }}>
            Back to Editor
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm italic" style={{ color: 'var(--color-text-3)' }}>
            No characters found yet. Add dialogue to your scenes to see the character web.
          </p>
        </div>
      </div>
    );
  }

  const maxExchanges = Math.max(1, ...connections.map(c => c.dialogueExchanges));
  const maxLines = Math.max(1, ...chars.map(c => c.lineCount));

  // Node lookup for connections
  const nodeMap = new Map(nodes.map(n => [n.name, n]));

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--color-void)' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-deep)' }}>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium uppercase tracking-widest" style={{ color: '#c45c4a' }}>Character Web</h2>
          <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>
            {chars.length} character{chars.length !== 1 ? 's' : ''} &middot; {connections.length} connection{connections.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={onClose} className="px-4 py-1.5 text-xs uppercase tracking-wider rounded-md cursor-pointer transition-all hover:opacity-90" style={{ backgroundColor: 'rgba(196, 92, 74, 0.08)', color: '#c45c4a', border: '1px solid rgba(196, 92, 74, 0.15)' }}>
          Back to Editor
        </button>
      </div>

      {/* Map area */}
      <div className="flex-1 flex overflow-hidden">
        {/* SVG web */}
        <div className="flex-1 flex items-center justify-center p-8">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ maxWidth: W, maxHeight: H }}>
            {/* Connection lines */}
            {connections.map((conn) => {
              const from = nodeMap.get(conn.a);
              const to = nodeMap.get(conn.b);
              if (!from || !to) return null;
              const thickness = 1 + (conn.dialogueExchanges / maxExchanges) * 4;
              const opacity = 0.15 + (conn.dialogueExchanges / maxExchanges) * 0.5;
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2 - 8;

              return (
                <g key={`${conn.a}::${conn.b}`}>
                  <line
                    x1={from.x} y1={from.y}
                    x2={to.x} y2={to.y}
                    stroke={from.color}
                    strokeWidth={thickness}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                  />
                  {/* Label on line */}
                  <text
                    x={midX} y={midY}
                    textAnchor="middle"
                    fill="var(--color-text-3)"
                    fontSize="9"
                    fontFamily="var(--font-sans)"
                  >
                    {conn.sharedScenes} scene{conn.sharedScenes !== 1 ? 's' : ''} &middot; {conn.dialogueExchanges} exchange{conn.dialogueExchanges !== 1 ? 's' : ''}
                  </text>
                </g>
              );
            })}

            {/* Character nodes */}
            {nodes.map((node) => {
              const size = 20 + (node.lineCount / maxLines) * 20;
              return (
                <g key={node.name}>
                  {/* Glow */}
                  <circle
                    cx={node.x} cy={node.y} r={size + 8}
                    fill={node.color}
                    opacity={0.06}
                  />
                  {/* Node circle */}
                  <circle
                    cx={node.x} cy={node.y} r={size}
                    fill="var(--color-surface-2)"
                    stroke={node.color}
                    strokeWidth={2}
                    className="transition-all"
                  />
                  {/* Initial */}
                  <text
                    x={node.x} y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={node.color}
                    fontSize={size * 0.7}
                    fontWeight="700"
                    fontFamily="var(--font-sans)"
                  >
                    {node.name[0]}
                  </text>
                  {/* Name label */}
                  <text
                    x={node.x} y={node.y + size + 16}
                    textAnchor="middle"
                    fill="var(--color-text)"
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="var(--font-sans)"
                    letterSpacing="0.05em"
                  >
                    {node.name}
                  </text>
                  {/* Stats under name */}
                  <text
                    x={node.x} y={node.y + size + 28}
                    textAnchor="middle"
                    fill="var(--color-text-3)"
                    fontSize="9"
                    fontFamily="var(--font-sans)"
                  >
                    {node.lineCount} line{node.lineCount !== 1 ? 's' : ''} &middot; {node.wordCount} words
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stats sidebar */}
        <div className="w-64 shrink-0 border-l overflow-y-auto p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-deep)' }}>
          <h3 className="text-[10px] uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-3)' }}>Characters</h3>
          {chars.sort((a, b) => b.lineCount - a.lineCount).map((c) => (
            <div key={c.name} className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>{c.name}</span>
              </div>
              <div className="text-[10px] pl-4" style={{ color: 'var(--color-text-3)' }}>
                {c.lineCount} line{c.lineCount !== 1 ? 's' : ''} &middot; {c.wordCount} words &middot; {c.sceneIds.size} scene{c.sceneIds.size !== 1 ? 's' : ''}
              </div>
              {/* Dialogue bar */}
              <div className="mt-1 ml-4 h-1 rounded-full" style={{ backgroundColor: 'var(--color-surface-3)', width: '100%' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(c.lineCount / maxLines) * 100}%`, backgroundColor: c.color, opacity: 0.7 }} />
              </div>
            </div>
          ))}

          {connections.length > 0 && (
            <>
              <h3 className="text-[10px] uppercase tracking-widest mt-6 mb-4" style={{ color: 'var(--color-text-3)' }}>Connections</h3>
              {connections.sort((a, b) => b.dialogueExchanges - a.dialogueExchanges).map((conn) => (
                <div key={`${conn.a}::${conn.b}`} className="mb-3 text-[10px]" style={{ color: 'var(--color-text-2)' }}>
                  <span style={{ color: nodeMap.get(conn.a)?.color }}>{conn.a}</span>
                  <span style={{ color: 'var(--color-text-3)' }}> &harr; </span>
                  <span style={{ color: nodeMap.get(conn.b)?.color }}>{conn.b}</span>
                  <div className="pl-2 mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                    {conn.sharedScenes} shared scene{conn.sharedScenes !== 1 ? 's' : ''}, {conn.dialogueExchanges} dialogue exchange{conn.dialogueExchanges !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
