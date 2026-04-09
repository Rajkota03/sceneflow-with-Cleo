// ============================================================
// PAGE LAYOUT & STATISTICS ENGINE
// ============================================================
// Computes page breaks, word counts, timing estimates, and
// character statistics directly from the Doc block model.
// Pure functions — no side effects, no classes.

import type { Block } from './model';
import { deriveScenes } from './model';
import { extractCharacters } from './classifier';

// ─── Constants ───

const LINES_PER_PAGE = 55;       // Industry standard screenplay
const DIALOGUE_CHARS_PER_LINE = 35;
const ACTION_CHARS_PER_LINE = 60;

// ─── Line Estimation ───

/**
 * Estimate how many printed lines a block occupies on the page.
 * Matches industry screenplay formatting conventions.
 */
export function estimateBlockLines(block: Block): number {
  const len = block.text.trim().length;

  switch (block.type) {
    case 'character':
      // 1 blank line before + character name
      return 2;
    case 'dialogue':
      return Math.max(1, Math.ceil(len / DIALOGUE_CHARS_PER_LINE));
    case 'parenthetical':
      return 1;
    case 'scene-heading':
      // 2 blank lines before + heading line
      return 3;
    case 'transition':
      // 1 blank line before + transition text
      return 2;
    case 'action':
      // 1 blank line before + wrapped text
      return 1 + Math.max(1, Math.ceil(len / ACTION_CHARS_PER_LINE));
  }
}

// ─── Page Break Types ───

export interface PageBreakInfo {
  blockId: string;
  pageNumber: number;
  contdCharacter?: string; // Character name needing (CONT'D) at top of new page
}

// ─── Page Breaks (simple map) ───

/**
 * Returns a map of blockId → page number for every block that starts a new page.
 * The first page is page 1 and has no entry in the map.
 */
export function computePageBreaks(
  blocks: Block[],
  linesPerPage: number = LINES_PER_PAGE,
): Map<string, number> {
  const breaks = new Map<string, number>();
  let lineCount = 0;
  let page = 1;

  for (const block of blocks) {
    const lines = estimateBlockLines(block);
    lineCount += lines;

    if (lineCount > linesPerPage) {
      page++;
      lineCount = lines;
      breaks.set(block.id, page);
    }
  }

  return breaks;
}

// ─── Page Layout (rich info with CONT'D tracking) ───

/**
 * Compute full page layout with dialogue continuation tracking.
 * Returns an entry for every block that starts a new page.
 */
export function computePageLayout(
  blocks: Block[],
  linesPerPage: number = LINES_PER_PAGE,
): PageBreakInfo[] {
  const layout: PageBreakInfo[] = [];
  let lineCount = 0;
  let page = 1;

  // Track the active character for CONT'D detection.
  // A character is "active" from a character cue through its dialogue/parenthetical.
  let activeCharacter: string | null = null;

  for (const block of blocks) {
    // Track which character is speaking
    if (block.type === 'character') {
      activeCharacter = block.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
    } else if (block.type !== 'dialogue' && block.type !== 'parenthetical') {
      activeCharacter = null;
    }

    const lines = estimateBlockLines(block);
    lineCount += lines;

    if (lineCount > linesPerPage) {
      page++;
      lineCount = lines;

      const info: PageBreakInfo = {
        blockId: block.id,
        pageNumber: page,
      };

      // If we broke in the middle of a dialogue sequence, mark for CONT'D
      if (activeCharacter && (block.type === 'dialogue' || block.type === 'parenthetical')) {
        info.contdCharacter = activeCharacter;
      }

      layout.push(info);
    }
  }

  return layout;
}

// ─── Document Statistics ───

export interface DocStats {
  wordCount: number;
  pageCount: number;
  sceneCount: number;
  characterCount: number;     // unique speaking characters
  dialoguePercentage: number; // % of words that are dialogue
  estimatedMinutes: number;   // 1 page ≈ 1 minute
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Compute aggregate statistics for the entire document.
 */
export function computeStats(blocks: Block[]): DocStats {
  let totalWords = 0;
  let dialogueWords = 0;
  let sceneCount = 0;

  for (const block of blocks) {
    const words = countWords(block.text);
    totalWords += words;

    if (block.type === 'dialogue') {
      dialogueWords += words;
    }
    if (block.type === 'scene-heading') {
      sceneCount++;
    }
  }

  const characters = extractCharacters(blocks);

  // Page count from line estimation
  let totalLines = 0;
  for (const block of blocks) {
    totalLines += estimateBlockLines(block);
  }
  const pageCount = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));

  return {
    wordCount: totalWords,
    pageCount,
    sceneCount,
    characterCount: characters.length,
    dialoguePercentage: totalWords > 0
      ? Math.round((dialogueWords / totalWords) * 100)
      : 0,
    estimatedMinutes: pageCount, // 1 page ≈ 1 minute
  };
}

// ─── Per-Scene Statistics ───

export interface SceneStats {
  sceneHeadingBlockId: string;
  wordCount: number;
  lineCount: number;
  estimatedPages: number;
  characters: string[]; // speaking characters in this scene
}

/**
 * Compute statistics broken down by scene.
 */
export function computeSceneStats(blocks: Block[]): SceneStats[] {
  const scenes = deriveScenes(blocks);

  // Build a quick index so we can grab blocks by position
  return scenes.map((scene) => {
    const sceneBlocks = blocks.slice(scene.startIndex, scene.endIndex + 1);

    let wordCount = 0;
    let lineCount = 0;
    const charNames = new Set<string>();

    for (const block of sceneBlocks) {
      wordCount += countWords(block.text);
      lineCount += estimateBlockLines(block);

      if (block.type === 'character') {
        const name = block.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
        if (name) charNames.add(name);
      }
    }

    return {
      sceneHeadingBlockId: scene.headingBlockId,
      wordCount,
      lineCount,
      estimatedPages: Math.round((lineCount / LINES_PER_PAGE) * 100) / 100,
      characters: Array.from(charNames).sort(),
    };
  });
}
