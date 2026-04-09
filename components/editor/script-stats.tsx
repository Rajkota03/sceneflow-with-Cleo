'use client';

import { useMemo } from 'react';
import type { Doc } from '@/lib/doc';
import { computeStats, computeSceneStats, deriveScenes, extractCharacters } from '@/lib/doc';

interface ScriptStatsProps {
  doc: Doc;
  isOpen: boolean;
  onClose: () => void;
}

interface CharacterInfo {
  name: string;
  dialogueLines: number;
  wordCount: number;
  sceneNumbers: number[];
  percentage: number;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function analyzeCharacters(doc: Doc): CharacterInfo[] {
  const scenes = deriveScenes(doc.blocks);
  const charMap = new Map<string, { dialogueLines: number; wordCount: number; sceneNums: Set<number> }>();
  let totalDialogueWords = 0;

  let currentChar: string | null = null;

  for (const block of doc.blocks) {
    if (block.type === 'character') {
      currentChar = block.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
      if (currentChar && !charMap.has(currentChar)) {
        charMap.set(currentChar, { dialogueLines: 0, wordCount: 0, sceneNums: new Set() });
      }
      // Find which scene this block belongs to
      const blockIdx = doc.blocks.indexOf(block);
      for (let i = 0; i < scenes.length; i++) {
        if (blockIdx >= scenes[i].startIndex && blockIdx <= scenes[i].endIndex) {
          charMap.get(currentChar)?.sceneNums.add(i + 1);
          break;
        }
      }
    } else if (block.type === 'dialogue' && currentChar) {
      const entry = charMap.get(currentChar);
      if (entry) {
        const wc = countWords(block.text);
        entry.dialogueLines++;
        entry.wordCount += wc;
        totalDialogueWords += wc;
      }
    } else if (block.type !== 'parenthetical') {
      currentChar = null;
    }
  }

  return Array.from(charMap.entries())
    .map(([name, data]) => ({
      name,
      dialogueLines: data.dialogueLines,
      wordCount: data.wordCount,
      sceneNumbers: Array.from(data.sceneNums).sort((a, b) => a - b),
      percentage: totalDialogueWords > 0 ? (data.wordCount / totalDialogueWords) * 100 : 0,
    }))
    .sort((a, b) => b.wordCount - a.wordCount);
}

function StatBadge({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="flex flex-col items-center px-3 py-2.5 rounded-lg"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
    >
      <span className="text-sm font-semibold" style={{ color: accent }}>{value}</span>
      <span className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-3)' }}>{label}</span>
    </div>
  );
}

function Bar({ ratio, leftColor, rightColor }: { ratio: number; leftColor: string; rightColor: string }) {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div className="h-2 rounded-full overflow-hidden w-full" style={{ background: rightColor }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: leftColor }} />
    </div>
  );
}

export function ScriptStats({ doc, isOpen, onClose }: ScriptStatsProps) {
  const stats = useMemo(() => computeStats(doc.blocks), [doc.blocks]);
  const sceneStats = useMemo(() => computeSceneStats(doc.blocks), [doc.blocks]);
  const characters = useMemo(() => analyzeCharacters(doc), [doc]);
  const scenes = useMemo(() => deriveScenes(doc.blocks), [doc.blocks]);

  const accent = '#c45c4a';
  const dialogueRatio = stats.wordCount > 0 ? stats.dialoguePercentage / 100 : 0;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(6, 8, 12, 0.5)' }}
          onClick={onClose}
        />
      )}

      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
        style={{
          width: '380px',
          maxWidth: '90vw',
          background: 'var(--color-deep)',
          borderLeft: '1px solid var(--color-border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen ? '-8px 0 30px rgba(0, 0, 0, 0.4)' : 'none',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 className="text-xs font-medium uppercase tracking-widest" style={{ color: accent }}>
            Script Analysis
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-colors"
            style={{ color: 'var(--color-text-3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {doc.blocks.length === 0 ? (
            <p className="text-xs italic text-center py-12" style={{ color: 'var(--color-text-3)' }}>
              No content to analyze. Start writing to see stats.
            </p>
          ) : (
            <>
              {/* Overall Stats */}
              <section>
                <div className="grid grid-cols-4 gap-2">
                  <StatBadge label="Pages" value={String(stats.pageCount)} accent={accent} />
                  <StatBadge label="Scenes" value={String(stats.sceneCount)} accent={accent} />
                  <StatBadge label="Words" value={stats.wordCount.toLocaleString()} accent={accent} />
                  <StatBadge label="Chars" value={String(stats.characterCount)} accent={accent} />
                </div>

                {/* Runtime estimate */}
                <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>Est. Runtime</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: accent }}>
                      ~{stats.estimatedMinutes} min
                    </span>
                  </div>
                  <div className="text-[9px] mt-1" style={{ color: 'var(--color-text-3)', opacity: 0.7 }}>
                    1 page = ~1 minute of screen time
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                    <span style={{ color: 'var(--color-text-3)' }}>Dialogue vs Action</span>
                    <span style={{ color: 'var(--color-text-2)' }}>
                      {stats.dialoguePercentage}% / {100 - stats.dialoguePercentage}%
                    </span>
                  </div>
                  <Bar ratio={dialogueRatio} leftColor={accent} rightColor={`${accent}26`} />
                  <div className="flex justify-between text-[9px]" style={{ color: 'var(--color-text-3)' }}>
                    <span>Dialogue</span>
                    <span>Action</span>
                  </div>
                </div>
              </section>

              {/* Character Breakdown */}
              <section>
                <h3
                  className="text-[10px] font-medium uppercase tracking-widest mb-3 pb-2"
                  style={{ color: 'var(--color-text-2)', borderBottom: '1px solid var(--color-border)' }}
                >
                  Character Breakdown
                </h3>
                {characters.length === 0 ? (
                  <p className="text-xs italic" style={{ color: 'var(--color-text-3)' }}>No character dialogue found.</p>
                ) : (
                  <div className="space-y-3">
                    {characters.map((char) => (
                      <div key={char.name}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                            {char.name}
                          </span>
                          <span className="text-[10px] tabular-nums" style={{ color: accent }}>
                            {char.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <Bar ratio={char.percentage / 100} leftColor={accent} rightColor={`${accent}14`} />
                        <div className="flex gap-3 mt-1 text-[10px]" style={{ color: 'var(--color-text-3)' }}>
                          <span>{char.dialogueLines} line{char.dialogueLines !== 1 ? 's' : ''}</span>
                          <span>{char.wordCount} word{char.wordCount !== 1 ? 's' : ''}</span>
                          <span>Sc {char.sceneNumbers.join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Scene Analysis */}
              <section>
                <h3
                  className="text-[10px] font-medium uppercase tracking-widest mb-3 pb-2"
                  style={{ color: 'var(--color-text-2)', borderBottom: '1px solid var(--color-border)' }}
                >
                  Scene Analysis
                </h3>
                <div className="space-y-2.5">
                  {sceneStats.map((scene, i) => {
                    const heading = scenes[i]
                      ? doc.blocks[scenes[i].startIndex]?.text || 'Untitled Scene'
                      : 'Untitled Scene';
                    const dRatio = scene.wordCount > 0
                      ? (scene.wordCount - scene.characters.length) > 0
                        ? 0.5 // fallback
                        : 0
                      : 0;
                    // Compute actual dialogue ratio for this scene
                    const sceneBlocks = doc.blocks.slice(
                      scenes[i]?.startIndex ?? 0,
                      (scenes[i]?.endIndex ?? 0) + 1
                    );
                    let sceneDialogueWords = 0;
                    for (const b of sceneBlocks) {
                      if (b.type === 'dialogue') {
                        const t = b.text.trim();
                        sceneDialogueWords += t ? t.split(/\s+/).length : 0;
                      }
                    }
                    const actualDRatio = scene.wordCount > 0 ? sceneDialogueWords / scene.wordCount : 0;

                    return (
                      <div
                        key={scene.sceneHeadingBlockId}
                        className="p-3 rounded-lg"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-[10px] font-medium shrink-0" style={{ color: accent }}>
                              {i + 1}
                            </span>
                            <span className="text-xs truncate" style={{ color: 'var(--color-text)' }}>
                              {heading}
                            </span>
                          </div>
                          <span className="text-[10px] shrink-0 tabular-nums" style={{ color: 'var(--color-text-2)' }}>
                            ~{scene.estimatedPages.toFixed(1)} pg
                          </span>
                        </div>
                        <div className="flex gap-3 text-[10px] mb-1.5" style={{ color: 'var(--color-text-3)' }}>
                          <span>{scene.wordCount} words</span>
                          <span>{scene.characters.length} char{scene.characters.length !== 1 ? 's' : ''}</span>
                          <span>{Math.round(actualDRatio * 100)}% dialogue</span>
                        </div>
                        <Bar ratio={actualDRatio} leftColor={`${accent}99`} rightColor={`${accent}1a`} />
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
