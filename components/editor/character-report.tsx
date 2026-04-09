'use client';

import { useMemo, useState, useRef } from 'react';
import type { Doc, Block, DerivedScene } from '@/lib/doc';
import { deriveScenes } from '@/lib/doc';

interface CharacterReportProps {
  doc: Doc;
  isOpen: boolean;
  onClose: () => void;
  onRenameCharacter?: (oldName: string, newName: string) => void;
}

// ─── Extension parsing ───

interface ExtensionCounts {
  vo: number;
  os: number;
  contd: number;
  other: number;
}

function parseExtension(charText: string): { name: string; ext: string | null } {
  const match = charText.trim().match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { name: charText.trim().toUpperCase(), ext: null };
  return { name: match[1].trim().toUpperCase(), ext: match[2].trim().toUpperCase() };
}

// ─── Deep character analysis ───

interface CharacterDetail {
  name: string;
  dialogueLines: number;
  wordCount: number;
  percentage: number;
  firstScene: number;    // 1-indexed scene number
  lastScene: number;
  scenePresence: Set<number>;    // 1-indexed scene numbers where they speak
  sceneMention: Set<number>;     // scenes where name appears in action
  extensions: ExtensionCounts;
}

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function analyzeCharactersDeep(doc: Doc): { characters: CharacterDetail[]; scenes: DerivedScene[]; totalDialogueWords: number } {
  const scenes = deriveScenes(doc.blocks);
  const charMap = new Map<string, CharacterDetail>();
  let totalDialogueWords = 0;

  // Helper to get or create a character entry
  function getChar(name: string): CharacterDetail {
    if (!charMap.has(name)) {
      charMap.set(name, {
        name,
        dialogueLines: 0,
        wordCount: 0,
        percentage: 0,
        firstScene: Infinity,
        lastScene: 0,
        scenePresence: new Set(),
        sceneMention: new Set(),
        extensions: { vo: 0, os: 0, contd: 0, other: 0 },
      });
    }
    return charMap.get(name)!;
  }

  // Find which scene a block index belongs to (1-indexed)
  function sceneNumberForIndex(blockIdx: number): number {
    for (let i = 0; i < scenes.length; i++) {
      if (blockIdx >= scenes[i].startIndex && blockIdx <= scenes[i].endIndex) {
        return i + 1;
      }
    }
    return 0;
  }

  let currentChar: string | null = null;

  for (let bi = 0; bi < doc.blocks.length; bi++) {
    const block = doc.blocks[bi];
    const sceneNum = sceneNumberForIndex(bi);

    if (block.type === 'character') {
      const { name, ext } = parseExtension(block.text);
      currentChar = name;
      const entry = getChar(name);

      if (sceneNum > 0) {
        entry.scenePresence.add(sceneNum);
        entry.firstScene = Math.min(entry.firstScene, sceneNum);
        entry.lastScene = Math.max(entry.lastScene, sceneNum);
      }

      // Track extensions
      if (ext) {
        const upper = ext.replace(/[.']/g, '');
        if (upper === 'VO' || upper === 'V O') entry.extensions.vo++;
        else if (upper === 'OS' || upper === 'O S' || upper === 'OC' || upper === 'O C') entry.extensions.os++;
        else if (upper === 'CONTD' || upper === "CONT'D" || upper === 'CONT') entry.extensions.contd++;
        else entry.extensions.other++;
      }
    } else if (block.type === 'dialogue' && currentChar) {
      const entry = getChar(currentChar);
      const wc = countWords(block.text);
      entry.dialogueLines++;
      entry.wordCount += wc;
      totalDialogueWords += wc;
    } else if (block.type === 'parenthetical') {
      // Keep currentChar alive through parentheticals
    } else {
      // Scan action blocks for character name mentions
      if (block.type === 'action' && sceneNum > 0) {
        const upper = block.text.toUpperCase();
        for (const [name, entry] of charMap) {
          if (upper.includes(name)) {
            entry.sceneMention.add(sceneNum);
          }
        }
      }
      currentChar = null;
    }
  }

  // Compute percentages
  const characters = Array.from(charMap.values())
    .map(c => ({
      ...c,
      percentage: totalDialogueWords > 0 ? (c.wordCount / totalDialogueWords) * 100 : 0,
      firstScene: c.firstScene === Infinity ? 0 : c.firstScene,
    }))
    .sort((a, b) => b.wordCount - a.wordCount);

  return { characters, scenes, totalDialogueWords };
}

// ─── Components ───

function ExtBadge({ label, count }: { label: string; count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium tabular-nums"
      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}
    >
      {label} {count}
    </span>
  );
}

function PresenceGrid({ character, totalScenes, accent }: { character: CharacterDetail; totalScenes: number; accent: string }) {
  if (totalScenes === 0) return null;

  // Determine cell size based on scene count
  const cellSize = totalScenes > 40 ? 6 : totalScenes > 20 ? 8 : 10;
  const gap = totalScenes > 40 ? 1 : 2;

  return (
    <div className="flex flex-wrap" style={{ gap }}>
      {Array.from({ length: totalScenes }, (_, i) => {
        const sceneNum = i + 1;
        const speaks = character.scenePresence.has(sceneNum);
        const mentioned = character.sceneMention.has(sceneNum);

        let bg: string;
        let border: string;
        if (speaks) {
          bg = accent;
          border = accent;
        } else if (mentioned) {
          bg = `${accent}40`;
          border = `${accent}60`;
        } else {
          bg = 'var(--color-surface-2)';
          border = 'var(--color-border)';
        }

        return (
          <div
            key={sceneNum}
            title={`Scene ${sceneNum}${speaks ? ' (dialogue)' : mentioned ? ' (mentioned)' : ''}`}
            style={{
              width: cellSize,
              height: cellSize,
              borderRadius: 2,
              background: bg,
              border: `1px solid ${border}`,
              cursor: 'default',
            }}
          />
        );
      })}
    </div>
  );
}

function ScenePresenceMatrix({
  characters,
  scenes,
  doc,
  accent,
}: {
  characters: CharacterDetail[];
  scenes: DerivedScene[];
  doc: Doc;
  accent: string;
}) {
  const totalScenes = scenes.length;
  if (totalScenes === 0 || characters.length === 0) return null;

  // Limit to top 15 characters for readability
  const topChars = characters.slice(0, 15);

  // Compute cell sizing
  const cellSize = totalScenes > 40 ? 8 : totalScenes > 20 ? 10 : 12;
  const gap = 1;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 'max-content' }}>
        {/* Column headers (scene numbers) */}
        <div className="flex items-end mb-1" style={{ paddingLeft: 80 }}>
          {scenes.map((_, i) => (
            <div
              key={i}
              className="text-center shrink-0"
              style={{
                width: cellSize,
                marginRight: gap,
                fontSize: totalScenes > 30 ? 0 : 8,
                color: 'var(--color-text-3)',
                lineHeight: 1,
              }}
            >
              {totalScenes <= 30 ? i + 1 : ''}
            </div>
          ))}
        </div>

        {/* Rows */}
        {topChars.map(char => (
          <div key={char.name} className="flex items-center mb-px">
            {/* Character name */}
            <div
              className="shrink-0 text-[10px] truncate pr-2 text-right"
              style={{ width: 80, color: 'var(--color-text-2)' }}
              title={char.name}
            >
              {char.name}
            </div>

            {/* Cells */}
            {scenes.map((_, si) => {
              const sceneNum = si + 1;
              const speaks = char.scenePresence.has(sceneNum);
              const mentioned = char.sceneMention.has(sceneNum);

              let bg: string;
              if (speaks) bg = accent;
              else if (mentioned) bg = `${accent}30`;
              else bg = 'var(--color-surface-2)';

              return (
                <div
                  key={si}
                  title={`${char.name} - Scene ${sceneNum}${speaks ? ' (dialogue)' : mentioned ? ' (mentioned)' : ''}`}
                  className="shrink-0"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    marginRight: gap,
                    borderRadius: 2,
                    background: bg,
                    cursor: 'default',
                  }}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-2" style={{ paddingLeft: 80 }}>
          <div className="flex items-center gap-1">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: accent }} />
            <span className="text-[9px]" style={{ color: 'var(--color-text-3)' }}>Dialogue</span>
          </div>
          <div className="flex items-center gap-1">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: `${accent}30` }} />
            <span className="text-[9px]" style={{ color: 'var(--color-text-3)' }}>Mentioned</span>
          </div>
          <div className="flex items-center gap-1">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-surface-2)' }} />
            <span className="text-[9px]" style={{ color: 'var(--color-text-3)' }}>Absent</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CharacterCard({
  character,
  scenes,
  doc,
  accent,
  isExpanded,
  onToggle,
  onRename,
}: {
  character: CharacterDetail;
  scenes: DerivedScene[];
  doc: Doc;
  accent: string;
  isExpanded: boolean;
  onToggle: () => void;
  onRename?: (oldName: string, newName: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const totalScenes = scenes.length;

  const firstHeading = character.firstScene > 0 && scenes[character.firstScene - 1]
    ? doc.blocks[scenes[character.firstScene - 1].startIndex]?.text || 'Untitled'
    : '--';
  const lastHeading = character.lastScene > 0 && scenes[character.lastScene - 1]
    ? doc.blocks[scenes[character.lastScene - 1].startIndex]?.text || 'Untitled'
    : '--';

  const sceneCount = character.scenePresence.size;
  const { vo, os, contd } = character.extensions;
  const hasExtensions = vo > 0 || os > 0 || contd > 0;

  function startRename() {
    setRenameValue(character.name);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }

  function confirmRename() {
    const cleaned = renameValue.trim().toUpperCase();
    if (cleaned && cleaned !== character.name && onRename) {
      onRename(character.name, cleaned);
    }
    setIsRenaming(false);
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Header — always visible, clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left cursor-pointer transition-colors"
        style={{ background: isExpanded ? 'var(--color-surface-2)' : 'transparent' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
            {character.name}
          </span>
          <span className="text-[10px] tabular-nums shrink-0" style={{ color: accent }}>
            {character.percentage.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-3)' }}>
            {character.wordCount} words
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            style={{
              color: 'var(--color-text-3)',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <path d="M2 3.5l3 3 3-3" />
          </svg>
        </div>
      </button>

      {/* Dialogue bar */}
      <div className="px-3 pb-1">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${accent}14` }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, character.percentage)}%`, background: accent, transition: 'width 0.3s' }}
          />
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-2.5">
          {/* Stats row + Rename */}
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: 'var(--color-text-3)' }}>
              <span>{character.dialogueLines} line{character.dialogueLines !== 1 ? 's' : ''}</span>
              <span>{sceneCount} scene{sceneCount !== 1 ? 's' : ''}</span>
              <span>{character.wordCount} word{character.wordCount !== 1 ? 's' : ''}</span>
            </div>
            {onRename && !isRenaming && (
              <button
                onClick={(e) => { e.stopPropagation(); startRename(); }}
                className="text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors"
                style={{
                  color: accent,
                  background: `${accent}18`,
                  border: `1px solid ${accent}30`,
                }}
              >
                Rename
              </button>
            )}
          </div>

          {/* Inline rename input */}
          {isRenaming && (
            <div className="flex items-center gap-2">
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
                className="flex-1 text-xs px-2 py-1 rounded outline-none"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontFamily: 'inherit',
                }}
                placeholder="New character name"
              />
              <button
                onClick={confirmRename}
                className="text-[10px] px-2 py-1 rounded cursor-pointer"
                style={{ background: accent, color: '#fff' }}
              >
                Apply
              </button>
              <button
                onClick={() => setIsRenaming(false)}
                className="text-[10px] px-2 py-1 rounded cursor-pointer"
                style={{ color: 'var(--color-text-3)' }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* First / Last appearance */}
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <span className="text-[9px] uppercase tracking-wider shrink-0 pt-0.5" style={{ color: 'var(--color-text-3)', width: 36 }}>First</span>
              <span className="text-[10px] leading-tight" style={{ color: 'var(--color-text-2)' }}>
                Sc {character.firstScene} &mdash; {firstHeading}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] uppercase tracking-wider shrink-0 pt-0.5" style={{ color: 'var(--color-text-3)', width: 36 }}>Last</span>
              <span className="text-[10px] leading-tight" style={{ color: 'var(--color-text-2)' }}>
                Sc {character.lastScene} &mdash; {lastHeading}
              </span>
            </div>
          </div>

          {/* Extensions */}
          {hasExtensions && (
            <div className="flex flex-wrap gap-1">
              <ExtBadge label="V.O." count={vo} />
              <ExtBadge label="O.S." count={os} />
              <ExtBadge label="CONT'D" count={contd} />
            </div>
          )}

          {/* Scene presence grid */}
          {totalScenes > 0 && (
            <div>
              <span className="text-[9px] uppercase tracking-wider block mb-1" style={{ color: 'var(--color-text-3)' }}>
                Scene Presence
              </span>
              <PresenceGrid character={character} totalScenes={totalScenes} accent={accent} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───

export function CharacterReport({ doc, isOpen, onClose, onRenameCharacter }: CharacterReportProps) {
  const { characters, scenes, totalDialogueWords } = useMemo(
    () => analyzeCharactersDeep(doc),
    [doc]
  );
  const [expandedChar, setExpandedChar] = useState<string | null>(null);
  const accent = '#c45c4a';

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(6, 8, 12, 0.5)' }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
        style={{
          width: '420px',
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
            Character Report
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
          {characters.length === 0 ? (
            <p className="text-xs italic text-center py-12" style={{ color: 'var(--color-text-3)' }}>
              No characters found. Add character cues and dialogue to see the report.
            </p>
          ) : (
            <>
              {/* Summary badges */}
              <section>
                <div className="grid grid-cols-3 gap-2">
                  <SummaryBadge label="Characters" value={String(characters.length)} accent={accent} />
                  <SummaryBadge label="Scenes" value={String(scenes.length)} accent={accent} />
                  <SummaryBadge label="Dialogue Words" value={totalDialogueWords.toLocaleString()} accent={accent} />
                </div>
              </section>

              {/* Scene Presence Matrix — the killer feature */}
              <section>
                <h3
                  className="text-[10px] font-medium uppercase tracking-widest mb-3 pb-2"
                  style={{ color: 'var(--color-text-2)', borderBottom: '1px solid var(--color-border)' }}
                >
                  Scene Presence Matrix
                </h3>
                <ScenePresenceMatrix
                  characters={characters}
                  scenes={scenes}
                  doc={doc}
                  accent={accent}
                />
              </section>

              {/* Individual character cards */}
              <section>
                <h3
                  className="text-[10px] font-medium uppercase tracking-widest mb-3 pb-2"
                  style={{ color: 'var(--color-text-2)', borderBottom: '1px solid var(--color-border)' }}
                >
                  Character Details
                </h3>
                <div className="space-y-2">
                  {characters.map(char => (
                    <CharacterCard
                      key={char.name}
                      character={char}
                      scenes={scenes}
                      doc={doc}
                      accent={accent}
                      isExpanded={expandedChar === char.name}
                      onToggle={() => setExpandedChar(expandedChar === char.name ? null : char.name)}
                      onRename={onRenameCharacter}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryBadge({ label, value, accent }: { label: string; value: string; accent: string }) {
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
