// ============================================================
// BRIDGE: Old Screenplay ↔ New Document
// ============================================================
// Converts between the legacy scene-based model (Screenplay)
// and the new flat block model (Doc). This lets us swap in the
// new engine without breaking the existing UI or persistence.

import type { Screenplay, ScreenplayScene, ScreenplayElement, ScreenplayElementType, TitlePage } from '../types';
import type { Doc, Block, BlockType, TitlePageData } from './model';
import { blockId, createBlock } from './model';

// ─── Type mapping ───

const TYPE_TO_BLOCK: Record<ScreenplayElementType, BlockType | null> = {
  'scene-heading': 'scene-heading',
  'action': 'action',
  'character': 'character',
  'parenthetical': 'parenthetical',
  'dialogue': 'dialogue',
  'transition': 'transition',
  'dual-start': null,   // structural marker, not a real block
  'dual-end': null,     // structural marker, not a real block
};

const BLOCK_TO_TYPE: Record<BlockType, ScreenplayElementType> = {
  'scene-heading': 'scene-heading',
  'action': 'action',
  'character': 'character',
  'parenthetical': 'parenthetical',
  'dialogue': 'dialogue',
  'transition': 'transition',
};

// ─── Screenplay → Doc ───

export function screenplayToDoc(sp: Screenplay): Doc {
  const blocks: Block[] = [];

  for (const scene of sp.scenes) {
    // Scene heading becomes a block
    const headingBlock = createBlock('scene-heading', scene.heading);
    if (scene.color) headingBlock.meta.sceneColor = scene.color;
    blocks.push(headingBlock);

    // Elements become blocks (skip dual markers)
    for (const el of scene.elements) {
      const blockType = TYPE_TO_BLOCK[el.type];
      if (!blockType) continue; // skip dual-start/dual-end

      const block = createBlock(blockType, el.text);
      if (el.note) block.meta.note = el.note;
      if (el.dual) block.meta.dual = el.dual;
      if (el.revised) block.meta.revised = true;
      if (el.bookmark) block.meta.bookmark = el.bookmark;
      blocks.push(block);
    }
  }

  // Ensure at least one block
  if (blocks.length === 0) {
    blocks.push(createBlock('scene-heading', 'INT. UNTITLED - DAY'));
    blocks.push(createBlock('action', ''));
  }

  return {
    id: sp.sessionId,
    title: sp.title,
    titlePage: sp.titlePage ? { ...sp.titlePage } : undefined,
    blocks,
    cursor: { position: { blockId: blocks[blocks.length - 1].id, offset: 0 }, selection: null },
    version: 0,
  };
}

// ─── Doc → Screenplay ───

export function docToScreenplay(doc: Doc, sessionId?: string): Screenplay {
  const scenes: ScreenplayScene[] = [];
  let currentScene: ScreenplayScene | null = null;

  for (const block of doc.blocks) {
    if (block.type === 'scene-heading') {
      currentScene = {
        id: block.id,
        heading: block.text,
        elements: [],
        color: block.meta.sceneColor,
      };
      scenes.push(currentScene);
    } else {
      // If no scene heading yet, create an implicit one
      if (!currentScene) {
        currentScene = {
          id: blockId(),
          heading: '',
          elements: [],
        };
        scenes.push(currentScene);
      }

      const el: ScreenplayElement = {
        id: block.id,
        type: BLOCK_TO_TYPE[block.type],
        text: block.text,
      };
      if (block.meta.note) el.note = block.meta.note;
      if (block.meta.dual) el.dual = block.meta.dual;
      if (block.meta.revised) el.revised = true;
      if (block.meta.bookmark) el.bookmark = block.meta.bookmark;

      // Re-insert dual markers if needed
      if (block.meta.dual === 'left' && block.type === 'character') {
        // Check if we need a dual-start
        const prevEl = currentScene.elements[currentScene.elements.length - 1];
        if (!prevEl || prevEl.type !== 'dual-start') {
          currentScene.elements.push({
            id: blockId(),
            type: 'dual-start',
            text: '',
          });
        }
      }

      currentScene.elements.push(el);

      // Check if this is the last block in a dual-right group
      if (block.meta.dual === 'right') {
        // Look ahead: if next block has no dual, close the dual group
        const blockIdx = doc.blocks.indexOf(block);
        const nextBlock = doc.blocks[blockIdx + 1];
        if (!nextBlock || !nextBlock.meta.dual) {
          currentScene.elements.push({
            id: blockId(),
            type: 'dual-end',
            text: '',
          });
        }
      }
    }
  }

  return {
    sessionId: sessionId ?? doc.id,
    title: doc.title,
    titlePage: doc.titlePage as TitlePage | undefined,
    scenes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─── Sync helpers ───
// Patch an existing Screenplay with changes from a Doc, preserving IDs where possible.

export function patchScreenplayFromDoc(original: Screenplay, doc: Doc): Screenplay {
  const sp = docToScreenplay(doc, original.sessionId);
  return {
    ...sp,
    createdAt: original.createdAt,
    updatedAt: Date.now(),
  };
}
