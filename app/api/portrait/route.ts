import { NextResponse } from "next/server";
import { getDemoPortrait } from "@/lib/demo-data";

export async function POST(request: Request) {
  const { characterName, essence, answers } = await request.json();

  if (!characterName || !essence || !answers) {
    return NextResponse.json({ error: "characterName, essence, and answers are required" }, { status: 400 });
  }

  // Demo mode — no API key needed
  if (!process.env.ANTHROPIC_API_KEY) {
    await new Promise(r => setTimeout(r, 2000));
    const portrait = getDemoPortrait(characterName);
    if (!portrait) {
      return NextResponse.json({ error: "Portrait not available for this character" }, { status: 404 });
    }
    return NextResponse.json(portrait);
  }

  // Real AI mode
  const { generateText } = await import("ai");
  const { anthropic } = await import("@ai-sdk/anthropic");

  try {
    const discoveryJourney = answers
      .map((a: { dimension?: string; dimensionLabel?: string; questionText: string; chosenText: string }, i: number) =>
        `${a.dimensionLabel ? `[${a.dimensionLabel}] ` : ''}Q${i + 1}: ${a.questionText}\nAnswer: ${a.chosenText}`)
      .join("\n\n");

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: `You are SceneFlow. Synthesize everything discovered about this character into a portrait that makes them feel ALIVE. The character was explored across 7 dimensions: Origin Wound, Desire vs Need, The Mask, Voice, Relationship Pattern, The Line, and Contradiction.

Respond ONLY with JSON:
{
  "name": "Character name",
  "essence": "One sentence capturing their soul",
  "dimensions": {
    "origin-wound": "Summary of their origin wound",
    "desire-vs-need": "Their want vs their real need",
    "mask": "Who they pretend to be",
    "voice": "How they speak, with an example line",
    "relationship": "Their relationship pattern",
    "the-line": "What they won't cross",
    "contradiction": "The paradox that makes them human"
  },
  "prose": "3-4 paragraph prose portrait. Beautiful, specific, true.",
  "unansweredQuestion": "The question they can't answer — the engine of their arc"
}`,
      prompt: `Character: ${characterName}\nEssence: ${essence}\n\nDiscovery journey:\n${discoveryJourney}\n\nSynthesize everything above into a complete character portrait.`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse portrait data" }, { status: 500 });
    }
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    console.error("Portrait route error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate portrait";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
