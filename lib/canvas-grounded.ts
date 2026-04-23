// The Grounded Test — the contract Kleo's Room outputs must satisfy.
// Every observation must reference a specific card ID, thread ID,
// or spine position. Generic story-craft jargon without anchoring
// to THIS board is rejected.
//
// Implementation: a validator applied post-generation. If the validator
// rejects, we retry with a correction prompt. If it still fails, we
// suppress (return null) — better silence than slop.

export interface GroundedObservation {
  observation: string;           // max 3 sentences
  referencedCardIds: string[];   // at least one of these must be non-empty
  referencedThreadIds: string[];
  referencedSpinePositions: number[];
}

export interface GroundedValidationResult {
  ok: boolean;
  reason?: string;
}

// ── The Gate ──

const JARGON = [
  'midpoint', 'inciting incident', 'save the cat', 'hero\'s journey',
  'three-act', 'rising action', 'falling action', 'call to adventure',
  'third-act twist', 'first-act break',
];

const VAGUE_PHRASES = [
  'there is a', 'consider', 'you might', 'have you thought',
  'perhaps you could', 'it could be interesting',
];

/**
 * Validate an observation against the Grounded Test.
 * An observation passes if:
 *   1. It references at least one real card ID / thread ID / spine position.
 *   2. Its text is non-empty and ≤ 3 sentences.
 *   3. If it uses craft jargon, it ALSO ties that jargon to a specific card ID.
 *   4. It does not lead with vague speculation without a card reference.
 */
export function validateGrounded(
  obs: GroundedObservation | null,
  knownCardIds: Set<string>,
  knownThreadIds: Set<string>,
): GroundedValidationResult {
  if (!obs) return { ok: true }; // explicit "nothing to say" is valid silence

  const text = (obs.observation || '').trim();
  if (!text) return { ok: false, reason: 'empty observation' };

  // Sentence count — cap 3.
  const sentenceCount = (text.match(/[.!?](\s|$)/g) || []).length || 1;
  if (sentenceCount > 3) return { ok: false, reason: `too long (${sentenceCount} sentences)` };

  // At least one real reference.
  const cardRefs = (obs.referencedCardIds || []).filter(id => knownCardIds.has(id));
  const threadRefs = (obs.referencedThreadIds || []).filter(id => knownThreadIds.has(id));
  const posRefs = obs.referencedSpinePositions || [];
  const hasReference = cardRefs.length + threadRefs.length + posRefs.length > 0;
  if (!hasReference) return { ok: false, reason: 'no valid card/thread/position reference' };

  // Jargon check — only if no card ref attached
  const lower = text.toLowerCase();
  const jargonHit = JARGON.find(j => lower.includes(j));
  if (jargonHit && cardRefs.length === 0) {
    return { ok: false, reason: `jargon "${jargonHit}" not tied to a specific card` };
  }

  // Vague-phrase check only at sentence start
  const leadsWithVague = VAGUE_PHRASES.some(v => lower.startsWith(v));
  if (leadsWithVague && cardRefs.length === 0) {
    return { ok: false, reason: 'vague lead without card anchor' };
  }

  return { ok: true };
}

// ── Context builders ──

export function buildCanvasContextForReader(
  cards: Array<{ id: string; type: string; text: string; status: string; emotion?: string | null; threadIds: string[]; position: { x: number; y: number } }>,
  threads: Array<{ id: string; name: string; color: string }>,
): string {
  if (cards.length === 0) return 'The canvas is empty.';

  const threadMap = new Map(threads.map(t => [t.id, t.name]));
  const cardLines = cards.map(c => {
    const threadNames = c.threadIds.map(id => threadMap.get(id)).filter(Boolean).join(', ');
    return `[${c.id}] (${c.type}${c.status !== 'raw' ? `, ${c.status}` : ''}${c.emotion ? `, ${c.emotion}` : ''}${threadNames ? `, threads: ${threadNames}` : ''}): ${c.text}`;
  }).join('\n');

  const threadLine = threads.length === 0
    ? ''
    : `\nThreads: ${threads.map(t => `${t.name}[${t.id}]`).join(', ')}`;

  return `Cards on the canvas:\n${cardLines}${threadLine}`;
}

export const READER_SYSTEM_PROMPT = `You are The Reader — a script supervisor reading the writer's board.
You speak ONLY about THIS board. Every observation MUST reference a specific card ID.
You never propose new cards.
You never use generic story-structure jargon without tying it to a specific card.
Maximum 3 sentences.

If you have nothing grounded to say, return {"observation": null}.

Respond JSON only:
{"observation":"...","referencedCardIds":["..."],"referencedThreadIds":[],"referencedSpinePositions":[]}`;

/**
 * Build a Reader prompt for an on-demand action like "Read the spine" or "What's missing?"
 */
export function buildReaderPrompt(
  action: 'read-spine' | 'whats-missing' | 'emotional-shape' | 'open-question',
  context: string,
  userQuestion?: string,
): string {
  const actionInstruction = {
    'read-spine':       'Read the board as if it were a spine. What shape is it making?',
    'whats-missing':    'What is this board missing? Be specific to cards on this board.',
    'emotional-shape':  'What emotional shape does this make? Reference cards by ID.',
    'open-question':    `The writer asks: "${userQuestion ?? ''}"`,
  }[action];

  return `${READER_SYSTEM_PROMPT}

${context}

${actionInstruction}`;
}
