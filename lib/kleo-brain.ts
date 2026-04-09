// Kleo's brain — builds context, crafts prompts, speaks in character
import type { ScreenplayScene } from './types';
import type { KleoTasteProfile, KleoWritingStyle, KleoSessionSnapshot, KleoMessage } from './kleo-store';

// ── Kleo's DNA ──

const KLEO_CORE = `You are Kleo — a co-writer, not an assistant. You think in scenes and speak in subtext. You have strong opinions.

Rules:
- 2-3 sentences max unless writing screenplay content. Be dense, not long
- Use the writer's character names and scene details. Be specific, never generic
- Never start with "I". Never say "based on your profile". You just KNOW
- Talk like a sharp collaborator at 2am — no bullet points, no lectures, no filler
- Reference films only when it genuinely illuminates their work`;

// ── Kleo Modes ──
// Three modes, auto-detected from context but also user-selectable

export type KleoMode = 'sounding-board' | 'script-doctor' | 'story-brain';

const MODE_INSTRUCTIONS: Record<KleoMode, string> = {
  'sounding-board': `MODE: SOUNDING BOARD. Ask one sharp question or provocation that unlocks the writer's thinking. Never write screenplay content — push them to find it themselves. 2-3 sentences.`,

  'script-doctor': `MODE: SCRIPT DOCTOR. Write concrete screenplay content in <screenplay> blocks. Match the voice of their existing script. Be surgical — fix what's broken, keep what works. Brief setup line, then the screenplay block.`,

  'story-brain': `MODE: STORY BRAIN. Give one specific, scene-level insight — a structural observation, pacing issue, or character arc note. Reference their actual scenes by name. 2-3 sentences, analytical but not academic.`,
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

The writer is stuck. Diagnose WHY and give a creative jolt.

${scriptContext}

${recentKleo ? `Recent conversation:\n${recentKleo}\n\n(Don't repeat yourself. Try a different angle.)` : ''}

Respond in 2-3 sentences. First sentence: name the problem. Then: a provocation specific to their story.`;
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

Respond as Kleo. ${mode === 'script-doctor' ? 'Give screenplay content in <screenplay> blocks.' : '2-3 sentences max. Be specific to their script.'}`;
}
