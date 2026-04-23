// Wording-Preservation validator for AI-parsed prose imports.
//
// The contract: when Claude parses a writer's prose into proposed cards,
// it MAY split and classify — it MUST NOT rewrite, summarize, or paraphrase.
// Every proposal's text must be (near-)verbatim from the source.
//
// This validator is the enforcement. It accepts a proposal only when the
// text matches source content at its claimed offsets, within a narrow
// fuzz tolerance (whitespace / minor OCR-ish drift). Anything further
// from the source is rejected — better to drop a card than to silently
// let the model's prose into the writer's canvas.

import type { CardType } from './canvas-room-store';

export interface RawProposedCard {
  text: string;
  sourceStart: number;
  sourceEnd: number;
  suggestedType: string;
}

export interface ValidatedProposal {
  text: string;
  sourcePassageRef: string;
  sourceStart: number;
  sourceEnd: number;
  suggestedType: CardType;
}

export interface ValidationDiagnostic {
  accepted: ValidatedProposal[];
  rejected: Array<{ proposal: RawProposedCard; reason: string }>;
}

const ALLOWED_TYPES: ReadonlyArray<CardType> = ['beat', 'moment', 'question', 'fragment'];
const MIN_TEXT_LENGTH = 5;
const MAX_PROPOSALS = 60;
const SIMILARITY_THRESHOLD = 0.9; // ≥ 90% similarity after normalization

/**
 * Enforce the wording-preservation contract on model-proposed cards.
 *
 * For each proposal:
 *   1. Reject if text is empty or shorter than MIN_TEXT_LENGTH.
 *   2. Coerce invalid suggestedType to 'fragment' (don't reject just for that).
 *   3. Verify text matches the source at [sourceStart, sourceEnd] —
 *      accept if exact substring, else if normalized similarity ≥ 0.9,
 *      else try to re-locate via indexOf and update offsets.
 *   4. Cap accepted count at MAX_PROPOSALS.
 *
 * sourcePassageRef is assigned by the caller (we don't know their indexing scheme).
 */
export function enforceWordingPreservation(
  source: string,
  raws: RawProposedCard[],
): ValidationDiagnostic {
  const accepted: ValidatedProposal[] = [];
  const rejected: Array<{ proposal: RawProposedCard; reason: string }> = [];

  for (const raw of raws) {
    if (accepted.length >= MAX_PROPOSALS) {
      rejected.push({ proposal: raw, reason: 'exceeds max 60 proposals' });
      continue;
    }

    const text = (raw.text ?? '').toString();
    if (!text.trim()) {
      rejected.push({ proposal: raw, reason: 'empty text' });
      continue;
    }
    if (text.trim().length < MIN_TEXT_LENGTH) {
      rejected.push({ proposal: raw, reason: `text too short (<${MIN_TEXT_LENGTH} chars)` });
      continue;
    }

    const suggestedType: CardType = ALLOWED_TYPES.includes(raw.suggestedType as CardType)
      ? (raw.suggestedType as CardType)
      : 'fragment';

    const located = locateInSource(source, text, raw.sourceStart, raw.sourceEnd);
    if (!located) {
      rejected.push({ proposal: raw, reason: 'text does not match source (wording altered)' });
      continue;
    }

    accepted.push({
      text,
      sourcePassageRef: '', // caller assigns
      sourceStart: located.start,
      sourceEnd: located.end,
      suggestedType,
    });
  }

  return { accepted, rejected };
}

/**
 * Find the proposal text in source, preferring the model's claimed offsets.
 * Returns the validated offsets, or null if the text can't be located.
 */
function locateInSource(
  source: string,
  text: string,
  claimedStart: number,
  claimedEnd: number,
): { start: number; end: number } | null {
  // 1. Fast path — exact substring at claimed offsets
  if (
    Number.isFinite(claimedStart) && Number.isFinite(claimedEnd) &&
    claimedStart >= 0 && claimedEnd <= source.length && claimedStart < claimedEnd
  ) {
    const slice = source.slice(claimedStart, claimedEnd);
    if (slice === text) return { start: claimedStart, end: claimedEnd };
    if (similar(slice, text)) return { start: claimedStart, end: claimedEnd };
  }

  // 2. Exact substring anywhere in source
  const exactIdx = source.indexOf(text);
  if (exactIdx !== -1) return { start: exactIdx, end: exactIdx + text.length };

  // 3. Try first 50 chars of text as a locator, then verify the full window is similar
  const probe = text.slice(0, 50);
  if (probe.length >= MIN_TEXT_LENGTH) {
    const probeIdx = source.indexOf(probe);
    if (probeIdx !== -1) {
      const windowEnd = Math.min(source.length, probeIdx + text.length);
      const window = source.slice(probeIdx, windowEnd);
      if (similar(window, text)) return { start: probeIdx, end: windowEnd };
    }
  }

  return null;
}

/**
 * True if two strings are ≥ SIMILARITY_THRESHOLD similar after normalization.
 * Normalization: lowercase + collapse whitespace.
 * Similarity: 1 - (editDistance / maxLength).
 */
function similar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return true;
  const budget = Math.floor(maxLen * (1 - SIMILARITY_THRESHOLD));
  return editDistance(na, nb, budget) <= budget;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Levenshtein distance with an early-exit budget.
 * Returns the true distance when ≤ budget, else returns budget + 1.
 * Budget-based early exit keeps this O(n·budget) in the common "almost equal" case.
 */
export function editDistance(a: string, b: string, budget = Infinity): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > budget) return budget + 1;

  // Ensure a is the shorter — lets us keep the DP row smaller
  if (a.length > b.length) { const t = a; a = b; b = t; }

  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    let rowMin = curr[0];
    for (let i = 1; i <= m; i++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[i] + 1;
      const ins = curr[i - 1] + 1;
      const sub = prev[i - 1] + cost;
      curr[i] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
      if (curr[i] < rowMin) rowMin = curr[i];
    }
    if (rowMin > budget) return budget + 1;
    const tmp = prev; prev = curr; curr = tmp;
  }

  return prev[m];
}
