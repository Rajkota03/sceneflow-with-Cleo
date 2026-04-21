'use client';
// Story Spine — the shape of a screenplay, at a glance.
// Each scene is a bar. Width = pages. Height = tension. Color = emotional temperature.
// Click to jump. Act dividers live underneath — derived from cumulative pages.

import { useMemo, useState } from 'react';
import type { Doc, Block } from '@/lib/doc';
import { deriveScenes, computeSceneStats } from '@/lib/doc';
import type { EditorPalette } from './theme-picker';

interface StorySpineProps {
  doc: Doc;
  activeSceneId: string | null;
  onSelectScene: (sceneHeadingBlockId: string) => void;
  palette: EditorPalette | null;
}

type Temperature = 'cool' | 'warm' | 'tense' | 'climax';

interface SpineBar {
  id: string;
  sceneNumber: number;
  heading: string;
  shortHeading: string;
  pages: number;
  tension: number;        // 0..1
  temperature: Temperature;
  timeOfDay: 'day' | 'night' | 'dusk' | 'dawn' | 'unspecified';
  interior: 'int' | 'ext' | 'both' | 'unspecified';
  characters: string[];
  wordCount: number;
}

// ── Temperature palette ──
const TEMP_COLORS: Record<Temperature, string> = {
  cool:   '#6888cc',
  warm:   '#7a9a6a',
  tense:  '#d4a24a',
  climax: '#c45c4a',
};

// ── Heuristics ──

function parseHeading(heading: string) {
  const upper = heading.toUpperCase().trim();
  let interior: SpineBar['interior'] = 'unspecified';
  if (upper.startsWith('INT./EXT.') || upper.startsWith('I/E.') || upper.startsWith('INT/EXT')) interior = 'both';
  else if (upper.startsWith('INT.')) interior = 'int';
  else if (upper.startsWith('EXT.')) interior = 'ext';

  // Time of day is usually the last `- DAY` / `- NIGHT` / etc segment
  let timeOfDay: SpineBar['timeOfDay'] = 'unspecified';
  if (/\b(NIGHT|EVENING|MIDNIGHT|LATE NIGHT)\b/.test(upper)) timeOfDay = 'night';
  else if (/\b(DAY|MORNING|NOON|AFTERNOON)\b/.test(upper)) timeOfDay = 'day';
  else if (/\b(DUSK|SUNSET|TWILIGHT)\b/.test(upper)) timeOfDay = 'dusk';
  else if (/\b(DAWN|SUNRISE)\b/.test(upper)) timeOfDay = 'dawn';

  return { interior, timeOfDay };
}

// Tension is a crude but fair proxy: conflict markers + punctuation intensity + dialogue density
function computeTension(sceneBlocks: Block[]): { tension: number; dialogueRatio: number } {
  let dialogueWords = 0;
  let totalWords = 0;
  let conflictHits = 0;
  let intensityHits = 0;
  let lineCount = 0;

  const CONFLICT = /\b(no|don't|can't|won't|never|stop|please|wait|shut up|get out|leave|enough|fuck|shit|fight|kill|die|run|help)\b/gi;
  const INTENSITY = /[!?]/g;

  for (const b of sceneBlocks) {
    if (b.type === 'scene-heading') continue;
    const words = b.text.trim().split(/\s+/).filter(Boolean).length;
    totalWords += words;
    lineCount++;
    if (b.type === 'dialogue') dialogueWords += words;
    conflictHits += (b.text.match(CONFLICT) || []).length;
    intensityHits += (b.text.match(INTENSITY) || []).length;
  }

  const dialogueRatio = totalWords > 0 ? dialogueWords / totalWords : 0;

  if (totalWords === 0) return { tension: 0.2, dialogueRatio: 0 };

  // Normalize each signal to 0..1, weight, combine
  const conflictDensity = Math.min(1, (conflictHits / Math.max(1, lineCount)) * 1.6);
  const intensityDensity = Math.min(1, (intensityHits / Math.max(1, lineCount)) * 0.8);
  // Dialogue alone isn't tension, but pure-action very-short scenes often are
  const actionHeat = dialogueRatio < 0.15 && totalWords > 20 ? 0.35 : 0;

  const tension = Math.min(1, 0.15 + conflictDensity * 0.5 + intensityDensity * 0.35 + actionHeat);
  return { tension, dialogueRatio };
}

function classifyTemperature(
  timeOfDay: SpineBar['timeOfDay'],
  tension: number,
): Temperature {
  if (tension >= 0.78) return 'climax';
  if (tension >= 0.55) return 'tense';
  if (timeOfDay === 'night' || timeOfDay === 'dusk') return 'cool';
  return 'warm';
}

function shortenHeading(h: string): string {
  // "INT. LIAM'S APARTMENT — KITCHEN — NIGHT" → "LIAM'S APARTMENT — KITCHEN"
  const cleaned = h
    .replace(/^(INT\.?\/EXT\.?|I\/E\.?|INT\.|EXT\.)\s*/i, '')
    .replace(/\s*[-—]\s*(DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS|LATER|SAME)\b.*$/i, '')
    .trim();
  return cleaned || h;
}

// ── Component ──

export function StorySpine({ doc, activeSceneId, onSelectScene, palette }: StorySpineProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const bars = useMemo<SpineBar[]>(() => {
    const scenes = deriveScenes(doc.blocks);
    const stats = computeSceneStats(doc.blocks);
    const statsById = new Map(stats.map(s => [s.sceneHeadingBlockId, s]));

    return scenes.map((scene, i) => {
      const sceneBlocks = doc.blocks.slice(scene.startIndex, scene.endIndex + 1);
      const { tension } = computeTension(sceneBlocks);
      const { interior, timeOfDay } = parseHeading(scene.heading);
      const temperature = classifyTemperature(timeOfDay, tension);
      const st = statsById.get(scene.headingBlockId);
      return {
        id: scene.headingBlockId,
        sceneNumber: i + 1,
        heading: scene.heading,
        shortHeading: shortenHeading(scene.heading),
        pages: st?.estimatedPages ?? 0.5,
        tension,
        temperature,
        timeOfDay,
        interior,
        characters: st?.characters ?? [],
        wordCount: st?.wordCount ?? 0,
      };
    });
  }, [doc.blocks]);

  // Act dividers: position at 25% and 75% of cumulative pages.
  // Prefer scene boundaries closest to those ratios so dividers fall between bars.
  const actBreaks = useMemo(() => {
    if (bars.length < 2) return [] as Array<{ x: number; label: string }>;
    const totalPages = bars.reduce((a, b) => a + b.pages, 0);
    if (totalPages === 0) return [];
    let cum = 0;
    let act1Idx = -1, act2Idx = -1;
    for (let i = 0; i < bars.length; i++) {
      cum += bars[i].pages;
      const ratio = cum / totalPages;
      if (act1Idx === -1 && ratio >= 0.25) act1Idx = i;
      if (act2Idx === -1 && ratio >= 0.75) act2Idx = i;
    }
    // Positions are expressed as the summed width fraction *at the end of* that scene
    const breaks: Array<{ x: number; label: string }> = [];
    if (act1Idx > 0) {
      const x = bars.slice(0, act1Idx + 1).reduce((a, b) => a + b.pages, 0) / totalPages;
      breaks.push({ x, label: 'II' });
    }
    if (act2Idx > 0 && act2Idx !== act1Idx) {
      const x = bars.slice(0, act2Idx + 1).reduce((a, b) => a + b.pages, 0) / totalPages;
      breaks.push({ x, label: 'III' });
    }
    return breaks;
  }, [bars]);

  const totalPages = bars.reduce((a, b) => a + b.pages, 0);
  const activeBar = hoveredIdx !== null ? bars[hoveredIdx] : bars.find(b => b.id === activeSceneId);

  // ── Render ──

  const bg = palette?.headerBg ?? '#17160f';
  const border = palette?.border ?? 'rgba(200,189,160,0.10)';
  const muted = palette?.muted ?? '#7a7060';
  const ink = palette?.ink ?? '#c8bda0';
  const accent = palette?.cursor ?? '#c45c4a';

  if (bars.length === 0) {
    return (
      <div style={{
        height: 64, background: bg, borderTop: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: muted, fontSize: 11, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
      }}>
        STORY SPINE · start writing to see the shape
      </div>
    );
  }

  return (
    <div
      style={{
        height: 84, background: bg, borderTop: `1px solid ${border}`,
        padding: '10px 16px 12px', flexShrink: 0, position: 'relative',
        userSelect: 'none',
      }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Header row — title + live scene info + legend */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 8, gap: 14, minHeight: 14,
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0, flex: 1,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: accent,
            letterSpacing: '0.2em', fontWeight: 600, flexShrink: 0,
          }}>
            STORY SPINE
          </span>
          {activeBar && (
            <span style={{
              fontSize: 11, color: ink, opacity: 0.72,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
            }}>
              <span style={{ color: accent, fontWeight: 600 }}>
                {String(activeBar.sceneNumber).padStart(2, '0')}.
              </span>{' '}
              {activeBar.shortHeading}
              <span style={{ color: muted }}> · {activeBar.pages.toFixed(1)}pg · tension {(activeBar.tension * 100).toFixed(0)}%</span>
            </span>
          )}
        </div>

        <div style={{
          display: 'flex', gap: 10, flexShrink: 0,
          fontFamily: 'var(--font-mono)', fontSize: 9, color: muted, letterSpacing: '0.06em',
        }}>
          {(['cool', 'warm', 'tense', 'climax'] as Temperature[]).map(t => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 7, height: 7, borderRadius: 1,
                background: TEMP_COLORS[t],
              }} />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Bars + act dividers */}
      <div style={{
        height: 40, display: 'flex', gap: 2, alignItems: 'flex-end',
        position: 'relative',
      }}>
        {bars.map((bar, i) => {
          const isActive = bar.id === activeSceneId;
          const heightPct = 22 + bar.tension * 72;
          const weight = Math.max(0.4, bar.pages);
          const baseOpacity = 0.58 + bar.tension * 0.3;
          const isHovered = hoveredIdx === i;
          return (
            <button
              key={bar.id}
              onClick={() => onSelectScene(bar.id)}
              onMouseEnter={() => setHoveredIdx(i)}
              title={`${bar.sceneNumber}. ${bar.shortHeading}`}
              style={{
                flex: weight, minWidth: 4,
                height: `${heightPct}%`,
                background: TEMP_COLORS[bar.temperature],
                opacity: isActive || isHovered ? 1 : baseOpacity,
                border: 'none', padding: 0, cursor: 'pointer',
                borderRadius: '1px 1px 0 0',
                outline: isActive ? `1px solid ${ink}` : 'none',
                outlineOffset: 1,
                transition: 'opacity 0.12s, transform 0.12s',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                position: 'relative',
                zIndex: isActive ? 2 : isHovered ? 3 : 1,
              }}
            />
          );
        })}

        {/* Act dividers */}
        {actBreaks.map((brk, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', top: -4, bottom: -2,
              left: `${brk.x * 100}%`,
              width: 1, background: 'rgba(200,189,160,0.26)',
              pointerEvents: 'none',
            }}
          >
            <div style={{
              position: 'absolute', top: -14, left: 6,
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500,
              color: muted, letterSpacing: '0.15em',
              whiteSpace: 'nowrap',
            }}>
              ACT {brk.label}
            </div>
          </div>
        ))}

        {/* Act I label at the very start */}
        {bars.length >= 3 && (
          <div style={{
            position: 'absolute', top: -14, left: 2,
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500,
            color: muted, letterSpacing: '0.15em',
          }}>
            ACT I
          </div>
        )}
      </div>

      {/* Page markers — tiny subtle marks every ~15 pages */}
      {totalPages >= 20 && (
        <div style={{
          position: 'absolute', bottom: 2, left: 16, right: 16,
          height: 8, pointerEvents: 'none',
          fontFamily: 'var(--font-mono)', fontSize: 8, color: muted,
          opacity: 0.5,
        }}>
          <span style={{ position: 'absolute', left: 0 }}>1</span>
          <span style={{ position: 'absolute', right: 0 }}>{Math.round(totalPages)}</span>
        </div>
      )}
    </div>
  );
}
