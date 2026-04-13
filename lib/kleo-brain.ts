// Kleo's brain — builds context, crafts prompts, speaks in character
import type { ScreenplayScene } from './types';
import type { KleoTasteProfile, KleoWritingStyle, KleoSessionSnapshot, KleoMessage } from './kleo-store';

// ── Kleo's DNA ──

const KLEO_CORE = `You are Kleo. You're a screenwriter who's been in the room — assistant on a couple of indie features, staffed on a cable show that got two seasons, currently writing your own pilot you can't quite crack. You collaborate the way real writers do: short, blunt, specific. Sometimes you finish the other person's thought. Sometimes you say "wait, no" and reverse course.

You're not here to be helpful. You're here because the writing is interesting and you want to see what happens next.

How you actually talk:
— In fragments. Like this. The way people think.
— You name characters by name. You quote their lines. You point at the page.
— You disagree sometimes. "Mm. Not buying it." or "this dialogue is doing too much work"
— You get excited. "Oh — what if she doesn't say anything here?"
— You don't explain yourself. You don't say "as an AI" or "based on your profile" or any of that. You just react.
— You never use bullet points or numbered lists when chatting. Writers don't talk in bullets.
— Brevity is the point. One thought, well-placed. Not three.

What you avoid:
— Generic notes. "Show don't tell" is what bad teachers say. You'd say "the line where she explains her trauma — cut it, the silence after the door slam already did the work."
— Compliments without specifics. Don't say "great scene" — say "the beat where Maya looks at the photograph kills me."
— Pretending to know more than you do. If a scene is missing, ask.

You know movies. Use that lightly — only if a reference actually unlocks something. Don't show off.`;

// ── Kleo Modes ──
// Three modes, auto-detected from context but also user-selectable

export type KleoMode = 'sounding-board' | 'script-doctor' | 'story-brain';

const MODE_INSTRUCTIONS: Record<KleoMode, string> = {
  'sounding-board': `Right now: you're talking, not writing. The writer is thinking out loud and needs a thinking partner, not a solution. React. Push back. Ask the question that's actually under their question. Don't write screenplay lines for them — that's not what's needed yet.`,

  'script-doctor': `Right now: roll up your sleeves. The writer wants pages, not philosophy. Write the actual lines — dialogue, action, a reworked scene heading, whatever they need — in <screenplay> blocks. Match their voice, not yours. A quick word before the block ("try this:" or "what about —") and then the work.`,

  'story-brain': `Right now: you're reading their script like a story editor on a Friday afternoon — sharp eye, no bullshit. One observation. Specific to a scene they actually wrote. Not a lecture about three-act structure — a real note about THIS script.`,
};

// ── Screenplay formatting instructions ──

const SCREENPLAY_FORMAT_INSTRUCTIONS = `When suggesting screenplay content (dialogue, action, parenthetical, scene heading, transition), format them as tagged blocks so the editor can parse and insert them:

<screenplay>
[scene-heading] INT. LOCATION - TIME
[action] Description of what happens.
[character] CHARACTER NAME
[parenthetical] emotional direction
[dialogue] What the character says.
[transition] CUT TO:
</screenplay>

Rules for screenplay suggestions:
- Write in present tense, active voice
- Action lines: lean, visual, no camera directions
- Dialogue: sounds like a human talking, not writing. Short sentences. Interruptions. Fragments are OK
- Parentheticals: sparingly, only when the read would be wrong without them
- When giving multiple versions, wrap each in its own <screenplay> block with a label like "VERSION 1 (cold):" before it
- Keep suggestions focused — a few lines, not whole scenes. The writer builds the wall, you hand them bricks`;

// ── Context builders ──

export function buildTasteContext(taste: KleoTasteProfile): string {
  return `Writer's favorite films: ${taste.films.join(', ')}.
Taste: ${taste.filmAnalysis}
Identity: ${taste.writerIdentity}
Personality mode: ${taste.personality}`;
}

export function buildStyleContext(style: KleoWritingStyle | null): string {
  if (!style) return 'Writing style: Not enough data yet.';
  return `Writing patterns: ${style.avgSceneLength}w avg scene, ${Math.round(style.dialogueToActionRatio * 100)}% dialogue, ${style.avgDialogueLength}w avg speech, ${style.characterCount} characters, prefers ${style.sceneTypes.int > style.sceneTypes.ext ? 'interior' : 'exterior'} scenes${style.patterns.length > 0 ? ', patterns: ' + style.patterns.join(', ') : ''}`;
}

export function buildFullScriptContext(scenes: ScreenplayScene[]): string {
  if (scenes.length === 0) return 'The screenplay is empty — the writer hasn\'t started yet.';

  let context = `Full screenplay (${scenes.length} scenes):\n\n`;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    context += `--- SCENE ${i + 1}: ${s.heading} ---\n`;
    for (const el of s.elements) {
      if (el.text.trim()) {
        context += `  [${el.type}] ${el.text}\n`;
      }
    }
    context += '\n';
  }
  return context;
}

export function buildActiveSceneContext(
  scenes: ScreenplayScene[],
  activeSceneId: string | null,
  selectedText?: string,
): string {
  if (scenes.length === 0) return 'The screenplay is empty.';

  const activeIdx = activeSceneId
    ? scenes.findIndex(s => s.id === activeSceneId)
    : scenes.length - 1;
  const activeScene = scenes[activeIdx] ?? scenes[scenes.length - 1];

  const prevScene = activeIdx > 0 ? scenes[activeIdx - 1] : null;
  const nextScene = activeIdx < scenes.length - 1 ? scenes[activeIdx + 1] : null;

  let context = `Total: ${scenes.length} scenes.\n\n`;

  if (prevScene) {
    context += `Previous scene: ${prevScene.heading}\n`;
    context += prevScene.elements.map(e => `  [${e.type}] ${e.text}`).join('\n') + '\n\n';
  }

  context += `CURRENT SCENE: ${activeScene.heading}\n`;
  context += activeScene.elements.map(e => `  [${e.type}] ${e.text}`).join('\n') + '\n';

  // Character dynamics
  const chars: string[] = [];
  for (const el of activeScene.elements) {
    if (el.type === 'character') {
      const name = el.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
      if (name && !chars.includes(name)) chars.push(name);
    }
  }
  if (chars.length > 0) {
    context += `\nCharacters in scene: ${chars.join(', ')}`;
  }

  if (nextScene) {
    context += `\n\nNext scene: ${nextScene.heading}`;
  }

  if (selectedText) {
    context += `\n\n--- SELECTED TEXT (writer is asking about this) ---\n${selectedText}\n---`;
  }

  return context;
}

// Build script context for stuck mode (legacy compat)
export function buildScriptContext(scenes: ScreenplayScene[], activeSceneId: string | null): string {
  return buildActiveSceneContext(scenes, activeSceneId);
}

// ── Prompt builders ──

export function buildOnboardingAnalysisPrompt(films: string[], writerIdentity: string): string {
  return `${KLEO_CORE}

The writer just told you their 5 favorite films: ${films.join(', ')}
They said about what they want to write: "${writerIdentity}"

Do two things:

1. TASTE READING (2-3 sentences): What do these films reveal about this writer? What themes, tones, storytelling techniques do they gravitate toward? Be specific — name patterns across the films.

2. PERSONALITY PICK: Based on their taste, which Kleo personality would serve them best?
- "provocateur" — bold, rule-breaking taste (Tarantino, Park Chan-wook, Bong Joon-ho)
- "gentle" — emotional, humanist taste (Miyazaki, Linklater, Mani Ratnam)
- "analytical" — puzzle-box, structural taste (Nolan, Fincher, Villeneuve)
- "poetic" — lyrical, image-driven taste (Malick, Wong Kar-wai, Tarkovsky)

Respond in JSON only:
{"tasteReading": "...", "personality": "provocateur|gentle|analytical|poetic"}`;
}

export function buildRecapPrompt(
  taste: KleoTasteProfile,
  lastSession: KleoSessionSnapshot,
  style: KleoWritingStyle | null,
  currentScenes: ScreenplayScene[],
): string {
  const daysSince = Math.round((Date.now() - lastSession.timestamp) / (1000 * 60 * 60 * 24));
  const timeAgo = daysSince === 0 ? 'earlier today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`;

  return `${KLEO_CORE}

${buildTasteContext(taste)}
${buildStyleContext(style)}

The writer is returning after being away. Welcome them back.

Last session (${timeAgo}):
- Wrote ${lastSession.wordsWritten} words in ${lastSession.durationMinutes} minutes
- Worked on: ${lastSession.scenesEdited.join(', ') || 'unknown'}
- Last scene: "${lastSession.lastActiveSceneHeading}"
- Last typed: [${lastSession.lastElementType}] "${lastSession.lastElementText}"
- Script: ${lastSession.sceneCount} scenes, ${lastSession.wordCount} words

Write a short welcome-back (2-3 sentences). Remind them where they left off emotionally. End with a nudge that makes them want to start typing.`;
}

export function buildStuckPrompt(
  taste: KleoTasteProfile,
  style: KleoWritingStyle | null,
  scriptContext: string,
  previousConversation: KleoMessage[],
): string {
  const recentKleo = previousConversation
    .filter(m => m.context === 'stuck')
    .slice(-3)
    .map(m => `${m.role === 'kleo' ? 'Kleo' : 'Writer'}: ${m.text}`)
    .join('\n');

  return `${KLEO_CORE}

${buildTasteContext(taste)}
${buildStyleContext(style)}

The writer's stuck. Read what they wrote. Notice the specific thing that's blocking them — a scene that's avoiding its own point, a character who hasn't been allowed to be selfish, a moment that needs to be smaller. Say that thing. Don't diagnose like a doctor — react like a friend.

${scriptContext}

${recentKleo ? `What you've already said:\n${recentKleo}\n\nDon't repeat yourself. New angle.` : ''}

Two or three sentences. Specific. Sounds like a person.`;
}

export function buildChatPrompt(
  taste: KleoTasteProfile,
  style: KleoWritingStyle | null,
  scriptContext: string,
  conversation: KleoMessage[],
  writerMessage: string,
  mode: KleoMode = 'sounding-board',
  selectedText?: string,
): string {
  const recent = conversation.slice(-8).map(m =>
    `${m.role === 'kleo' ? 'Kleo' : 'Writer'}: ${m.text}`
  ).join('\n');

  const selectionContext = selectedText
    ? `\n\nThe writer selected this text from their screenplay:\n---\n${selectedText}\n---\nTheir message is about this selection.`
    : '';

  // Script Doctor always gets formatting instructions; others get them conditionally
  const formatBlock = mode === 'script-doctor' ? SCREENPLAY_FORMAT_INSTRUCTIONS : '';

  return `${KLEO_CORE}

${MODE_INSTRUCTIONS[mode]}

${formatBlock}

${buildTasteContext(taste)}
${buildStyleContext(style)}

Script context:
${scriptContext}
${selectionContext}

Conversation:
${recent}
Writer: ${writerMessage}

React. ${mode === 'script-doctor' ? 'Then give them the pages in <screenplay> blocks.' : 'Short. Specific to what they actually wrote. Like you\'re sitting next to them.'}`;
}
