export interface Character {
  id: string;
  name: string;
  essence: string;
  spark: string;
  color: string;
  role: string;
}

// The 8 dimensions of character — synthesized from McKee, Chubbuck, Egri, Weiland, Jung
export type DimensionId =
  | 'wound'
  | 'lie'
  | 'drive'
  | 'mask'
  | 'voice'
  | 'body'
  | 'relationships'
  | 'arc';

export interface Dimension {
  id: DimensionId;
  label: string;
  sketchLabel: string;
  questionCount: number; // variable per dimension
}

export const DIMENSIONS: Dimension[] = [
  { id: 'wound', label: 'The Wound', sketchLabel: 'What broke them before page one', questionCount: 4 },
  { id: 'lie', label: 'The Lie', sketchLabel: 'The false belief they live by', questionCount: 3 },
  { id: 'drive', label: 'The Drive', sketchLabel: 'What they need from life more than anything', questionCount: 4 },
  { id: 'mask', label: 'The Mask', sketchLabel: 'Who they pretend to be', questionCount: 3 },
  { id: 'voice', label: 'The Voice', sketchLabel: 'How they speak and what they can\'t say', questionCount: 4 },
  { id: 'body', label: 'The Body', sketchLabel: 'How they inhabit space', questionCount: 3 },
  { id: 'relationships', label: 'The Relationships', sketchLabel: 'Who they can\'t leave and why', questionCount: 4 },
  { id: 'arc', label: 'The Arc', sketchLabel: 'Where they begin and what it costs to change', questionCount: 3 },
];

export const TOTAL_QUESTIONS = DIMENSIONS.reduce((sum, d) => sum + d.questionCount, 0); // 28

export interface QuestionOption {
  id: string;
  text: string;
}

export interface KleoSuggestion {
  answer: string;
  reasoning: string;
  source?: string; // which book/framework this draws from
}

// 'open' = typing prompt (no options), 'guided' = options + write your own, 'reveal' = system reflects back
export type QuestionMode = 'open' | 'guided' | 'reveal';

export interface DimensionQuestion {
  dimension: DimensionId;
  dimensionLabel: string;
  question: string;
  mode: QuestionMode;
  options: QuestionOption[]; // empty for 'open' mode
  kleo: KleoSuggestion;
  questionIndex: number; // position within dimension (0, 1, ...)
  totalQuestionsInDimension: number;
}

// What Kleo surfaces when she spots a contradiction
export interface ContradictionInsight {
  observation: string; // "You said X but also Y. That tension is gold."
  question: string; // The question that explores the contradiction
}

export interface DimensionAnswer {
  dimension: DimensionId;
  dimensionLabel: string;
  questionText: string;
  chosenText: string;
  sketchLine: string; // one-line summary for the live sketch
  wasKleoAssisted: boolean;
  questionIndex: number; // which question within the dimension
}

export interface CharacterPortrait {
  name: string;
  essence: string;
  dimensions: Record<DimensionId, string>;
  prose: string;
  unansweredQuestion: string;
}

export interface StorySession {
  logline: string;
  characters: Character[];
  explorations: Record<string, DimensionAnswer[]>;
  portraits: Record<string, CharacterPortrait>;
}

// ─── Screenplay Editor types ───

export type ScreenplayElementType =
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'dual-start'    // marks start of dual dialogue block
  | 'dual-end';     // marks end of dual dialogue block

export interface ScreenplayElement {
  id: string;
  type: ScreenplayElementType;
  text: string;
  note?: string;     // script note attached to this element
  dual?: 'left' | 'right'; // which side of dual dialogue
  revised?: boolean; // revision mark (asterisk in margin)
  bookmark?: string; // bookmark label
}

export interface ScreenplayScene {
  id: string;
  heading: string;
  elements: ScreenplayElement[];
  color?: string; // scene color coding (sidebar dot)
}

export interface TitlePage {
  title: string;
  credit: string;     // "Written by" or "Screenplay by"
  author: string;
  source: string;     // "Based on..."
  draftDate: string;
  contact: string;
}

export interface Screenplay {
  sessionId: string;
  title: string;
  titlePage?: TitlePage;
  scenes: ScreenplayScene[];
  createdAt: number;
  updatedAt: number;
}
