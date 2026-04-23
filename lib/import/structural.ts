// Structural import — FDX + Fountain → CanvasCard data.
// Browser-only, no server, no AI. Deterministic chunk-by-scene.
// The Doc parsers already exist; this module just reshapes their output
// into the provenance-linked records that canvas-room-store expects.

import type { Block, Doc, DerivedScene } from '../doc/model';
import { deriveScenes } from '../doc/model';
import { parseFdxToDoc } from '../doc/fdx';
import { parseFountain } from '../doc/fountain';
import {
  createImportedFile,
  createCardsFromImport,
  updateImportedFile,
  type CanvasCard,
  type ImportedFile,
  type SourcePassage,
} from '../canvas-room-store';

// ─── Types ───

export interface ParsedStructural {
  fullText: string;
  passages: SourcePassage[];            // one per scene
  scenes: Array<{
    sceneHeading: string;
    sceneBody: string;                  // action + dialogue concatenated, plain text
    passageRef: string;                 // matches a SourcePassage.ref
  }>;
}

export interface StructuralImportResult {
  format: 'fdx' | 'fountain';
  importedFile: ImportedFile;
  cards: CanvasCard[];
  sceneCount: number;
}

// ─── Public API ───

/** Read a File blob, parse it, persist the records, return the result. */
export async function importStructuralFile(file: File): Promise<StructuralImportResult> {
  const format = detectFormat(file);
  const text = await file.text();

  let parsed: ParsedStructural;
  try {
    parsed = format === 'fdx' ? parseFdxForCanvas(text) : parseFountainForCanvas(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Still record the attempt so the user can see why it failed
    const failedFile = createImportedFile({
      originalFilename: file.name,
      mimeType: file.type || mimeForFormat(format),
      contentBody: text,
      format,
      sourceLastModified: file.lastModified ?? null,
      passages: [],
    });
    updateImportedFile(failedFile.id, { parseStatus: 'failed' });
    throw new Error(`Failed to parse ${format.toUpperCase()}: ${msg}`);
  }

  const importedFile = createImportedFile({
    originalFilename: file.name,
    mimeType: file.type || mimeForFormat(format),
    contentBody: parsed.fullText,
    format,
    sourceLastModified: file.lastModified ?? null,
    passages: parsed.passages.map(p => ({ ...p, importedFileId: '' })), // will backfill below
  });

  // Backfill passages with the real importedFileId
  const passagesWithFileId = parsed.passages.map(p => ({ ...p, importedFileId: importedFile.id }));
  updateImportedFile(importedFile.id, { passages: passagesWithFileId });

  // No scenes found → store the file but don't spawn cards.
  if (parsed.scenes.length === 0) {
    updateImportedFile(importedFile.id, { parseStatus: 'partial' });
    return { format, importedFile, cards: [], sceneCount: 0 };
  }

  const items = parsed.scenes.map((scene, i) => ({
    text: buildCardText(scene.sceneHeading, scene.sceneBody),
    type: 'beat' as const,
    sourcePassageRef: scene.passageRef,
    // Spine-row layout: horizontal spread with a two-row zigzag so cards don't overlap.
    position: { x: 60 + i * 270, y: 240 + (i % 2) * 30 },
  }));

  const cards = createCardsFromImport(importedFile.id, items);
  const finalFile = updateImportedFile(importedFile.id, { parseStatus: 'parsed' }) ?? importedFile;

  return {
    format,
    importedFile: finalFile,
    cards,
    sceneCount: parsed.scenes.length,
  };
}

/** Parse FDX xml → scenes + passages. Pure. Throws on malformed XML. */
export function parseFdxForCanvas(xmlText: string): ParsedStructural {
  // Sniff: FDX must be XML. parseFdxToDoc silently returns a placeholder on
  // garbage input, so we guard here for a clean failure signal.
  const trimmed = xmlText.trimStart();
  if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<FinalDraft')) {
    throw new Error('Not a valid FDX file — missing XML/FinalDraft root.');
  }

  // DOMParser reports parse errors via a <parsererror> element rather than throwing.
  const probe = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parseErr = probe.querySelector('parsererror');
  if (parseErr) {
    throw new Error('FDX XML is malformed: ' + (parseErr.textContent?.slice(0, 120) ?? 'unknown parser error'));
  }

  const doc = parseFdxToDoc(xmlText);
  return docToParsed(doc);
}

/** Parse Fountain source → scenes + passages. Pure. */
export function parseFountainForCanvas(source: string): ParsedStructural {
  const doc = parseFountain(source);
  return docToParsed(doc);
}

// ─── Internals ───

function detectFormat(file: File): 'fdx' | 'fountain' {
  const name = file.name.toLowerCase();
  if (name.endsWith('.fdx')) return 'fdx';
  if (name.endsWith('.fountain') || name.endsWith('.ftn')) return 'fountain';
  // Fallback: mime sniff. FDX files often come with application/xml.
  if (file.type.includes('xml')) return 'fdx';
  // Default to fountain — it's the plain-text format, least likely to surprise.
  return 'fountain';
}

function mimeForFormat(format: 'fdx' | 'fountain'): string {
  return format === 'fdx' ? 'application/xml' : 'text/plain';
}

/** Reconstruct fullText from blocks and chunk into per-scene passages. */
function docToParsed(doc: Doc): ParsedStructural {
  // Reconstruct fullText by joining blocks with newlines, tracking each
  // block's [startOffset, endOffset) against the reconstructed string.
  const blockOffsets = new Map<string, { start: number; end: number }>();
  const parts: string[] = [];
  let cursor = 0;

  for (const block of doc.blocks) {
    const line = blockLine(block);
    blockOffsets.set(block.id, { start: cursor, end: cursor + line.length });
    parts.push(line);
    cursor += line.length + 1; // +1 for the joining newline
  }
  const fullText = parts.join('\n');

  const derived = deriveScenes(doc.blocks);
  const passages: SourcePassage[] = [];
  const scenes: ParsedStructural['scenes'] = [];

  let sceneIdx = 0;
  for (const d of derived) {
    // Skip orphan blocks that appear before the first scene-heading.
    if (!d.headingBlockId || !d.heading) continue;

    const { sceneBody, text, start, end } = sliceScene(doc.blocks, d, blockOffsets);
    const ref = `p_${sceneIdx}`;

    passages.push({
      ref,
      importedFileId: '',   // caller backfills after createImportedFile
      startOffset: start,
      endOffset: end,
      pageNumber: null,
      text,
    });

    scenes.push({
      sceneHeading: d.heading,
      sceneBody,
      passageRef: ref,
    });

    sceneIdx++;
  }

  return { fullText, passages, scenes };
}

/** Turn a block into the line it contributes to fullText. */
function blockLine(block: Block): string {
  // Scene headings render as-is; everything else is body text. No decoration —
  // we want provenance text to read like the source, not like pretty-printed script.
  return block.text;
}

/** Slice one scene's blocks into body text + offset range. */
function sliceScene(
  blocks: Block[],
  scene: DerivedScene,
  offsets: Map<string, { start: number; end: number }>,
): { sceneBody: string; text: string; start: number; end: number } {
  const headingOff = offsets.get(scene.headingBlockId);
  const lastBlockId = scene.blockIds[scene.blockIds.length - 1];
  const lastOff = offsets.get(lastBlockId);
  const start = headingOff?.start ?? 0;
  const end = lastOff?.end ?? start;

  // Body = every non-heading block's text, joined with blank lines so
  // action/dialogue reads naturally on the card.
  const bodyBlocks = blocks.slice(scene.startIndex + 1, scene.endIndex + 1);
  const sceneBody = bodyBlocks
    .map(b => b.text.trim())
    .filter(Boolean)
    .join('\n\n');

  // text = the full passage (heading + body), matching startOffset..endOffset.
  const text = bodyBlocks.length > 0
    ? `${scene.heading}\n${sceneBody}`
    : scene.heading;

  return { sceneBody, text, start, end };
}

/** Card preview: heading + first ~200 chars of body. */
function buildCardText(heading: string, body: string): string {
  const CARD_BODY_LIMIT = 200;
  if (!body) return heading;
  const snippet = body.length > CARD_BODY_LIMIT
    ? body.slice(0, CARD_BODY_LIMIT).trimEnd() + '…'
    : body;
  return `${heading}\n\n${snippet}`;
}
