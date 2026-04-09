export async function POST(req: Request) {
  const { answers, characterName } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    await new Promise(r => setTimeout(r, 2000));
    return Response.json({ scenarios: getDemoScenarios(characterName || 'the character') });
  }

  const { generateText } = await import('ai');
  const { anthropic } = await import('@ai-sdk/anthropic');

  const answerText = Object.entries(answers as Record<string, string | string[]>)
    .filter(([, v]) => v && (typeof v === 'string' ? v.trim() : true))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `You are a world-class screenwriting collaborator. Generate THREE pressure test scenarios that each feel like an actual scene. Ground them in sensory detail.

SCENARIO 1 — WOUND/LIE TEST: Create a situation that triggers their deepest fear and forces the Lie to the surface.
SCENARIO 2 — CONTRADICTION TEST: Force both sides of their paradox into the same room.
SCENARIO 3 — WANT VS. NEED: Create a moment of choice where getting what they WANT means permanently losing what they NEED.

Format each as:
### Scenario [N]: [Title]
[The scenario in 3-4 vivid sentences]

Make these feel like scenes from a film.`,
    prompt: `Character: ${characterName || 'Unnamed'}\n\nEverything known about this character:\n${answerText}`,
  });

  return Response.json({ scenarios: text });
}

function getDemoScenarios(name: string): string {
  return `### Scenario 1: The Phone Call
${name} is in a meeting that could change everything \u2014 the one they've been working toward for months. Their phone buzzes. It's the person they cut off, the one connected to the wound. The voicemail is just breathing and then three words. The meeting continues. Everyone is waiting for ${name} to speak.

### Scenario 2: The Mirror Table
A dinner party. ${name} is seated directly across from someone who is everything they pretend not to be \u2014 same background, same wound, but this person chose the opposite path. The host keeps comparing them. "You two are so similar!" Every smile costs something.

### Scenario 3: The Envelope
A lawyer's office, fluorescent lights. ${name} can sign the paper and get exactly what they've wanted \u2014 the thing that was supposed to fix everything. But the person sitting next to them, the person who represents what they actually need, will walk out of their life the moment the pen touches paper. The lawyer checks their watch.`;
}
