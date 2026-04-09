// ============================================================
// PDF EXPORT — Direct Download via jsPDF
// ============================================================
// Generates a properly formatted screenplay PDF with page
// breaks and page numbers, downloads directly as a file.
//
// US Letter (8.5" x 11"), Courier 12pt, industry margins.

import { jsPDF } from 'jspdf';
import type { Doc } from './model';
import type { ExportOptions } from '@/components/editor/export-dialog';

// Page dimensions in points (72pt = 1 inch)
const PW = 612;          // 8.5"
const PH = 792;          // 11"
const MT = 72;            // top margin 1"
const MB = 72;            // bottom margin 1"
const ML = 108;           // left margin 1.5"
const MR = 72;            // right margin 1"
const LH = 12;            // line height 12pt (single-spaced Courier 12)
const FS = 12;            // font size

// Usable area
const TEXT_W = PW - ML - MR;  // ~432pt (6")

// Element indents from LEFT EDGE of page
const CHAR_X = 252;       // ~3.5" from left
const PAREN_X = 216;      // ~3" from left
const PAREN_W = 168;      // ~2.3" wide
const DIAL_X = 180;       // ~2.5" from left
const DIAL_W = 252;       // ~3.5" wide

function stripParens(text: string): string {
  let t = text.trim();
  if (t.startsWith('(')) t = t.slice(1);
  if (t.endsWith(')')) t = t.slice(0, -1);
  return t;
}

export function docToPdf(doc: Doc, options?: ExportOptions): void {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true });

  // jsPDF built-in Courier: 'courier' (lowercase)
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(FS);

  let y = MT;
  let page = 1;
  const maxY = PH - MB;
  let autoSceneNum = 0; // auto-incrementing scene counter

  // ── Page management ──

  function renderWatermark() {
    if (!options?.watermark) return;
    pdf.saveGraphicsState();
    pdf.setFontSize(48);
    pdf.setFont('courier', 'bold');
    pdf.setTextColor(180, 180, 180);
    // @ts-expect-error jsPDF supports setGState for opacity
    pdf.setGState(new pdf.GState({ opacity: 0.15 }));
    const wText = options.watermark.toUpperCase();
    const cx = PW / 2;
    const cy = PH / 2;
    // Rotate ~45 degrees, center on page
    pdf.text(wText, cx, cy, { angle: 45, align: 'center' });
    pdf.restoreGraphicsState();
    // Reset font state
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(FS);
    pdf.setTextColor(0, 0, 0);
  }

  function renderHeader() {
    if (!options?.header) return;
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(FS);
    pdf.text(options.header, ML, 42);
  }

  function addNewPage() {
    // Page number at top-right (skip page 1 per screenplay convention)
    if (page > 0) {
      writePageNumber(page);
      renderWatermark();
    }
    pdf.addPage('letter', 'portrait');
    page++;
    y = MT;
    if (page > 1) renderHeader();
  }

  function writePageNumber(pg: number) {
    if (pg <= 1) return; // no number on page 1
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(FS);
    const num = `${pg}.`;
    const tw = pdf.getTextWidth(num);
    pdf.text(num, PW - MR - tw, 42); // top-right, above margin
  }

  // Track active speaking character for (MORE)/(CONT'D)
  let activeCharacter: string | null = null;
  let inDialogueBlock = false; // true when rendering character/parenthetical/dialogue

  function needsNewPage(lines: number): boolean {
    return y + lines * LH > maxY;
  }

  function ensureSpace(lines: number) {
    if (needsNewPage(lines)) {
      // If we're mid-dialogue, print (MORE) before page break
      if (inDialogueBlock && activeCharacter) {
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(FS);
        pdf.text('(MORE)', CHAR_X, y);
      }
      addNewPage();
      // Print CONT'D at top of new page
      if (inDialogueBlock && activeCharacter) {
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(FS);
        pdf.text(`${activeCharacter} (CONT'D)`, CHAR_X, y);
        y += LH;
      }
    }
  }

  function printLine(text: string, x: number) {
    ensureSpace(1);
    pdf.text(text, x, y);
    y += LH;
  }

  function printWrapped(text: string, x: number, width: number) {
    if (!text.trim()) return;
    const lines: string[] = pdf.splitTextToSize(text, width);
    for (const line of lines) {
      printLine(line, x);
    }
  }

  // ── Title Page ──
  // Only render if option is enabled and there's meaningful content
  const tp = doc.titlePage;
  const includeTitlePage = options?.includeTitlePage !== false; // default true
  const hasTitlePage = includeTitlePage && tp && (tp.title || tp.author || tp.credit || tp.contact || tp.draftDate);
  if (hasTitlePage) {

    if (tp.title) {
      // Title centered at ~35% down the page
      y = PH * 0.35;
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(20);
      const titleText = tp.title.toUpperCase();
      const titleLines: string[] = pdf.splitTextToSize(titleText, TEXT_W);
      for (const line of titleLines) {
        const tw = pdf.getTextWidth(line);
        pdf.text(line, (PW - tw) / 2, y);
        y += 24;
      }
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(FS);

      y += 24;

      if (tp.credit) {
        const tw = pdf.getTextWidth(tp.credit);
        pdf.text(tp.credit, (PW - tw) / 2, y);
        y += LH * 2;
      }

      if (tp.author) {
        const tw = pdf.getTextWidth(tp.author);
        pdf.text(tp.author, (PW - tw) / 2, y);
      }
    }

    // Bottom-left contact info
    const bottom: string[] = [];
    if (tp.contact) bottom.push(tp.contact);
    if (tp.draftDate) bottom.push(tp.draftDate);
    if (bottom.length) {
      let by = PH - MB - bottom.length * LH;
      for (const item of bottom) {
        pdf.text(item, ML, by);
        by += LH;
      }
    }

    // Watermark on title page too
    renderWatermark();

    // Start new page for script body
    addNewPage();
  } else {
    // No title page — render header on page 1
    renderHeader();
  }

  // ── Script Body ──
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(FS);

  for (let bi = 0; bi < doc.blocks.length; bi++) {
    const block = doc.blocks[bi];
    const text = block.text.trim();

    switch (block.type) {
      case 'scene-heading': {
        activeCharacter = null;
        inDialogueBlock = false;
        // One scene per page: force new page for every scene (except first)
        if (options?.scenePerPage && bi > 0 && y > MT) {
          addNewPage();
        }
        // Double-space before (unless top of page)
        if (y > MT + LH) {
          y += LH;
        }
        ensureSpace(3); // heading + at least 2 lines after
        pdf.setFont('courier', 'bold');
        pdf.setFontSize(FS);

        // Scene numbers in both margins (production draft style)
        if (options?.showSceneNumbers) {
          autoSceneNum++;
          const sn = block.meta.sceneNumber || String(autoSceneNum);
          pdf.text(sn, 54, y);  // left margin (~0.75" from left edge)
          const snW = pdf.getTextWidth(sn);
          pdf.text(sn, PW - 54 - snW, y);  // right margin
        }

        printWrapped(text.toUpperCase(), ML, TEXT_W);
        y += LH; // space after heading
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(FS);
        break;
      }

      case 'action': {
        activeCharacter = null;
        inDialogueBlock = false;
        if (!text) {
          y += LH; // blank line
          break;
        }
        if (y > MT + LH) y += LH; // space before
        pdf.setFont('courier', 'normal');
        printWrapped(text, ML, TEXT_W);
        break;
      }

      case 'character': {
        // Extract character name (strip extensions like (V.O.), (O.S.))
        activeCharacter = text.toUpperCase().replace(/\s*\(.*\)$/, '').trim();
        inDialogueBlock = true;
        if (y > MT + LH) y += LH; // space before
        ensureSpace(3); // character + at least dialogue line
        pdf.setFont('courier', 'normal');
        printLine(text.toUpperCase(), CHAR_X);
        break;
      }

      case 'parenthetical': {
        inDialogueBlock = true;
        ensureSpace(1);
        pdf.setFont('courier', 'normal');
        const inner = `(${stripParens(block.text)})`;
        printWrapped(inner, PAREN_X, PAREN_W);
        break;
      }

      case 'dialogue': {
        inDialogueBlock = true;
        ensureSpace(1);
        pdf.setFont('courier', 'normal');
        printWrapped(text, DIAL_X, DIAL_W);
        break;
      }

      case 'transition': {
        activeCharacter = null;
        inDialogueBlock = false;
        if (y > MT + LH) y += LH;
        ensureSpace(1);
        pdf.setFont('courier', 'normal');
        const upper = text.toUpperCase();
        const tw = pdf.getTextWidth(upper);
        printLine(upper, PW - MR - tw);
        y += LH; // space after
        break;
      }
    }
  }

  // Write page number and watermark on the final page
  writePageNumber(page);
  renderWatermark();
  if (page > 1) renderHeader();

  // Download
  const filename = (doc.title || 'Untitled Screenplay')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);

  pdf.save(`${filename}.pdf`);
}
