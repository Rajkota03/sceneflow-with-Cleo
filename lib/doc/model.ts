// ============================================================
// SCENEFLOW DOCUMENT MODEL
// ============================================================
// Flat block-based model. Scenes are derived, not stored.
// A "scene" = a scene-heading block + all blocks until the next scene-heading.
// This makes operations (split, merge, reorder) trivial.

export type BlockType =
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition';

export interface BlockMeta {
  dual?: 'left' | 'right';
  revised?: boolean;
  bookmark?: string;
  note?: string;
  sceneColor?: string;    // stored on scene-heading blocks
  locked?: boolean;       // scene locked (prevents editing) OR type manually forced — skip auto-classify
  sceneNumber?: string;   // custom scene number (e.g. "1A", "2B") — stored on scene-heading blocks
}

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  meta: BlockMeta;
}

export interface CursorPosition {
  blockId: string;
  offset: number;
}

export interface Selection {
  anchor: CursorPosition;
  focus: CursorPosition;
}

export interface Cursor {
  position: CursorPosition;
  selection: Selection | null;
}

export interface TitlePageData {
  title: string;
  credit: string;
  author: string;
  source: string;
  draftDate: string;
  contact: string;
}

export interface Doc {
  id: string;
  title: string;
  titlePage?: TitlePageData;
  blocks: Block[];
  cursor: Cursor;
  version: number;  // increments on every transaction
}

// ─── Derived Views ───

export interface DerivedScene {
  headingBlockId: string;
  heading: string;
  color?: string;
  locked?: boolean;       // true when the scene-heading block has meta.locked
  sceneNumber?: string;   // custom scene number from meta (e.g. "1A")
  blockIds: string[];     // all block IDs in this scene (including heading)
  startIndex: number;     // index of scene-heading in doc.blocks
  endIndex: number;       // index of last block in this scene
}

/** Derive scene boundaries from a flat block list. O(n) single pass. */
export function deriveScenes(blocks: Block[]): DerivedScene[] {
  const scenes: DerivedScene[] = [];
  let current: DerivedScene | null = null;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'scene-heading') {
      if (current) current.endIndex = i - 1;
      current = {
        headingBlockId: block.id,
        heading: block.text,
        color: block.meta.sceneColor,
        locked: block.meta.locked,
        sceneNumber: block.meta.sceneNumber,
        blockIds: [block.id],
        startIndex: i,
        endIndex: i,
      };
      scenes.push(current);
    } else if (current) {
      current.blockIds.push(block.id);
      current.endIndex = i;
    } else {
      // Orphan blocks before first scene heading — create implicit scene
      current = {
        headingBlockId: '',
        heading: '',
        blockIds: [block.id],
        startIndex: i,
        endIndex: i,
      };
      scenes.push(current);
    }
  }

  return scenes;
}

// ─── Block Index ───
// Fast lookups by ID. Rebuilt on every transaction (cheap for <10k blocks).

export interface BlockIndex {
  byId: Map<string, Block>;
  indexOf: Map<string, number>;
}

export function buildIndex(blocks: Block[]): BlockIndex {
  const byId = new Map<string, Block>();
  const indexOf = new Map<string, number>();
  for (let i = 0; i < blocks.length; i++) {
    byId.set(blocks[i].id, blocks[i]);
    indexOf.set(blocks[i].id, i);
  }
  return { byId, indexOf };
}

// ─── Factory ───

let _counter = 0;
export function blockId(): string {
  return `b_${Date.now()}_${++_counter}`;
}

export function createBlock(type: BlockType, text = '', meta: Partial<BlockMeta> = {}): Block {
  return { id: blockId(), type, text, meta: { ...meta } };
}

export function createDoc(title = 'Untitled Screenplay'): Doc {
  const heading = createBlock('scene-heading', 'INT. UNTITLED - DAY');
  const action = createBlock('action', '');
  return {
    id: `doc_${Date.now()}`,
    title,
    blocks: [heading, action],
    cursor: { position: { blockId: action.id, offset: 0 }, selection: null },
    version: 0,
  };
}
