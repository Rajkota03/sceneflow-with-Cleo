// ============================================================
// SCENEFLOW DOCUMENT ENGINE — COMPREHENSIVE TEST SUITE
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createBlock, createDoc, blockId, deriveScenes, buildIndex,
  type Doc, type Block, type BlockType,
} from '../model';
import { applyOp, applyOps, invertOp } from '../operations';
import {
  TransactionBuilder, createHistory, commit, undo, redo, commitWithCoalesce,
} from '../transaction';
import {
  classify, nextTypeAfter, cycleType, reverseType,
  extractCharacters, matchCharacters, guessNextCharacter, classifyAll,
} from '../classifier';
import { resolveIntent, keyToIntent } from '../intent';
import { screenplayToDoc, docToScreenplay } from '../bridge';
import { parseFdxToDoc, docToFdx } from '../fdx';
import { estimateBlockLines, computePageBreaks, computePageLayout, computeStats, computeSceneStats } from '../layout';
import type { Screenplay, ScreenplayScene, ScreenplayElement } from '../../types';

// ─── Model Tests ───

describe('Document Model', () => {
  it('createBlock generates unique IDs', () => {
    const a = createBlock('action', 'hello');
    const b = createBlock('action', 'world');
    expect(a.id).not.toBe(b.id);
    expect(a.type).toBe('action');
    expect(a.text).toBe('hello');
  });

  it('createDoc creates valid doc with heading + action', () => {
    const doc = createDoc('Test Script');
    expect(doc.title).toBe('Test Script');
    expect(doc.blocks.length).toBe(2);
    expect(doc.blocks[0].type).toBe('scene-heading');
    expect(doc.blocks[1].type).toBe('action');
    expect(doc.version).toBe(0);
  });

  it('deriveScenes groups blocks by scene-heading', () => {
    const blocks: Block[] = [
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      createBlock('action', 'John enters.'),
      createBlock('character', 'JOHN'),
      createBlock('dialogue', 'Hello there.'),
      createBlock('scene-heading', 'EXT. PARK - NIGHT'),
      createBlock('action', 'It is raining.'),
    ];
    const scenes = deriveScenes(blocks);
    expect(scenes.length).toBe(2);
    expect(scenes[0].heading).toBe('INT. OFFICE - DAY');
    expect(scenes[0].blockIds.length).toBe(4);
    expect(scenes[0].startIndex).toBe(0);
    expect(scenes[0].endIndex).toBe(3);
    expect(scenes[1].heading).toBe('EXT. PARK - NIGHT');
    expect(scenes[1].blockIds.length).toBe(2);
    expect(scenes[1].startIndex).toBe(4);
    expect(scenes[1].endIndex).toBe(5);
  });

  it('deriveScenes handles orphan blocks before first heading', () => {
    const blocks: Block[] = [
      createBlock('action', 'Orphan action.'),
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      createBlock('action', 'Normal action.'),
    ];
    const scenes = deriveScenes(blocks);
    expect(scenes.length).toBe(2);
    expect(scenes[0].headingBlockId).toBe('');
    expect(scenes[0].blockIds.length).toBe(1);
  });

  it('buildIndex creates fast lookups', () => {
    const blocks = [createBlock('action', 'a'), createBlock('dialogue', 'b')];
    const idx = buildIndex(blocks);
    expect(idx.byId.get(blocks[0].id)?.text).toBe('a');
    expect(idx.indexOf.get(blocks[1].id)).toBe(1);
  });
});

// ─── Operations Tests ───

describe('Operations', () => {
  const makeDoc = (): Doc => {
    const b1 = createBlock('action', 'Hello world');
    const b2 = createBlock('dialogue', 'Goodbye');
    return {
      id: 'test', title: 'Test', blocks: [b1, b2],
      cursor: { position: { blockId: b1.id, offset: 0 }, selection: null },
      version: 0,
    };
  };

  it('insert_text inserts at offset', () => {
    const doc = makeDoc();
    const result = applyOp(doc, { op: 'insert_text', blockId: doc.blocks[0].id, offset: 5, text: ' beautiful' });
    expect(result.blocks[0].text).toBe('Hello beautiful world');
  });

  it('delete_text removes characters', () => {
    const doc = makeDoc();
    const result = applyOp(doc, { op: 'delete_text', blockId: doc.blocks[0].id, offset: 5, length: 6 });
    expect(result.blocks[0].text).toBe('Hello');
  });

  it('split_block splits into two', () => {
    const doc = makeDoc();
    const newId = blockId();
    const result = applyOp(doc, { op: 'split_block', blockId: doc.blocks[0].id, offset: 5, newBlockId: newId, newType: 'action' });
    expect(result.blocks.length).toBe(3);
    expect(result.blocks[0].text).toBe('Hello');
    expect(result.blocks[1].text).toBe(' world');
    expect(result.blocks[1].id).toBe(newId);
  });

  it('merge_blocks combines two blocks', () => {
    const doc = makeDoc();
    const result = applyOp(doc, { op: 'merge_blocks', targetId: doc.blocks[0].id, sourceId: doc.blocks[1].id });
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0].text).toBe('Hello worldGoodbye');
  });

  it('set_type changes block type', () => {
    const doc = makeDoc();
    const result = applyOp(doc, { op: 'set_type', blockId: doc.blocks[0].id, blockType: 'character', lock: true });
    expect(result.blocks[0].type).toBe('character');
    expect(result.blocks[0].meta.locked).toBe(true);
  });

  it('insert_block adds a new block', () => {
    const doc = makeDoc();
    const newBlock = createBlock('transition', 'CUT TO:');
    const result = applyOp(doc, { op: 'insert_block', afterId: doc.blocks[0].id, block: newBlock });
    expect(result.blocks.length).toBe(3);
    expect(result.blocks[1].type).toBe('transition');
  });

  it('remove_block deletes a block', () => {
    const doc = makeDoc();
    const result = applyOp(doc, { op: 'remove_block', blockId: doc.blocks[1].id });
    expect(result.blocks.length).toBe(1);
  });

  it('move_block repositions a block', () => {
    const doc = makeDoc();
    const result = applyOp(doc, { op: 'move_block', blockId: doc.blocks[1].id, afterId: null });
    expect(result.blocks[0].type).toBe('dialogue');
    expect(result.blocks[1].type).toBe('action');
  });

  it('set_meta updates metadata', () => {
    const doc = makeDoc();
    const result = applyOp(doc, { op: 'set_meta', blockId: doc.blocks[0].id, key: 'bookmark', value: 'Important' });
    expect(result.blocks[0].meta.bookmark).toBe('Important');
  });

  it('invertOp: insert_text <-> delete_text', () => {
    const doc = makeDoc();
    const op = { op: 'insert_text' as const, blockId: doc.blocks[0].id, offset: 5, text: 'XX' };
    const inv = invertOp(doc, op);
    expect(inv).toEqual({ op: 'delete_text', blockId: doc.blocks[0].id, offset: 5, length: 2 });
  });

  it('invertOp: split_block <-> merge_blocks', () => {
    const doc = makeDoc();
    const newId = blockId();
    const op = { op: 'split_block' as const, blockId: doc.blocks[0].id, offset: 5, newBlockId: newId, newType: 'action' as const };
    const inv = invertOp(doc, op);
    expect(inv?.op).toBe('merge_blocks');
  });
});

// ─── Transaction Tests ───

describe('Transactions', () => {
  it('commit pushes to undo stack and clears redo', () => {
    const doc = createDoc();
    let history = createHistory(doc);

    const builder = new TransactionBuilder(history.doc, 'test');
    builder.push({ op: 'set_text', blockId: doc.blocks[1].id, text: 'New text' });
    history = commit(history, builder);

    expect(history.undoStack.length).toBe(1);
    expect(history.doc.blocks[1].text).toBe('New text');
    expect(history.doc.version).toBe(1);
  });

  it('undo reverses last transaction', () => {
    const doc = createDoc();
    let history = createHistory(doc);
    const origText = doc.blocks[1].text;

    const builder = new TransactionBuilder(history.doc, 'test');
    builder.push({ op: 'set_text', blockId: doc.blocks[1].id, text: 'Changed' });
    history = commit(history, builder);
    expect(history.doc.blocks[1].text).toBe('Changed');

    const undone = undo(history);
    expect(undone).not.toBeNull();
    expect(undone!.doc.blocks[1].text).toBe(origText);
    expect(undone!.undoStack.length).toBe(0);
    expect(undone!.redoStack.length).toBe(1);
  });

  it('redo re-applies undone transaction', () => {
    const doc = createDoc();
    let history = createHistory(doc);

    const builder = new TransactionBuilder(history.doc, 'test');
    builder.push({ op: 'set_text', blockId: doc.blocks[1].id, text: 'Changed' });
    history = commit(history, builder);

    history = undo(history)!;
    history = redo(history)!;
    expect(history.doc.blocks[1].text).toBe('Changed');
    expect(history.undoStack.length).toBe(1);
    expect(history.redoStack.length).toBe(0);
  });

  it('multiple undo/redo cycles work correctly', () => {
    const doc = createDoc();
    let history = createHistory(doc);
    const blockId = doc.blocks[1].id;

    // Make 3 changes
    for (const text of ['One', 'Two', 'Three']) {
      const builder = new TransactionBuilder(history.doc, text);
      builder.push({ op: 'set_text', blockId, text });
      history = commit(history, builder);
    }
    expect(history.doc.blocks[1].text).toBe('Three');
    expect(history.undoStack.length).toBe(3);

    // Undo 2
    history = undo(history)!;
    history = undo(history)!;
    expect(history.doc.blocks[1].text).toBe('One');

    // Redo 1
    history = redo(history)!;
    expect(history.doc.blocks[1].text).toBe('Two');
  });
});

// ─── Classifier Tests ───

describe('Classifier', () => {
  it('detects scene headings', () => {
    const block = createBlock('action', 'INT. OFFICE - DAY');
    const result = classify(block, { prevBlock: null, knownCharacters: [] });
    expect(result).toBe('scene-heading');
  });

  it('detects EXT. scene headings', () => {
    const block = createBlock('action', 'EXT. PARK - NIGHT');
    const result = classify(block, { prevBlock: null, knownCharacters: [] });
    expect(result).toBe('scene-heading');
  });

  it('detects transitions', () => {
    const block = createBlock('action', 'CUT TO:');
    const result = classify(block, { prevBlock: null, knownCharacters: [] });
    expect(result).toBe('transition');
  });

  it('detects FADE OUT.', () => {
    const block = createBlock('action', 'FADE OUT.');
    const result = classify(block, { prevBlock: null, knownCharacters: [] });
    expect(result).toBe('transition');
  });

  it('detects parentheticals', () => {
    const block = createBlock('action', '(whispering)');
    const result = classify(block, { prevBlock: null, knownCharacters: [] });
    expect(result).toBe('parenthetical');
  });

  it('detects character cues (all caps)', () => {
    const block = createBlock('action', 'JOHN');
    const result = classify(block, { prevBlock: null, knownCharacters: ['JOHN'] });
    expect(result).toBe('character');
  });

  it('detects dialogue after character', () => {
    const charBlock = createBlock('character', 'JOHN');
    const block = createBlock('action', 'Hello there, how are you?');
    const result = classify(block, { prevBlock: charBlock, knownCharacters: [] });
    expect(result).toBe('dialogue');
  });

  it('respects locked blocks', () => {
    const block = createBlock('action', 'JOHN');
    block.meta.locked = true;
    const result = classify(block, { prevBlock: null, knownCharacters: ['JOHN'] });
    expect(result).toBeNull();
  });

  it('empty line after character → dialogue', () => {
    const charBlock = createBlock('character', 'SARAH');
    const block = createBlock('action', '');
    const result = classify(block, { prevBlock: charBlock, knownCharacters: [] });
    expect(result).toBe('dialogue');
  });

  it('nextTypeAfter follows flow rules', () => {
    expect(nextTypeAfter('scene-heading')).toBe('action');
    expect(nextTypeAfter('action')).toBe('action');
    expect(nextTypeAfter('character')).toBe('dialogue');
    expect(nextTypeAfter('dialogue')).toBe('action');
    expect(nextTypeAfter('parenthetical')).toBe('dialogue');
    expect(nextTypeAfter('transition')).toBe('scene-heading');
  });

  it('cycleType follows Tab cycling', () => {
    expect(cycleType('action')).toBe('character');
    expect(cycleType('character')).toBe('action');
    expect(cycleType('dialogue')).toBe('parenthetical');
    expect(cycleType('parenthetical')).toBe('dialogue');
  });

  it('reverseType follows Backspace reversal', () => {
    expect(reverseType('dialogue')).toBe('character');
    expect(reverseType('character')).toBe('action');
    expect(reverseType('parenthetical')).toBe('dialogue');
  });

  it('extractCharacters finds unique names', () => {
    const blocks = [
      createBlock('character', 'JOHN'),
      createBlock('dialogue', 'Hello'),
      createBlock('character', 'SARAH'),
      createBlock('dialogue', 'Hi'),
      createBlock('character', 'JOHN (V.O.)'),
    ];
    const chars = extractCharacters(blocks);
    expect(chars).toContain('JOHN');
    expect(chars).toContain('SARAH');
    expect(chars.length).toBe(2); // JOHN appears twice but unique
  });

  it('matchCharacters filters by prefix', () => {
    const matches = matchCharacters('JO', ['JOHN', 'SARAH', 'JOE']);
    expect(matches).toContain('JOHN');
    expect(matches).toContain('JOE');
    expect(matches).not.toContain('SARAH');
  });

  it('guessNextCharacter detects A-B-A pattern', () => {
    const blocks = [
      createBlock('character', 'JOHN'),
      createBlock('dialogue', 'Hello'),
      createBlock('character', 'SARAH'),
      createBlock('dialogue', 'Hi'),
    ];
    const guess = guessNextCharacter(blocks, 3);
    expect(guess).toBe('JOHN');
  });

  it('classifyAll re-classifies unlocked blocks', () => {
    const blocks = [
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      createBlock('action', 'JOHN'),  // should become character
      createBlock('action', 'Hello there'),  // should become dialogue (after character)
    ];
    const result = classifyAll(blocks, ['JOHN']);
    expect(result[1].type).toBe('character');
    expect(result[2].type).toBe('dialogue');
  });
});

// ─── Intent Engine Tests ───

describe('Intent Engine', () => {
  it('keyToIntent maps Enter to split_block', () => {
    const intent = keyToIntent(
      { key: 'Enter', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
      'block1', 5, 'action'
    );
    expect(intent).toEqual({ intent: 'split_block', blockId: 'block1', offset: 5 });
  });

  it('keyToIntent maps Tab to cycle_type', () => {
    const intent = keyToIntent(
      { key: 'Tab', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
      'block1', 0, 'action'
    );
    expect(intent).toEqual({ intent: 'cycle_type', blockId: 'block1' });
  });

  it('keyToIntent maps Cmd+Z to undo', () => {
    const intent = keyToIntent(
      { key: 'z', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false },
      'block1', 0, 'action'
    );
    expect(intent).toEqual({ intent: 'undo' });
  });

  it('keyToIntent maps Cmd+Shift+Z to redo', () => {
    const intent = keyToIntent(
      { key: 'z', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false },
      'block1', 0, 'action'
    );
    expect(intent).toEqual({ intent: 'redo' });
  });

  it('keyToIntent maps Cmd+3 to force character type', () => {
    const intent = keyToIntent(
      { key: '3', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false },
      'block1', 0, 'action'
    );
    expect(intent).toEqual({ intent: 'force_type', blockId: 'block1', type: 'character' });
  });

  it('keyToIntent maps Backspace at offset 0', () => {
    const intent = keyToIntent(
      { key: 'Backspace', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
      'block1', 0, 'action'
    );
    expect(intent).toEqual({ intent: 'delete_backward', blockId: 'block1', offset: 0 });
  });

  it('keyToIntent returns null for regular typing', () => {
    const intent = keyToIntent(
      { key: 'a', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
      'block1', 5, 'action'
    );
    expect(intent).toBeNull();
  });

  it('resolveIntent: split_block on empty action → character', () => {
    const doc = createDoc();
    // Set the action block to empty
    doc.blocks[1] = { ...doc.blocks[1], text: '' };
    const builder = resolveIntent(doc, { intent: 'split_block', blockId: doc.blocks[1].id, offset: 0 }, []);
    expect(builder).not.toBeNull();
    const ops = builder!.getOps();
    // Should set type to character (Final Draft behavior)
    const setTypeOp = ops.find(o => o.op === 'set_type');
    expect(setTypeOp).toBeDefined();
    if (setTypeOp && setTypeOp.op === 'set_type') {
      expect(setTypeOp.blockType).toBe('character');
    }
  });

  it('resolveIntent: cycle_type action→character', () => {
    const doc = createDoc();
    const builder = resolveIntent(doc, { intent: 'cycle_type', blockId: doc.blocks[1].id }, []);
    expect(builder).not.toBeNull();
    const ops = builder!.getOps();
    const setTypeOp = ops.find(o => o.op === 'set_type');
    expect(setTypeOp).toBeDefined();
    if (setTypeOp && setTypeOp.op === 'set_type') {
      expect(setTypeOp.blockType).toBe('character');
    }
  });

  it('resolveIntent: delete_backward on empty reverses type', () => {
    const doc = createDoc();
    doc.blocks[1] = { ...doc.blocks[1], text: '', type: 'character' };
    const builder = resolveIntent(doc, { intent: 'delete_backward', blockId: doc.blocks[1].id, offset: 0 }, []);
    const ops = builder!.getOps();
    const setTypeOp = ops.find(o => o.op === 'set_type');
    expect(setTypeOp).toBeDefined();
    if (setTypeOp && setTypeOp.op === 'set_type') {
      expect(setTypeOp.blockType).toBe('action'); // character → action
    }
  });

  it('resolveIntent: paste_multiline creates new blocks', () => {
    const doc = createDoc();
    const builder = resolveIntent(doc, {
      intent: 'paste_multiline',
      blockId: doc.blocks[1].id,
      offset: 0,
      lines: ['Line one', 'Line two', 'Line three'],
    }, []);
    expect(builder).not.toBeNull();
    const ops = builder!.getOps();
    const insertOps = ops.filter(o => o.op === 'insert_block');
    expect(insertOps.length).toBe(2); // 2 new blocks (first line merges with existing)
  });
});

// ─── Bridge Tests ───

describe('Bridge (Screenplay ↔ Doc)', () => {
  const makeSp = (): Screenplay => ({
    sessionId: 'test-session',
    title: 'Test Script',
    scenes: [
      {
        id: 'scene1',
        heading: 'INT. OFFICE - DAY',
        elements: [
          { id: 'el1', type: 'action', text: 'John enters the room.' },
          { id: 'el2', type: 'character', text: 'JOHN' },
          { id: 'el3', type: 'dialogue', text: 'Hello everyone.' },
        ],
      },
      {
        id: 'scene2',
        heading: 'EXT. PARK - NIGHT',
        elements: [
          { id: 'el4', type: 'action', text: 'Rain falls.' },
          { id: 'el5', type: 'transition', text: 'FADE OUT.' },
        ],
      },
    ],
    createdAt: 1000,
    updatedAt: 2000,
  });

  it('screenplayToDoc converts correctly', () => {
    const doc = screenplayToDoc(makeSp());
    expect(doc.title).toBe('Test Script');
    expect(doc.blocks.length).toBe(7); // 2 headings + 5 elements
    expect(doc.blocks[0].type).toBe('scene-heading');
    expect(doc.blocks[0].text).toBe('INT. OFFICE - DAY');
    expect(doc.blocks[1].type).toBe('action');
    expect(doc.blocks[2].type).toBe('character');
    expect(doc.blocks[3].type).toBe('dialogue');
    expect(doc.blocks[4].type).toBe('scene-heading');
    expect(doc.blocks[5].type).toBe('action');
    expect(doc.blocks[6].type).toBe('transition');
  });

  it('docToScreenplay converts back correctly', () => {
    const doc = screenplayToDoc(makeSp());
    const sp = docToScreenplay(doc);
    expect(sp.scenes.length).toBe(2);
    expect(sp.scenes[0].heading).toBe('INT. OFFICE - DAY');
    expect(sp.scenes[0].elements.length).toBe(3);
    expect(sp.scenes[0].elements[0].type).toBe('action');
    expect(sp.scenes[0].elements[1].type).toBe('character');
    expect(sp.scenes[0].elements[2].type).toBe('dialogue');
    expect(sp.scenes[1].heading).toBe('EXT. PARK - NIGHT');
    expect(sp.scenes[1].elements.length).toBe(2);
  });

  it('round-trip preserves content', () => {
    const original = makeSp();
    const doc = screenplayToDoc(original);
    const roundTripped = docToScreenplay(doc, original.sessionId);

    expect(roundTripped.scenes.length).toBe(original.scenes.length);
    for (let i = 0; i < original.scenes.length; i++) {
      expect(roundTripped.scenes[i].heading).toBe(original.scenes[i].heading);
      expect(roundTripped.scenes[i].elements.length).toBe(original.scenes[i].elements.length);
      for (let j = 0; j < original.scenes[i].elements.length; j++) {
        expect(roundTripped.scenes[i].elements[j].type).toBe(original.scenes[i].elements[j].type);
        expect(roundTripped.scenes[i].elements[j].text).toBe(original.scenes[i].elements[j].text);
      }
    }
  });
});

// ─── FDX Tests ───

describe('FDX Import/Export', () => {
  it('docToFdx generates valid XML', () => {
    const doc = createDoc('Test');
    doc.blocks[0].text = 'INT. OFFICE - DAY';
    doc.blocks[1].text = 'John enters.';
    const xml = docToFdx(doc);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('FinalDraft');
    expect(xml).toContain('Scene Heading');
    expect(xml).toContain('INT. OFFICE - DAY');
    expect(xml).toContain('Action');
    expect(xml).toContain('John enters.');
  });

  it('docToFdx escapes XML entities', () => {
    const doc = createDoc('Test');
    doc.blocks[1].text = 'John says "hello" & waves <goodbye>';
    const xml = docToFdx(doc);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
  });

  it.skipIf(typeof globalThis.DOMParser === 'undefined')('parseFdxToDoc round-trips with docToFdx', () => {
    const doc = createDoc('Round Trip Test');
    doc.blocks = [
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      createBlock('action', 'John enters.'),
      createBlock('character', 'JOHN'),
      createBlock('dialogue', 'Hello.'),
      createBlock('transition', 'CUT TO:'),
    ];
    const xml = docToFdx(doc);
    const parsed = parseFdxToDoc(xml);
    expect(parsed.title).toBe('Round Trip Test');
    expect(parsed.blocks.length).toBe(5);
    expect(parsed.blocks[0].type).toBe('scene-heading');
    expect(parsed.blocks[1].type).toBe('action');
    expect(parsed.blocks[2].type).toBe('character');
    expect(parsed.blocks[3].type).toBe('dialogue');
    expect(parsed.blocks[4].type).toBe('transition');
  });
});

// ─── Layout Tests ───

describe('Layout Engine', () => {
  it('estimateBlockLines returns correct values', () => {
    expect(estimateBlockLines(createBlock('scene-heading', 'INT. OFFICE'))).toBe(3);
    expect(estimateBlockLines(createBlock('character', 'JOHN'))).toBe(2);
    expect(estimateBlockLines(createBlock('parenthetical', '(whispering)'))).toBe(1);
    expect(estimateBlockLines(createBlock('dialogue', 'Short line'))).toBe(1);
    expect(estimateBlockLines(createBlock('transition', 'CUT TO:'))).toBe(2);
  });

  it('estimateBlockLines wraps long dialogue', () => {
    const longDialogue = createBlock('dialogue', 'A'.repeat(100));
    expect(estimateBlockLines(longDialogue)).toBe(3); // ceil(100/35) = 3
  });

  it('computePageBreaks identifies page boundaries', () => {
    // Create enough blocks to fill more than one page
    const blocks: Block[] = [];
    for (let i = 0; i < 30; i++) {
      blocks.push(createBlock('action', 'This is a line of action that takes up space on the page for testing.'));
    }
    const breaks = computePageBreaks(blocks);
    expect(breaks.size).toBeGreaterThan(0);
  });

  it('computeStats calculates word count', () => {
    const blocks = [
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      createBlock('action', 'John enters the room slowly.'),
      createBlock('character', 'JOHN'),
      createBlock('dialogue', 'Hello there my friend.'),
    ];
    const stats = computeStats(blocks);
    expect(stats.wordCount).toBeGreaterThan(0);
    expect(stats.sceneCount).toBe(1);
    expect(stats.characterCount).toBe(1);
    expect(stats.dialoguePercentage).toBeGreaterThan(0);
  });

  it('computeSceneStats breaks down per scene', () => {
    const blocks = [
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      createBlock('action', 'John enters.'),
      createBlock('scene-heading', 'EXT. PARK - NIGHT'),
      createBlock('action', 'Rain falls hard.'),
    ];
    const stats = computeSceneStats(blocks);
    expect(stats.length).toBe(2);
    expect(stats[0].wordCount).toBe(6); // "INT. OFFICE - DAY" (4) + "John enters." (2)
    expect(stats[1].wordCount).toBe(7); // "EXT. PARK - NIGHT" (4) + "Rain falls hard." (3)
  });
});
