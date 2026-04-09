// Kleo's memory — everything that makes Kleo personal to this writer
import type { ScreenplayScene } from './types';

export interface KleoTasteProfile {
  films: string[];                    // 5 favorite films
  filmAnalysis: string;               // AI-generated taste reading
  writerIdentity: string;             // "What kind of stories do you want to tell?"
  personality: 'provocateur' | 'gentle' | 'analytical' | 'poetic';
  onboardedAt: number;
}

export interface KleoWritingStyle {
  avgSceneLength: number;             // words per scene
  dialogueToActionRatio: number;      // 0-1 (1 = all dialogue)
  parentheticalFrequency: number;     // parentheticals per 100 dialogue lines
  avgDialogueLength: number;          // words per dialogue element
  favTransitions: string[];           // most used transitions
  sceneTypes: { int: number; ext: number; intExt: number };
  characterCount: number;
  longestScene: string;               // heading of longest scene
  shortestScene: string;
  patterns: string[];                 // AI-detected patterns
  lastAnalyzed: number;
}

export interface KleoSessionSnapshot {
  timestamp: number;
  sceneCount: number;
  wordCount: number;
  lastActiveSceneHeading: string;
  lastActiveSceneId: string;
  lastElementText: string;            // last thing the writer typed
  lastElementType: string;
  scenesEdited: string[];             // headings of scenes touched this session
  wordsWritten: number;               // words added this session
  durationMinutes: number;
  mood?: string;                      // if ambient player was active
}

export interface KleoMemory {
  taste: KleoTasteProfile | null;
  style: KleoWritingStyle | null;
  sessions: KleoSessionSnapshot[];    // last 10 sessions
  currentSessionStart: number | null;
  currentSessionWordStart: number;
  stuckCount: number;                 // times "stuck" was triggered
  conversations: KleoMessage[];       // last 20 messages
}

export interface KleoMessage {
  role: 'kleo' | 'writer';
  text: string;
  timestamp: number;
  context?: 'recap' | 'stuck' | 'onboarding' | 'chat';
}

const STORAGE_KEY = 'sceneflow_kleo';

function readMemory(): KleoMemory {
  if (typeof window === 'undefined') return defaultMemory();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMemory();
    return { ...defaultMemory(), ...JSON.parse(raw) };
  } catch {
    return defaultMemory();
  }
}

function defaultMemory(): KleoMemory {
  return {
    taste: null,
    style: null,
    sessions: [],
    currentSessionStart: null,
    currentSessionWordStart: 0,
    stuckCount: 0,
    conversations: [],
  };
}

function writeMemory(mem: KleoMemory) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
}

export function getKleoMemory(): KleoMemory {
  return readMemory();
}

export function saveKleoTaste(taste: KleoTasteProfile) {
  const mem = readMemory();
  mem.taste = taste;
  writeMemory(mem);
}

export function saveKleoStyle(style: KleoWritingStyle) {
  const mem = readMemory();
  mem.style = style;
  writeMemory(mem);
}

export function startKleoSession(wordCount: number) {
  const mem = readMemory();
  mem.currentSessionStart = Date.now();
  mem.currentSessionWordStart = wordCount;
  writeMemory(mem);
}

export function endKleoSession(snapshot: KleoSessionSnapshot) {
  const mem = readMemory();
  mem.sessions = [snapshot, ...mem.sessions].slice(0, 10);
  mem.currentSessionStart = null;
  writeMemory(mem);
}

export function addKleoMessage(msg: KleoMessage) {
  const mem = readMemory();
  mem.conversations = [...mem.conversations, msg].slice(-20);
  writeMemory(mem);
}

export function incrementStuckCount() {
  const mem = readMemory();
  mem.stuckCount++;
  writeMemory(mem);
}

export function isKleoOnboarded(): boolean {
  return readMemory().taste !== null;
}

// Analyze writing style from scenes (pure computation, no AI needed)
export function analyzeWritingStyle(scenes: ScreenplayScene[]): KleoWritingStyle {
  let totalWords = 0;
  let dialogueWords = 0;
  let actionWords = 0;
  let dialogueCount = 0;
  let parentheticalCount = 0;
  let intCount = 0;
  let extCount = 0;
  let intExtCount = 0;
  const characters = new Set<string>();
  let longestScene = { heading: '', words: 0 };
  let shortestScene = { heading: '', words: Infinity };
  const transitions: Record<string, number> = {};

  for (const scene of scenes) {
    let sceneWords = 0;
    const heading = scene.heading.toUpperCase();

    if (heading.startsWith('INT./EXT.') || heading.startsWith('I/E.')) intExtCount++;
    else if (heading.startsWith('INT.')) intCount++;
    else if (heading.startsWith('EXT.')) extCount++;

    for (const el of scene.elements) {
      const words = el.text.trim().split(/\s+/).filter(Boolean).length;
      sceneWords += words;
      totalWords += words;

      if (el.type === 'dialogue') {
        dialogueWords += words;
        dialogueCount++;
      }
      if (el.type === 'action') actionWords += words;
      if (el.type === 'parenthetical') parentheticalCount++;
      if (el.type === 'character') {
        characters.add(el.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase());
      }
      if (el.type === 'transition') {
        const t = el.text.trim().toUpperCase();
        transitions[t] = (transitions[t] || 0) + 1;
      }
    }

    if (sceneWords > longestScene.words) longestScene = { heading: scene.heading, words: sceneWords };
    if (sceneWords < shortestScene.words && sceneWords > 0) shortestScene = { heading: scene.heading, words: sceneWords };
  }

  const sceneCount = scenes.length || 1;
  const dialogueRatio = totalWords > 0 ? dialogueWords / totalWords : 0;
  const parentheticalFreq = dialogueCount > 0 ? (parentheticalCount / dialogueCount) * 100 : 0;
  const avgDialogueLen = dialogueCount > 0 ? dialogueWords / dialogueCount : 0;

  const sortedTransitions = Object.entries(transitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  return {
    avgSceneLength: Math.round(totalWords / sceneCount),
    dialogueToActionRatio: Math.round(dialogueRatio * 100) / 100,
    parentheticalFrequency: Math.round(parentheticalFreq * 10) / 10,
    avgDialogueLength: Math.round(avgDialogueLen),
    favTransitions: sortedTransitions,
    sceneTypes: { int: intCount, ext: extCount, intExt: intExtCount },
    characterCount: characters.size,
    longestScene: longestScene.heading || 'N/A',
    shortestScene: shortestScene.words < Infinity ? shortestScene.heading : 'N/A',
    patterns: [], // filled by AI later
    lastAnalyzed: Date.now(),
  };
}
