// ============================================================
// INCREMENTAL LINE CLASSIFIER
// ============================================================
// Deterministic type classification for screenplay elements.
// Runs on every text change, but respects manual type locks.
// Context-aware: uses previous block type + known characters.

import type { Block, BlockType } from './model';

// ─── Auto-detection patterns (Final Draft compatible) ───

const SCENE_HEADING_RE = /^(INT\.|EXT\.|INT\.\/EXT\.|INT\/EXT\.|I\/E\.)\s/i;
const TRANSITION_EXACT_RE = /^(CUT TO:|FADE OUT\.|FADE IN:|SMASH CUT TO:|MATCH CUT TO:|DISSOLVE TO:|IRIS OUT\.|WIPE TO:)$/i;
const TRANSITION_SUFFIX_RE = /TO:$/;
const PARENTHETICAL_RE = /^\(/;
const ALL_CAPS_RE = /^[A-Z][A-Z\s.'()\-]+$/;

export interface ClassifierContext {
  prevBlock: Block | null;
  knownCharacters: string[];
}

/**
 * Classify a block's type from its text and context.
 * Returns null if the block is locked (manually typed) — caller should keep current type.
 */
export function classify(block: Block, ctx: ClassifierContext): BlockType | null {
  if (block.meta.locked) return null;

  const text = block.text.trim();

  // Empty line: context-dependent
  if (!text) {
    if (ctx.prevBlock?.type === 'character') return 'dialogue';
    return 'action';
  }

  // Scene heading: INT. / EXT. / I/E.
  if (SCENE_HEADING_RE.test(text)) return 'scene-heading';

  // Transition: exact matches or ends with TO:
  if (TRANSITION_EXACT_RE.test(text)) return 'transition';
  if (TRANSITION_SUFFIX_RE.test(text) && text === text.toUpperCase() && text.length < 30) return 'transition';

  // Parenthetical: starts with (
  if (PARENTHETICAL_RE.test(text)) return 'parenthetical';

  // Character cue: all caps, short, not a scene heading
  const isAllCaps = text === text.toUpperCase() && /[A-Z]/.test(text);
  if (isAllCaps && text.length < 40 && !SCENE_HEADING_RE.test(text)) {
    // Extra check: known character name match
    const nameOnly = text.replace(/\s*\(.*\)$/, '').trim();
    const isKnown = ctx.knownCharacters.some(c => c.toUpperCase() === nameOnly.toUpperCase());
    if (isKnown || ALL_CAPS_RE.test(text)) return 'character';
  }

  // After character or parenthetical → dialogue
  if (ctx.prevBlock?.type === 'character' || ctx.prevBlock?.type === 'parenthetical') {
    return 'dialogue';
  }

  return 'action';
}

// ─── Flow Rules ───
// What the next block's type should default to after Enter.

const FLOW_MAP: Record<BlockType, BlockType> = {
  'scene-heading': 'action',
  'action': 'action',
  'character': 'dialogue',
  'parenthetical': 'dialogue',
  'dialogue': 'action',      // Tab switches to character
  'transition': 'scene-heading',
};

export function nextTypeAfter(type: BlockType): BlockType {
  return FLOW_MAP[type] ?? 'action';
}

// ─── Tab Cycling ───
// Context-aware type cycling with Tab key.

const TAB_MAP: Record<BlockType, BlockType> = {
  'action': 'character',
  'character': 'action',
  'dialogue': 'parenthetical',
  'parenthetical': 'dialogue',
  'scene-heading': 'action',
  'transition': 'scene-heading',
};

export function cycleType(type: BlockType): BlockType {
  return TAB_MAP[type] ?? 'action';
}

// ─── Backspace Type Reversal ───
// When backspacing on an empty line, reverse the flow.

const REVERSE_MAP: Record<BlockType, BlockType> = {
  'dialogue': 'character',
  'character': 'action',
  'parenthetical': 'dialogue',
  'transition': 'action',
  'scene-heading': 'action',
  'action': 'action',
};

export function reverseType(type: BlockType): BlockType {
  return REVERSE_MAP[type] ?? 'action';
}

// ─── Character Name Extraction ───
// Extract all unique character names from blocks.

export function extractCharacters(blocks: Block[]): string[] {
  const names = new Set<string>();
  for (const block of blocks) {
    if (block.type === 'character') {
      const name = block.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
      if (name) names.add(name);
    }
  }
  return Array.from(names).sort();
}

// ─── Character Name Matching ───

export function matchCharacters(partial: string, knownCharacters: string[]): string[] {
  const upper = partial.trim().toUpperCase();
  if (!upper) return [];
  return knownCharacters.filter(c => c.toUpperCase().startsWith(upper) && c.toUpperCase() !== upper);
}

// ─── A-B-A Dialogue Pattern ───
// Guess the next character in an alternating dialogue.

export function guessNextCharacter(blocks: Block[], afterIndex: number): string | null {
  const chars: string[] = [];
  for (let i = afterIndex; i >= 0; i--) {
    if (blocks[i].type === 'character') {
      const name = blocks[i].text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
      if (name && (chars.length === 0 || chars[chars.length - 1] !== name)) {
        chars.push(name);
        if (chars.length >= 2) break;
      }
    }
  }
  return chars.length >= 2 ? chars[1] : null;
}

// ─── Batch Classify ───
// Re-classify all unlocked blocks. Used after structural changes (paste, import).

export function classifyAll(blocks: Block[], knownCharacters: string[]): Block[] {
  const result: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const ctx: ClassifierContext = {
      prevBlock: i > 0 ? result[i - 1] : null,
      knownCharacters,
    };
    const newType = classify(block, ctx);
    if (newType !== null && newType !== block.type) {
      result.push({ ...block, type: newType });
    } else {
      result.push(block);
    }
  }
  return result;
}
