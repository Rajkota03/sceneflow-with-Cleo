// ============================================================
// FDX (Final Draft XML) Import / Export for Doc model
// ============================================================

import type { Doc, Block, BlockType, TitlePageData } from './model';
import { createBlock, blockId } from './model';

// ─── Type Mapping ───

const FDX_TO_BLOCK: Record<string, BlockType> = {
  'Scene Heading': 'scene-heading',
  'Action': 'action',
  'Character': 'character',
  'Dialogue': 'dialogue',
  'Parenthetical': 'parenthetical',
  'Transition': 'transition',
  'General': 'action',
};

const BLOCK_TO_FDX: Record<BlockType, string> = {
  'scene-heading': 'Scene Heading',
  'action': 'Action',
  'character': 'Character',
  'dialogue': 'Dialogue',
  'parenthetical': 'Parenthetical',
  'transition': 'Transition',
};

// ─── Import ───

/** Parse Final Draft XML into a Doc. */
export function parseFdxToDoc(xmlString: string, docId?: string): Doc {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

  const title = extractTitle(xmlDoc);
  const titlePage = extractTitlePage(xmlDoc);
  const blocks = extractBlocks(xmlDoc);

  // Guarantee at least one block
  if (blocks.length === 0) {
    blocks.push(createBlock('scene-heading', 'INT. UNTITLED - DAY'));
    blocks.push(createBlock('action', ''));
  }

  const firstBlock = blocks[0];

  return {
    id: docId ?? `doc_${Date.now()}`,
    title,
    titlePage: titlePage ?? undefined,
    blocks,
    cursor: { position: { blockId: firstBlock.id, offset: 0 }, selection: null },
    version: 0,
  };
}

function extractTitle(xmlDoc: Document): string {
  const titleText = xmlDoc.querySelector('TitlePage Paragraph[Type="Title"] Text');
  return titleText?.textContent?.trim() || 'Imported Screenplay';
}

function extractTitlePage(xmlDoc: Document): TitlePageData | null {
  const titlePageEl = xmlDoc.querySelector('TitlePage');
  if (!titlePageEl) return null;

  const get = (type: string): string => {
    const el = titlePageEl.querySelector(`Paragraph[Type="${type}"] Text`);
    return el?.textContent?.trim() ?? '';
  };

  const title = get('Title');
  const credit = get('Credit');
  const author = get('Author');
  const source = get('Source');
  const draftDate = get('Draft Date');
  const contact = get('Contact');

  // Only return if there's at least a title
  if (!title && !author) return null;

  return { title, credit, author, source, draftDate, contact };
}

function extractBlocks(xmlDoc: Document): Block[] {
  const paragraphs = xmlDoc.querySelectorAll('Content > Paragraph');
  const blocks: Block[] = [];

  for (const p of paragraphs) {
    const fdxType = p.getAttribute('Type') ?? 'Action';
    const type = FDX_TO_BLOCK[fdxType] ?? 'action';

    // Collect all <Text> nodes (handles styled runs with multiple Text children)
    const textNodes = p.querySelectorAll('Text');
    const text = Array.from(textNodes).map(t => t.textContent ?? '').join('');

    blocks.push(createBlock(type, text.trim()));
  }

  return blocks;
}

// ─── Export ───

/** Export a Doc as Final Draft XML string. */
export function docToFdx(doc: Doc): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<FinalDraft DocumentType="Script" Template="No" Version="5">');

  // Title page
  if (doc.titlePage) {
    lines.push('  <TitlePage>');
    appendTitleField(lines, 'Title', doc.titlePage.title);
    appendTitleField(lines, 'Credit', doc.titlePage.credit);
    appendTitleField(lines, 'Author', doc.titlePage.author);
    appendTitleField(lines, 'Source', doc.titlePage.source);
    appendTitleField(lines, 'Draft Date', doc.titlePage.draftDate);
    appendTitleField(lines, 'Contact', doc.titlePage.contact);
    lines.push('  </TitlePage>');
  }

  // Content
  lines.push('  <Content>');
  for (const block of doc.blocks) {
    const fdxType = BLOCK_TO_FDX[block.type] ?? 'Action';
    const escaped = escapeXml(block.text);
    lines.push(`    <Paragraph Type="${fdxType}">`);
    lines.push(`      <Text>${escaped}</Text>`);
    lines.push('    </Paragraph>');
  }
  lines.push('  </Content>');

  lines.push('</FinalDraft>');

  return lines.join('\n');
}

function appendTitleField(lines: string[], type: string, value: string): void {
  if (!value) return;
  lines.push(`    <Paragraph Type="${type}">`);
  lines.push(`      <Text>${escapeXml(value)}</Text>`);
  lines.push('    </Paragraph>');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
