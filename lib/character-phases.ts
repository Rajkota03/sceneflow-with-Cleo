// ─── Character Builder: Phase & Question Schema ───
// Synthesized from Egri, Weiland, Chubbuck, Jung, McKee

export type QuestionType = 'short' | 'long' | 'scene' | 'choice' | 'multi';
export type SourceAuthor = 'Egri' | 'Weiland' | 'Chubbuck' | 'Jung' | 'McKee';

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  hint?: string;
  placeholder?: string;
  options?: string[];
}

export interface Phase {
  id: string;
  num: string;
  title: string;
  quote: string;
  source: SourceAuthor;
  description: string;
  feedsInto?: string; // which phase this connects to
  dependsOn?: string[]; // which phase answers inform this one
  contextKeys?: string[]; // answer IDs from other phases to show as hints
  questions: Question[];
}

export const PHASES: Phase[] = [
  // ─── PHASE 01: WHO ARE YOU? ───
  {
    id: 'identity',
    num: '01',
    title: 'Who Are You?',
    quote: 'All human action springs from insecurity.',
    source: 'Egri',
    description: 'The surface layer — but surface reveals depth. How they move through the world tells us everything about what moves inside them.',
    feedsInto: 'wound',
    questions: [
      {
        id: 'name',
        label: "Character's name",
        type: 'short',
        hint: 'First name, full name, or the name that matters.',
      },
      {
        id: 'age',
        label: 'Age — and what does this age MEAN to them?',
        type: 'long',
        hint: 'Too young for what life demands? Too old for what they want?',
      },
      {
        id: 'first_impression',
        label: 'A stranger sees them enter a room. One detail sticks.',
        type: 'long',
        hint: "Not a police sketch. The thing you can't un-see.",
      },
      {
        id: 'body_relationship',
        label: 'Their relationship with their own body.',
        type: 'long',
        hint: 'Comfortable? Ashamed? A weapon? Do they take up space or vanish?',
      },
      {
        id: 'class_experience',
        label: 'Their daily experience of money.',
        type: 'long',
        hint: 'Not income bracket. Do they check prices? Tip to perform? Hoard?',
      },
      {
        id: 'family',
        label: "Who raised them? Who's missing?",
        type: 'long',
        hint: 'Every person here shaped a belief they still carry.',
      },
      {
        id: 'intelligence',
        label: 'What kind of smart?',
        type: 'choice',
        options: [
          'Street smart',
          'Book smart',
          'Emotionally sharp',
          'Strategically cunning',
          'Mechanically gifted',
          'Creatively wired',
          'Survival smart',
        ],
      },
      {
        id: 'insecurity',
        label: "The one thing about themselves they'd surgically remove.",
        type: 'long',
        hint: 'Egri: ALL action springs from insecurity. What\'s theirs?',
      },
      {
        id: 'importance_strategy',
        label: 'How do they make themselves feel important?',
        type: 'choice',
        options: [
          'Money/status display',
          'Humor & charm',
          'Knowledge & expertise',
          'Generosity (buying love)',
          'Cruelty (fear = respect)',
          'Humility as performance',
          'Withdrawal (mystery)',
          'Service to others',
        ],
      },
    ],
  },

  // ─── PHASE 02: THE WOUND & THE LIE ───
  {
    id: 'wound',
    num: '02',
    title: 'The Wound & The Lie',
    quote: "Find the reason, and you'll find the Ghost.",
    source: 'Weiland',
    description: 'The engine room. Everything — every choice, every relationship, every fear — traces back to this. The Wound creates the Lie, and the Lie runs their life.',
    dependsOn: ['identity'],
    contextKeys: ['insecurity', 'importance_strategy'],
    feedsInto: 'drive',
    questions: [
      {
        id: 'ghost',
        label: 'What happened to them?',
        type: 'long',
        hint: 'The event — or slow erosion — that broke something inside.',
      },
      {
        id: 'ghost_age',
        label: 'How old? Who caused it?',
        type: 'long',
        hint: 'The younger the wound, the deeper the roots.',
      },
      {
        id: 'ghost_awareness',
        label: 'Do they know they\'re wounded?',
        type: 'choice',
        options: [
          "Completely buried — they'd deny it",
          'Intellectualized into a "lesson learned"',
          'They wear it openly as armor',
          "They know but can't face it",
          "They think they've healed (they haven't)",
        ],
      },
      {
        id: 'lie',
        label: 'The Lie. One sentence. The false conclusion about life.',
        type: 'long',
        placeholder: 'Because of what happened, they believe...',
      },
      {
        id: 'lie_daily',
        label: 'How does the Lie show up in SMALL daily decisions?',
        type: 'long',
        hint: 'How they answer the phone. How they react to unexpected kindness.',
      },
      {
        id: 'lie_symptoms',
        label: 'The smoke signals. Pick all that apply.',
        type: 'multi',
        options: [
          'Fear',
          'Inability to forgive',
          'Guilt',
          'Shame',
          'Horrible secrets',
          'Extreme hurt',
          'Self-sabotage',
          'Control obsession',
          'People-pleasing',
          'Isolation',
        ],
      },
    ],
  },

  // ─── PHASE 03: WANT VS. NEED ───
  {
    id: 'drive',
    num: '03',
    title: 'Want vs. Need',
    quote: 'Emotions are a reaction to an action, not the other way around.',
    source: 'Chubbuck',
    description: 'The Want extends the Lie. The Need contradicts it. Your entire story lives in the collision between these two forces.',
    dependsOn: ['wound'],
    contextKeys: ['lie', 'ghost'],
    feedsInto: 'shadow',
    questions: [
      {
        id: 'want',
        label: 'What do they think will fix their life? Be specific.',
        type: 'long',
        hint: 'Not "happiness." The promotion. The girl. The land. The revenge.',
      },
      {
        id: 'want_urgency',
        label: 'Why NOW?',
        type: 'long',
        hint: 'What ticking clock forces this into the present moment?',
      },
      {
        id: 'overall_objective',
        label: "Their primal mission. Phrase it like Chubbuck.",
        type: 'long',
        hint: '"To be loved without pain." "To get my power back."',
        placeholder: 'To...',
      },
      {
        id: 'need',
        label: 'What do they ACTUALLY need?',
        type: 'long',
        hint: 'Usually incorporeal. Should directly contradict the Lie.',
      },
      {
        id: 'need_blind',
        label: "Why can't they see it?",
        type: 'long',
        hint: "What blocks their self-awareness?",
      },
      {
        id: 'collision',
        label: 'The moment Want and Need collide. What happens?',
        type: 'long',
        hint: 'This is usually the climax. What do they sacrifice?',
      },
    ],
  },

  // ─── PHASE 04: THE SHADOW ───
  {
    id: 'shadow',
    num: '04',
    title: 'The Shadow',
    quote: 'The shadow usually contains values that are needed by consciousness.',
    source: 'Jung',
    description: 'What they repress is what they need. The shadow contains the wound\'s opposite — the quality that could heal them, if they could face it.',
    dependsOn: ['wound', 'drive'],
    contextKeys: ['lie', 'need', 'ghost'],
    feedsInto: 'contradiction',
    questions: [
      {
        id: 'shadow_projection',
        label: 'What disgusts them in OTHER people — but lives in them too?',
        type: 'long',
        hint: "Jung: Intense irritation at others reveals what we've repressed.",
      },
      {
        id: 'shadow_eruption',
        label: 'A specific moment the shadow erupted.',
        type: 'long',
        hint: 'The impulsive remark, the plot hatched, the wrong decision before thinking.',
      },
      {
        id: 'shadow_gold',
        label: 'What valuable quality is buried in the shadow?',
        type: 'long',
        hint: 'The repressed trait that could actually SAVE them.',
      },
      {
        id: 'parent_voice',
        label: 'Which parent\'s voice do they hear at 3am?',
        type: 'long',
        hint: 'What phrase does that voice repeat? That phrase runs their life.',
      },
      {
        id: 'persona_mask',
        label: 'The mask they wear for the world.',
        type: 'long',
        hint: 'The gap between performance and reality. How exhausting is it?',
      },
      {
        id: 'mask_slip',
        label: 'When does it slip? What does the world see?',
        type: 'long',
        hint: 'What triggers the slip?',
      },
    ],
  },

  // ─── PHASE 05: THE CONTRADICTION ───
  {
    id: 'contradiction',
    num: '05',
    title: 'The Contradiction',
    quote: 'Only a corpse exists without contradiction.',
    source: 'Egri',
    description: 'The paradox makes them human. It should be load-bearing — generating actual scenes, not just describing personality.',
    dependsOn: ['wound', 'shadow'],
    contextKeys: ['ghost', 'shadow_projection', 'shadow_gold'],
    feedsInto: 'voice',
    questions: [
      {
        id: 'paradox',
        label: "Two things true about them that shouldn't both be true.",
        type: 'long',
        hint: 'The violent man tender with animals. The generous woman emotionally stingy.',
      },
      {
        id: 'paradox_source',
        label: 'How does this connect to the wound?',
        type: 'long',
        hint: 'Not random. A consequence of how the wound distorted development.',
      },
      {
        id: 'change_verdict',
        label: 'Do they change?',
        type: 'choice',
        options: [
          'Surface changes, core drive stays (Egri)',
          'Genuine transformation through crisis',
          'They dig deeper into the Lie (negative arc)',
          'They change others without changing (flat arc)',
        ],
      },
      {
        id: 'granite',
        label: 'What in them is absolutely granite? Unchangeable?',
        type: 'long',
        hint: 'Egri: The drive to be important never changes. Only the method changes.',
      },
    ],
  },

  // ─── PHASE 06: THE VOICE ───
  {
    id: 'voice',
    num: '06',
    title: 'The Voice',
    quote: 'Nothing betrays personality as much as a character\'s choice of words.',
    source: 'McKee',
    description: 'The acid test. If another character in your story could say these words — you haven\'t found the voice yet.',
    dependsOn: ['identity', 'wound', 'contradiction'],
    contextKeys: ['intelligence', 'class_experience', 'paradox'],
    feedsInto: 'texture',
    questions: [
      {
        id: 'vocabulary_world',
        label: 'What world do their words come from?',
        type: 'long',
        hint: 'McKee: Nouns/verbs reveal knowledge. Precise naming vs. vagueness?',
      },
      {
        id: 'cultural_references',
        label: 'What films, songs, proverbs, slang live inside them?',
        type: 'long',
        hint: 'McKee: Culture is our dominant source of expression.',
      },
      {
        id: 'speech_pressure',
        label: 'How does speech change under pressure?',
        type: 'choice',
        options: [
          'Talk floods out',
          'Goes dead silent',
          'Gets clipped and controlled',
          'Switches to humor/deflection',
          'Switches languages',
          'Gets formal and distant',
          'Gets raw and vulgar',
        ],
      },
      {
        id: 'code_switch',
        label: 'How they speak with mother vs. boss vs. lover vs. enemy.',
        type: 'long',
        hint: 'For Telugu characters: Telugu = emotion, rootedness. English = control, distance.',
      },
      {
        id: 'verbal_tell',
        label: 'The ONE verbal habit that\'s uniquely theirs.',
        type: 'short',
        hint: 'A pet phrase. A throat-clear before lying. A word they overuse.',
      },
      {
        id: 'voice_sample',
        label: '3\u20134 lines ONLY this character could say.',
        type: 'scene',
        hint: "The acid test. If anyone else could say this \u2014 not specific enough.",
      },
    ],
  },

  // ─── PHASE 07: THE TEXTURE ───
  {
    id: 'texture',
    num: '07',
    title: 'The Texture',
    quote: 'Environment is the ruthless Caesar of man.',
    source: 'Egri',
    description: 'The sensory details that make a character walk off the page. Not backstory — the present-tense details you can put in a scene.',
    dependsOn: ['identity', 'wound'],
    contextKeys: ['ghost', 'family', 'class_experience'],
    feedsInto: 'pressure',
    questions: [
      {
        id: 'alone_ritual',
        label: 'What do they do when completely alone?',
        type: 'long',
        hint: 'The thing no one sees.',
      },
      {
        id: 'before_sleep',
        label: 'Last thought before sleep.',
        type: 'short',
        hint: 'The preoccupation held back all day.',
      },
      {
        id: 'fire_object',
        label: "One possession they'd save in a fire.",
        type: 'short',
      },
      {
        id: 'food',
        label: 'Relationship with food.',
        type: 'choice',
        options: [
          'Eat to live',
          'Live to eat',
          'Emotional eating',
          'Forget to eat',
          'Cook for others (love language)',
          'Only eat alone',
          'Control through restriction',
        ],
      },
      {
        id: 'childhood_trigger',
        label: 'A specific childhood detail that still haunts ordinary moments.',
        type: 'long',
        hint: 'A smell, a sound, a phrase. Something you can PUT IN A SCENE.',
      },
      {
        id: 'community_weight',
        label: 'What does their world expect? Where does it crush them?',
        type: 'long',
        hint: 'Family, caste, gender, community. Gap between social role and inner self.',
      },
      {
        id: 'geography',
        label: 'How does their specific PLACE shape them?',
        type: 'long',
        hint: 'Dust, heat, market sounds. What if you transplanted them?',
      },
    ],
  },

  // ─── PHASE 08: THE PRESSURE TEST ───
  {
    id: 'pressure',
    num: '08',
    title: 'The Pressure Test',
    quote: 'Use emotions as a tool to provide the passion to overcome conflict.',
    source: 'Chubbuck',
    description: 'The final exam. Strip away the safety net and see what\'s left. A character who survives this is ready for your story.',
    dependsOn: ['wound', 'drive', 'contradiction'],
    contextKeys: ['lie', 'want', 'need', 'paradox'],
    questions: [
      {
        id: 'crutch_removed',
        label: 'Their biggest crutch is gone. First 30 seconds?',
        type: 'long',
        hint: 'The reaction IS the character.',
      },
      {
        id: 'corner_response',
        label: 'Cornered: fight, flee, freeze, or manipulate?',
        type: 'choice',
        options: [
          'Fight \u2014 always',
          'Flee \u2014 always',
          'Freeze then calculate',
          'Manipulate (charm/scheme)',
          'Depends on WHO cornered them',
          'Submit then plot revenge',
        ],
      },
      {
        id: 'uncrossable_line',
        label: "The one line they won't cross.",
        type: 'long',
      },
      {
        id: 'cross_it',
        label: 'What would make them cross it?',
        type: 'long',
        hint: 'This is where your story lives.',
      },
      {
        id: 'power_full',
        label: 'Behavior when they have ALL the power.',
        type: 'long',
      },
      {
        id: 'power_none',
        label: 'Behavior when they have NONE.',
        type: 'long',
      },
      {
        id: 'orchestration',
        label: "Who is their OPPOSITE? Why can't they walk away?",
        type: 'long',
        hint: 'Egri: Militant opposites in an unbreakable bond.',
      },
      {
        id: 'arc_sentence',
        label: '"[Name] starts believing _____ and by the end, _____."',
        type: 'long',
        hint: 'If unchanged = no story. If too neat = a lie.',
      },
      {
        id: 'audience_why',
        label: 'Why should anyone spend 2 hours with them?',
        type: 'choice',
        options: [
          'Recognition \u2014 "I am this person"',
          'Fascination \u2014 "I can\'t look away"',
          'Fear \u2014 "I could become this person"',
          'Tenderness \u2014 "I want to protect them"',
          'Awe \u2014 "I wish I could be brave like them"',
        ],
      },
    ],
  },
];

export const ALL_QUESTION_IDS = PHASES.flatMap(p => p.questions.map(q => q.id));
export const TOTAL_QUESTIONS = ALL_QUESTION_IDS.length;

export function getPhaseById(id: string): Phase | undefined {
  return PHASES.find(p => p.id === id);
}

export function getQuestionById(questionId: string): { phase: Phase; question: Question } | undefined {
  for (const phase of PHASES) {
    const q = phase.questions.find(q => q.id === questionId);
    if (q) return { phase, question: q };
  }
  return undefined;
}

/** Get relevant answers from other phases to show as context hints */
export function getPhaseContextHints(
  phaseId: string,
  answers: Record<string, string | string[]>,
): Array<{ questionId: string; label: string; value: string }> {
  const phase = getPhaseById(phaseId);
  if (!phase?.contextKeys) return [];

  const hints: Array<{ questionId: string; label: string; value: string }> = [];
  for (const key of phase.contextKeys) {
    const val = answers[key];
    if (!val || (typeof val === 'string' && !val.trim())) continue;
    const found = getQuestionById(key);
    if (!found) continue;
    const displayVal = typeof val === 'string' ? val : val.join(', ');
    if (displayVal.length > 0) {
      hints.push({ questionId: key, label: found.question.label, value: displayVal });
    }
  }
  return hints;
}

export function getPhaseCompletionCount(
  phaseId: string,
  answers: Record<string, string | string[]>,
): number {
  const phase = getPhaseById(phaseId);
  if (!phase) return 0;
  return phase.questions.filter(q => {
    const val = answers[q.id];
    if (!val) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    return val.length > 0;
  }).length;
}
