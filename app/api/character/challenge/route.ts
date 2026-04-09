const PHASE_PROMPTS: Record<string, string> = {
  identity: `Focus on what's SPECIFIC vs. GENERIC. If their insecurity could belong to anyone, push harder. If their intelligence type doesn't connect to their importance strategy, say so. Egri says all action springs from insecurity — does theirs actually generate behavior?`,
  wound: `Probe the Wound→Lie pipeline. Does the Ghost LOGICALLY produce the Lie? Or is the Lie a generic life lesson? The best Lies are conclusions ONLY this specific wound would create. Also: do they really know their wound, or are they intellectualizing it?`,
  drive: `Test the Lie→Want→Need triangle. The Want should EXTEND the Lie (chasing the wrong solution). The Need should CONTRADICT the Lie (the actual medicine). If Want and Need don't create an impossible choice, the story has no climax. Quote their Lie back and test if the Want really serves it.`,
  shadow: `Jung says the shadow contains what consciousness needs. Does their shadow gold actually connect to their Need? Does the parent's voice reinforce the Lie? The mask should be exhausting — if it's comfortable, it's not a mask, it's personality.`,
  contradiction: `Egri: contradictions must be LOAD-BEARING. Does this paradox generate actual scenes, or is it just a character description? The best contradictions create impossible situations the character must navigate in real time. Also test: does the contradiction connect to the wound?`,
  voice: `McKee's acid test: could another character say these lines? Check vocabulary against their class, intelligence type, and cultural background. Under pressure, does their speech change pattern actually connect to the Lie? Read the voice sample — is it specific enough?`,
  texture: `These details must be SCENE-READY. Not backstory, not description — things you can PUT IN A SCENE. Does their alone ritual reveal the wound? Does the fire object connect to what they value most? Geography should shape behavior, not just describe setting.`,
  pressure: `Final exam. Their cornered response should match their wound pattern. Their uncrossable line should connect to the Lie or the Need. Power behavior reveals whether the mask holds. The arc sentence is the whole story in one line — is it surprising AND inevitable?`,
};

export async function POST(req: Request) {
  const { answers, phaseId, phaseTitle, allAnswers } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    await new Promise(r => setTimeout(r, 1500));
    return Response.json({ feedback: getDemoFeedback(phaseTitle, answers) });
  }

  const { generateText } = await import('ai');
  const { anthropic } = await import('@ai-sdk/anthropic');

  const phaseText = Object.entries(answers as Record<string, string | string[]>)
    .filter(([, v]) => v && (typeof v === 'string' ? v.trim() : true))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  const contextText = allAnswers
    ? Object.entries(allAnswers as Record<string, string | string[]>)
        .filter(([, v]) => v && (typeof v === 'string' ? v.trim() : true))
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n')
    : phaseText;

  const phaseSpecific = PHASE_PROMPTS[phaseId as string] || '';

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `You are a world-class screenwriting collaborator analyzing a character. You think like Egri (insecurity drives everything, orchestration, contradiction), Weiland (Lie/Want/Need/Ghost), Chubbuck (primal Overall Objective, earning the right to the end), Jung (shadow, anima/animus, persona), and McKee (vocabulary reveals knowledge, modifiers reveal personality).

PHASE-SPECIFIC FOCUS:
${phaseSpecific}

Do THREE things in under 200 words total:

1. SHARP OBSERVATION — One non-obvious insight connecting their answers to a specific book concept. Something they didn't consciously intend but is right there.

2. THE CHALLENGE — One tough question. Quote their words back. Find the gap where they're being safe or generic. If connections between phases are weak, call it out specifically.

3. THE PROVOCATION — One specific scenario: "Put [name] in this situation: ___. What do they do?"

No bullet points. No numbered lists. Short punchy paragraphs. Warm but direct. Use the character's name.`,
    prompt: `The writer just completed Phase "${phaseTitle}". Here's what they've written for this phase:\n\n${phaseText}${contextText !== phaseText ? `\n\nFull character context across all phases:\n${contextText}` : ''}`,
  });

  return Response.json({ feedback: text });
}

function getDemoFeedback(phaseTitle: string, answers: Record<string, string | string[]>): string {
  const name = (answers.name as string) || 'this character';
  const entries = Object.entries(answers).filter(([, v]) => v && (typeof v === 'string' ? v.trim() : true));

  if (entries.length < 2) {
    return `You've only scratched the surface of "${phaseTitle}." ${name} is still a silhouette. Answer more questions \u2014 the interesting stuff lives in the specifics, not the outline.`;
  }

  const val = typeof entries[1]?.[1] === 'string' ? entries[1][1] : '';

  return `There's something interesting happening with ${name} in "${phaseTitle}" \u2014 your answer about "${entries[1]?.[0]}" (${val ? `"${val.slice(0, 80)}..."` : 'what you wrote'}) reveals a tension you might not have intended. Egri would say this is where the insecurity engine lives.\n\nBut here's the challenge: are you being specific enough? "What does ${name} do at 2am when the phone rings and it's the one person they can't ignore?" That's where character stops being concept and becomes a person.\n\nPut ${name} in a crowded elevator when someone mentions exactly the thing they're most ashamed of \u2014 not to them, but about someone else. What happens in their body before they decide what to do?`;
}
