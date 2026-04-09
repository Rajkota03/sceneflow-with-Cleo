'use client';
import { useState, useMemo } from 'react';
import type { ScreenplayScene } from '@/lib/types';

interface CharacterFilterProps {
  scenes: ScreenplayScene[];
  characters: string[];
  palette?: { ink: string; inkFaint: string; muted?: string; cursor?: string; paper?: string; desk?: string; border?: string } | null;
  onClose: () => void;
}

interface DialogueLine {
  sceneHeading: string;
  sceneIdx: number;
  text: string;
  parenthetical?: string;
}

export function CharacterFilter({ scenes, characters, palette, onClose }: CharacterFilterProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const ink = palette?.ink ?? '#c8bda0';
  const faint = palette?.inkFaint ?? '#4a4535';
  const muted = palette?.muted ?? '#7a7060';
  const accent = palette?.cursor ?? '#c45c4a';
  const bg = palette?.paper ?? '#17160f';
  const border = palette?.border ?? 'rgba(200,189,160,0.06)';

  // Build dialogue map for selected character
  const dialogueLines = useMemo<DialogueLine[]>(() => {
    if (!selected) return [];
    const lines: DialogueLine[] = [];
    const upperName = selected.toUpperCase();

    for (let si = 0; si < scenes.length; si++) {
      const scene = scenes[si];
      const els = scene.elements;
      for (let ei = 0; ei < els.length; ei++) {
        const el = els[ei];
        if (el.type === 'character') {
          const charName = el.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
          if (charName === upperName) {
            // Collect dialogue + parentheticals after this character cue
            let parenthetical: string | undefined;
            for (let di = ei + 1; di < els.length; di++) {
              const next = els[di];
              if (next.type === 'parenthetical') {
                parenthetical = next.text;
              } else if (next.type === 'dialogue') {
                lines.push({
                  sceneHeading: scene.heading || `Scene ${si + 1}`,
                  sceneIdx: si,
                  text: next.text,
                  parenthetical,
                });
                parenthetical = undefined;
              } else {
                break;
              }
            }
          }
        }
      }
    }
    return lines;
  }, [selected, scenes]);

  // Count lines per character for the list
  const charCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of characters) counts[c.toUpperCase()] = 0;
    for (const scene of scenes) {
      for (const el of scene.elements) {
        if (el.type === 'dialogue') {
          // Find owning character
          const idx = scene.elements.indexOf(el);
          for (let i = idx - 1; i >= 0; i--) {
            if (scene.elements[i].type === 'character') {
              const name = scene.elements[i].text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
              if (name in counts) counts[name]++;
              break;
            }
            if (scene.elements[i].type !== 'parenthetical') break;
          }
        }
      }
    }
    return counts;
  }, [characters, scenes]);

  const sortedChars = [...characters].sort((a, b) => (charCounts[b.toUpperCase()] || 0) - (charCounts[a.toUpperCase()] || 0));

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 320, zIndex: 30,
      background: bg, borderLeft: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 30px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 9, color: muted, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>
          {selected ? `${selected}'s Dialogue` : 'Characters'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected && (
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 9, color: faint, padding: '2px 4px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = accent; }}
              onMouseLeave={e => { e.currentTarget.style.color = faint; }}
            >
              &larr; Back
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 16, color: faint, padding: 0, lineHeight: 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = accent; }}
            onMouseLeave={e => { e.currentTarget.style.color = faint; }}
          >
            &times;
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {!selected ? (
          // Character list
          sortedChars.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 11, color: faint }}>
              No characters found. Write some dialogue first.
            </div>
          ) : (
            sortedChars.map(name => {
              const count = charCounts[name.toUpperCase()] || 0;
              return (
                <button
                  key={name}
                  onClick={() => setSelected(name.toUpperCase())}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '8px 16px', cursor: 'pointer',
                    background: 'none', border: 'none', textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,92,74,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 12, color: ink, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {name}
                  </span>
                  <span style={{ fontSize: 9, color: faint, fontFamily: 'var(--font-mono)' }}>
                    {count} {count === 1 ? 'line' : 'lines'}
                  </span>
                </button>
              );
            })
          )
        ) : (
          // Dialogue list for selected character
          dialogueLines.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 11, color: faint }}>
              No dialogue found for {selected}.
            </div>
          ) : (
            dialogueLines.map((line, i) => {
              const prevHeading = i > 0 ? dialogueLines[i - 1].sceneHeading : null;
              const showHeading = line.sceneHeading !== prevHeading;
              return (
                <div key={i} style={{ padding: '0 16px' }}>
                  {showHeading && (
                    <div style={{
                      fontSize: 8, color: muted, textTransform: 'uppercase',
                      letterSpacing: '0.1em', padding: '12px 0 4px',
                      borderTop: i > 0 ? `1px solid ${border}` : 'none',
                      fontWeight: 600,
                    }}>
                      {line.sceneHeading}
                    </div>
                  )}
                  {line.parenthetical && (
                    <div style={{
                      fontSize: 10, color: faint, fontStyle: 'italic',
                      padding: '2px 0 0',
                    }}>
                      {line.parenthetical}
                    </div>
                  )}
                  <div style={{
                    fontSize: 12, color: ink, lineHeight: 1.5,
                    padding: '3px 0 6px',
                    fontFamily: 'var(--font-screenplay), "Courier New", Courier, monospace',
                  }}>
                    {line.text}
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Footer stats */}
      {selected && dialogueLines.length > 0 && (
        <div style={{
          padding: '8px 16px', borderTop: `1px solid ${border}`,
          fontSize: 9, color: faint, fontFamily: 'var(--font-mono)',
        }}>
          {dialogueLines.length} lines &middot; {dialogueLines.reduce((sum, l) => sum + l.text.split(/\s+/).length, 0)} words
        </div>
      )}
    </div>
  );
}
