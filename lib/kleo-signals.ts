// Kleo signals — ambient detection rules.
// Pure functions over a Doc. No AI. No side effects.
// Each signal points at a specific scene with a specific observation.
//
// Rules are designed to fire RARELY. The worst outcome is crying wolf —
// writers tune out margin notes within a week if the signal ratio is off.

import type { Doc, Block, DerivedScene } from './doc';
import { deriveScenes, computeSceneStats } from './doc';

export type SignalTier = 'A' | 'B';
export type SignalKind =
  | 'runaway-scene'
  | 'dead-character'
  | 'time-monotony'
  | 'act-one-overrun'
  | 'silent-scene'
  | 'wall-of-dialogue'
  | 'orphan-heading';

export interface Signal {
  id: string;                 // stable per scene+kind — used for dismissal
  kind: SignalKind;
  tier: SignalTier;
  sceneHeadingBlockId: string;
  sceneNumber: number;        // 1-based
  label: string;              // short tag, e.g. "PACING", "RHYTHM"
  message: string;            // what Kleo noticed — prose, 1-2 sentences
  askPrompt: string;          // pre-filled prompt for the chat when "Ask Kleo" is clicked
}

// ── Utilities ──

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function parseTimeOfDay(heading: string): 'day' | 'night' | 'dusk' | 'dawn' | null {
  const u = heading.toUpperCase();
  if (/\b(NIGHT|EVENING|MIDNIGHT|LATE NIGHT)\b/.test(u)) return 'night';
  if (/\b(DAY|MORNING|NOON|AFTERNOON)\b/.test(u)) return 'day';
  if (/\b(DUSK|SUNSET|TWILIGHT)\b/.test(u)) return 'dusk';
  if (/\b(DAWN|SUNRISE)\b/.test(u)) return 'dawn';
  return null;
}

function shortHeading(h: string): string {
  return h
    .replace(/^(INT\.?\/EXT\.?|I\/E\.?|INT\.|EXT\.)\s*/i, '')
    .replace(/\s*[-—]\s*(DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS|LATER|SAME)\b.*$/i, '')
    .trim() || h;
}

// ── The detector ──

export function detectSignals(doc: Doc): Signal[] {
  const signals: Signal[] = [];
  const scenes = deriveScenes(doc.blocks);
  if (scenes.length === 0) return signals;

  const stats = computeSceneStats(doc.blocks);
  const statsById = new Map(stats.map(s => [s.sceneHeadingBlockId, s]));
  const totalPages = stats.reduce((a, s) => a + s.estimatedPages, 0);

  // Per-scene derived data (one pass)
  const derived = scenes.map((scene, i) => {
    const blocks = doc.blocks.slice(scene.startIndex, scene.endIndex + 1);
    const st = statsById.get(scene.headingBlockId);
    const dialogueBlocks = blocks.filter(b => b.type === 'dialogue');
    const dialogueWords = dialogueBlocks.reduce((a, b) => a + countWords(b.text), 0);
    const contentBlocks = blocks.filter(b => b.type !== 'scene-heading');
    const speakingCharacters = new Set<string>();
    for (const b of blocks) {
      if (b.type === 'character') {
        const name = b.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
        if (name) speakingCharacters.add(name);
      }
    }
    return {
      scene,
      sceneNumber: i + 1,
      pages: st?.estimatedPages ?? 0,
      totalWords: blocks.reduce((a, b) => a + countWords(b.text), 0),
      dialogueBlocks,
      dialogueWords,
      contentBlocks,
      timeOfDay: parseTimeOfDay(scene.heading),
      speakingCharacters,
      blocks,
    };
  });

  // Cumulative page position at end of each scene
  const cumPages: number[] = [];
  {
    let c = 0;
    for (const d of derived) { c += d.pages; cumPages.push(c); }
  }

  // ── Rule 1: Runaway scene (>4.5pg) ──
  for (const d of derived) {
    if (d.pages >= 4.5) {
      signals.push({
        id: `runaway:${d.scene.headingBlockId}`,
        kind: 'runaway-scene',
        tier: 'A',
        sceneHeadingBlockId: d.scene.headingBlockId,
        sceneNumber: d.sceneNumber,
        label: 'PACING',
        message: `This scene is ${d.pages.toFixed(1)}pg. Most features average around 1.8pg/scene — is a break hiding in here?`,
        askPrompt: `Scene ${d.sceneNumber} ("${shortHeading(d.scene.heading)}") is ${d.pages.toFixed(1)} pages. Where should I cut or break it?`,
      });
    }
  }

  // ── Rule 2: Dead character (>20pg since last spoke, doc >40pg) ──
  if (totalPages >= 40) {
    // For each character, track last page they spoke
    const charLastSpokePage = new Map<string, { scene: number; page: number }>();
    const charEverSpoke = new Map<string, { scene: number; page: number }>();
    for (let i = 0; i < derived.length; i++) {
      const d = derived[i];
      const pageAtSceneStart = i > 0 ? cumPages[i - 1] : 0;
      for (const name of d.speakingCharacters) {
        const prev = charEverSpoke.get(name);
        charLastSpokePage.set(name, { scene: d.sceneNumber, page: pageAtSceneStart });
        if (!prev) charEverSpoke.set(name, { scene: d.sceneNumber, page: pageAtSceneStart });
      }
    }
    for (const [name, last] of charLastSpokePage) {
      const gap = totalPages - last.page;
      // Only flag if the character spoke meaningfully before (not just once) AND is silent for >20pg of a >40pg doc
      const introPage = charEverSpoke.get(name)?.page ?? 0;
      if (gap >= 20 && (last.page - introPage) >= 6) {
        // Attach the signal to the LAST scene of the doc so it doesn't haunt the middle
        const lastScene = derived[derived.length - 1];
        signals.push({
          id: `dead-char:${name}:${lastScene.scene.headingBlockId}`,
          kind: 'dead-character',
          tier: 'A',
          sceneHeadingBlockId: lastScene.scene.headingBlockId,
          sceneNumber: lastScene.sceneNumber,
          label: 'RHYTHM',
          message: `${name} last spoke around p.${Math.round(last.page)}. Still in the story?`,
          askPrompt: `${name} hasn't spoken since page ${Math.round(last.page)}. Do they still belong in this script?`,
        });
      }
    }
  }

  // ── Rule 3: Time-of-day monotony (4+ in a row, doc >20pg) ──
  if (totalPages >= 20) {
    let run: { tod: string; start: number; count: number } | null = null;
    const runs: Array<{ tod: string; start: number; end: number; count: number }> = [];
    for (let i = 0; i < derived.length; i++) {
      const tod = derived[i].timeOfDay;
      if (!tod) { if (run) { runs.push({ ...run, end: i - 1 }); run = null; } continue; }
      if (run && run.tod === tod) {
        run.count++;
      } else {
        if (run) runs.push({ ...run, end: i - 1 });
        run = { tod, start: i, count: 1 };
      }
    }
    if (run) runs.push({ ...run, end: derived.length - 1 });
    for (const r of runs) {
      if (r.count >= 4) {
        const anchor = derived[r.start + Math.floor(r.count / 2)]; // middle of the run
        signals.push({
          id: `time-monotony:${anchor.scene.headingBlockId}`,
          kind: 'time-monotony',
          tier: 'B',
          sceneHeadingBlockId: anchor.scene.headingBlockId,
          sceneNumber: anchor.sceneNumber,
          label: 'RHYTHM',
          message: `${r.count} ${r.tod.toUpperCase()} scenes in a row. Consider breaking the light.`,
          askPrompt: `I have ${r.count} ${r.tod} scenes back-to-back. How should I vary the rhythm?`,
        });
      }
    }
  }

  // ── Rule 4: Act One overrun (doc >60pg, 25% mark lands past page 35) ──
  if (totalPages >= 60) {
    let actOneEndPage = 0;
    for (let i = 0; i < derived.length; i++) {
      if (cumPages[i] >= totalPages * 0.25) { actOneEndPage = cumPages[i]; break; }
    }
    if (actOneEndPage > 35) {
      // Attach to the scene where Act I ends
      let idx = 0;
      for (let i = 0; i < cumPages.length; i++) if (cumPages[i] >= actOneEndPage) { idx = i; break; }
      const anchor = derived[idx];
      signals.push({
        id: `act-one-overrun:${anchor.scene.headingBlockId}`,
        kind: 'act-one-overrun',
        tier: 'A',
        sceneHeadingBlockId: anchor.scene.headingBlockId,
        sceneNumber: anchor.sceneNumber,
        label: 'STRUCTURE',
        message: `Act I is running ~${Math.round(actOneEndPage)}pg. Most features hit the act break around p.25-30.`,
        askPrompt: `My Act I runs ${Math.round(actOneEndPage)} pages. What's slowing me down getting into Act II?`,
      });
    }
  }

  // ── Rule 5: Silent scene (>1.5pg, zero dialogue) — ask, don't assert ──
  for (const d of derived) {
    if (d.pages >= 1.5 && d.dialogueBlocks.length === 0 && d.totalWords >= 40) {
      signals.push({
        id: `silent:${d.scene.headingBlockId}`,
        kind: 'silent-scene',
        tier: 'B',
        sceneHeadingBlockId: d.scene.headingBlockId,
        sceneNumber: d.sceneNumber,
        label: 'CRAFT',
        message: `No dialogue in a ${d.pages.toFixed(1)}pg scene. Intentional silence, or missing a beat?`,
        askPrompt: `Scene ${d.sceneNumber} is all action, no dialogue. Is the silence doing work, or am I avoiding something?`,
      });
    }
  }

  // ── Rule 6: Wall of dialogue (single block >55 words) ──
  for (const d of derived) {
    for (const b of d.dialogueBlocks) {
      const words = countWords(b.text);
      if (words >= 55) {
        signals.push({
          id: `wall:${d.scene.headingBlockId}:${b.id}`,
          kind: 'wall-of-dialogue',
          tier: 'B',
          sceneHeadingBlockId: d.scene.headingBlockId,
          sceneNumber: d.sceneNumber,
          label: 'DIALOGUE',
          message: `One speech is ${words} words. Can any of it become action?`,
          askPrompt: `There's a ${words}-word speech in scene ${d.sceneNumber}. What can become action or silence?`,
        });
        break; // one wall flag per scene
      }
    }
  }

  // ── Rule 7: Orphan heading (<3 content blocks and not last scene) ──
  for (let i = 0; i < derived.length - 1; i++) {
    const d = derived[i];
    if (d.contentBlocks.length < 3 && d.totalWords < 15) {
      signals.push({
        id: `orphan:${d.scene.headingBlockId}`,
        kind: 'orphan-heading',
        tier: 'B',
        sceneHeadingBlockId: d.scene.headingBlockId,
        sceneNumber: d.sceneNumber,
        label: 'EMPTY',
        message: `Scene with almost no content. Placeholder or a moment you're avoiding?`,
        askPrompt: `Scene ${d.sceneNumber} is nearly empty. What belongs here?`,
      });
    }
  }

  // Cap: max 2 signals per scene (most severe: tier A wins)
  const perScene = new Map<string, Signal[]>();
  for (const s of signals) {
    const arr = perScene.get(s.sceneHeadingBlockId) ?? [];
    arr.push(s);
    perScene.set(s.sceneHeadingBlockId, arr);
  }
  const capped: Signal[] = [];
  for (const [, arr] of perScene) {
    arr.sort((a, b) => (a.tier === 'A' ? -1 : 1) - (b.tier === 'A' ? -1 : 1));
    capped.push(...arr.slice(0, 2));
  }

  return capped;
}

// ── Content hash for caching ──
// Scenes whose content hasn't changed don't need re-detection.
export function hashScene(blocks: Block[]): string {
  let h = 0;
  for (const b of blocks) {
    const str = b.type + ':' + b.text;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return String(h);
}

export function hashDocByScene(doc: Doc): Map<string, string> {
  const scenes = deriveScenes(doc.blocks);
  const map = new Map<string, string>();
  for (const scene of scenes) {
    const blocks = doc.blocks.slice(scene.startIndex, scene.endIndex + 1);
    map.set(scene.headingBlockId, hashScene(blocks));
  }
  return map;
}
