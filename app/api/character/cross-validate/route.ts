export async function POST(req: Request) {
  const { answers, characterName } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    await new Promise(r => setTimeout(r, 2000));
    return Response.json({ validation: getDemoValidation(characterName || 'the character', answers) });
  }

  const { generateText } = await import('ai');
  const { anthropic } = await import('@ai-sdk/anthropic');

  const answerText = Object.entries(answers as Record<string, string | string[]>)
    .filter(([, v]) => v && (typeof v === 'string' ? v.trim() : true))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `You are a world-class screenwriting collaborator performing cross-phase validation. Check these connections:

1. WOUND \u2192 LIE: Does the Ghost logically produce the Lie?
2. LIE \u2192 WANT: Does the Want extend the Lie?
3. NEED \u2192 LIE: Does the Need directly contradict the Lie?
4. SHADOW \u2192 WOUND: Does the shadow contain what the wound created?
5. CONTRADICTION \u2192 WOUND: Is the paradox organic or decorative?
6. VOICE SAMPLE: Could another character say these lines?

Be specific. Quote answers back. Frame gaps as provocations, not errors. Under 300 words. Warm but honest.`,
    prompt: `Character: ${characterName || 'Unnamed'}\n\nAll answers:\n${answerText}`,
  });

  return Response.json({ validation: text });
}

function getDemoValidation(name: string, answers: Record<string, string | string[]>): string {
  const lie = answers.lie || '[not yet defined]';
  const want = answers.want || '[not yet defined]';
  const ghost = answers.ghost || '[not yet defined]';

  return `Looking at ${name}'s architecture across all eight phases:

Your Ghost ("${typeof ghost === 'string' ? ghost.slice(0, 60) : ghost}...") connects to the Lie ("${typeof lie === 'string' ? lie.slice(0, 60) : lie}...") \u2014 but there's a gap. The wound suggests a character who'd conclude something about trust or control, yet the Lie reads more universal. Sharpen it. What would ONLY this character believe?

The Want ("${typeof want === 'string' ? want.slice(0, 60) : want}...") feels right for someone living inside that Lie. They're chasing the symptom, not the disease. Good dramatic architecture.

Your contradiction is interesting but check whether it's load-bearing \u2014 does it actually generate scenes, or is it just a character description? The best contradictions create impossible situations the character must navigate in real time.

The voice sample is where most characters reveal whether they're truly alive. Read it aloud. If you can imagine another character in your story saying the same lines with the same rhythm, it needs more specificity.

Overall: ${name} has strong bones. The wound-to-lie pipeline needs one more turn of the wrench.`;
}
