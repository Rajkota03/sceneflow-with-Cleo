// ============================================================
// FOUNTAIN FORMAT IMPORTER
// ============================================================
// Parses .fountain plain-text screenplay format into a Doc.
// Spec reference: https://fountain.io/syntax

import type { Doc, Block, BlockType, TitlePageData, BlockMeta } from './model';
import { createBlock, blockId } from './model';

// Scene heading prefixes (case-insensitive)
const SCENE_HEADING_RE = /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*/i;

// Character cue: all uppercase, may end with (V.O.), (O.S.), (CONT'D), etc.
const CHARACTER_EXTENSIONS_RE = /\s*\((V\.O\.|O\.S\.|CONT'D|O\.C\.)\)\s*$/i;

// Transition: ends with TO: (case-insensitive)
const TRANSITION_RE = /\bTO:$/;

// Script notes: [[...]]
const NOTE_RE = /\[\[([^\]]*)\]\]/g;

// Title page key: value
const TITLE_KEY_RE = /^([A-Za-z\s]+?):\s*(.*)$/;

function isAllUppercase(line: string): boolean {
  const stripped = line.replace(CHARACTER_EXTENSIONS_RE, '').replace(/^@/, '').trim();
  if (!stripped) return false;
  // Must have at least one letter, and no lowercase letters
  return /[A-Z]/.test(stripped) && !/[a-z]/.test(stripped);
}

function extractNotes(text: string): { clean: string; note: string | undefined } {
  const notes: string[] = [];
  const clean = text.replace(NOTE_RE, (_match, content: string) => {
    notes.push(content.trim());
    return '';
  }).trim();
  return { clean, note: notes.length > 0 ? notes.join('; ') : undefined };
}

function parseTitlePage(lines: string[]): { titlePage: TitlePageData | undefined; consumed: number } {
  // Title page is key:value pairs at the start before the first blank line
  // If the very first line isn't a key:value pair, there's no title page
  if (lines.length === 0 || !TITLE_KEY_RE.test(lines[0])) {
    return { titlePage: undefined, consumed: 0 };
  }

  const data: Record<string, string> = {};
  let i = 0;
  let currentKey = '';

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') break; // blank line ends title page

    const match = line.match(TITLE_KEY_RE);
    if (match) {
      currentKey = match[1].trim().toLowerCase();
      data[currentKey] = match[2].trim();
    } else if (currentKey) {
      // Continuation line for multi-line values
      data[currentKey] = (data[currentKey] ? data[currentKey] + '\n' : '') + line.trim();
    }
  }

  if (Object.keys(data).length === 0) {
    return { titlePage: undefined, consumed: 0 };
  }

  const titlePage: TitlePageData = {
    title: data['title'] || '',
    credit: data['credit'] || '',
    author: data['author'] || data['authors'] || '',
    source: data['source'] || '',
    draftDate: data['draft date'] || '',
    contact: data['contact'] || '',
  };

  // consumed = i (index of blank line) + 1 to skip the blank line itself
  return { titlePage, consumed: i < lines.length ? i + 1 : i };
}

type ParseState = 'none' | 'character' | 'parenthetical' | 'dialogue';

export function parseFountain(text: string): Doc {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Parse title page
  const { titlePage, consumed } = parseTitlePage(rawLines);
  const lines = rawLines.slice(consumed);

  const blocks: Block[] = [];
  let state: ParseState = 'none';
  let actionBuffer: string[] = [];

  function flushAction() {
    if (actionBuffer.length === 0) return;
    const joined = actionBuffer.join('\n').trim();
    if (joined) {
      const { clean, note } = extractNotes(joined);
      if (clean) {
        const meta: Partial<BlockMeta> = {};
        if (note) meta.note = note;
        blocks.push(createBlock('action', clean, meta));
      }
    }
    actionBuffer = [];
  }

  function pushBlock(type: BlockType, text: string, meta?: Partial<BlockMeta>) {
    const { clean, note } = extractNotes(text);
    const merged: Partial<BlockMeta> = { ...meta };
    if (note) merged.note = note;
    blocks.push(createBlock(type, clean, merged));
  }

  // Look ahead to check if line at index is followed by a non-empty line
  function hasNonEmptyFollower(index: number): boolean {
    for (let j = index + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (next === '') return false;
      return true;
    }
    return false;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Page break — skip
    if (trimmed === '===') {
      flushAction();
      state = 'none';
      continue;
    }

    // Blank line — element separator
    if (trimmed === '') {
      flushAction();
      state = 'none';
      continue;
    }

    // In dialogue state: parenthetical or dialogue continuation
    if (state === 'character' || state === 'parenthetical' || state === 'dialogue') {
      // Parenthetical: line wrapped in ()
      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        pushBlock('parenthetical', trimmed);
        state = 'parenthetical';
        continue;
      }
      // Dialogue line
      pushBlock('dialogue', trimmed);
      state = 'dialogue';
      continue;
    }

    // Forced scene heading: leading .
    if (trimmed.startsWith('.') && !trimmed.startsWith('..')) {
      flushAction();
      const heading = trimmed.slice(1).trim();
      pushBlock('scene-heading', heading);
      state = 'none';
      continue;
    }

    // Scene heading by prefix
    if (SCENE_HEADING_RE.test(trimmed)) {
      flushAction();
      pushBlock('scene-heading', trimmed);
      state = 'none';
      continue;
    }

    // Forced transition: leading >
    if (trimmed.startsWith('>') && !trimmed.endsWith('<')) {
      flushAction();
      pushBlock('transition', trimmed.slice(1).trim());
      state = 'none';
      continue;
    }

    // Transition: ends with TO:
    if (TRANSITION_RE.test(trimmed) && isAllUppercase(trimmed)) {
      flushAction();
      pushBlock('transition', trimmed);
      state = 'none';
      continue;
    }

    // Forced action: leading !
    if (trimmed.startsWith('!')) {
      flushAction();
      pushBlock('action', trimmed.slice(1).trim());
      state = 'none';
      continue;
    }

    // Forced character: leading @
    if (trimmed.startsWith('@')) {
      flushAction();
      const name = trimmed.slice(1).trim();
      if (hasNonEmptyFollower(i)) {
        pushBlock('character', name);
        state = 'character';
      } else {
        pushBlock('action', name);
        state = 'none';
      }
      continue;
    }

    // Character cue: ALL UPPERCASE followed by non-empty line
    if (isAllUppercase(trimmed) && hasNonEmptyFollower(i)) {
      flushAction();
      pushBlock('character', trimmed);
      state = 'character';
      continue;
    }

    // Default: action (buffer consecutive lines into one block)
    actionBuffer.push(trimmed);
  }

  // Flush remaining action buffer
  flushAction();

  // If no blocks were parsed, create a default
  if (blocks.length === 0) {
    blocks.push(createBlock('scene-heading', 'INT. UNTITLED - DAY'));
    blocks.push(createBlock('action', ''));
  }

  const title = titlePage?.title || 'Imported Screenplay';
  const cursorBlock = blocks[blocks.length - 1];

  return {
    id: `doc_${Date.now()}`,
    title,
    titlePage,
    blocks,
    cursor: { position: { blockId: cursorBlock.id, offset: 0 }, selection: null },
    version: 0,
  };
}
