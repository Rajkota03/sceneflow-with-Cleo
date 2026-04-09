import { NextResponse } from "next/server";
import { getDemoCharacters } from "@/lib/demo-data";

export async function POST(request: Request) {
  // Demo mode — no API key needed
  if (!process.env.ANTHROPIC_API_KEY) {
    // Simulate AI thinking time
    await new Promise(r => setTimeout(r, 1500));
    return NextResponse.json(getDemoCharacters());
  }

  // Real AI mode
  const { generateText } = await import("ai");
  const { anthropic } = await import("@ai-sdk/anthropic");

  try {
    const { logline } = await request.json();

    if (!logline || typeof logline !== "string") {
      return NextResponse.json({ error: "A logline string is required" }, { status: 400 });
    }

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: `You are SceneFlow, a story intelligence system. A writer gave you their one-line story idea. Find the PEOPLE hiding inside this sentence.

For each character (3-5), provide:
- name: A specific name appropriate to the story's cultural context
- essence: One sentence capturing their soul, not their job
- spark: One vivid detail that makes them feel real
- role: Their story function (protagonist, catalyst, mirror, etc.)
- color: A hex color for their energy (#4d8be8 blue, #6dd4a0 green, #d4a843 gold, #cc5f5f red, #9b7ed8 purple)

Be specific to THIS story. Respond ONLY with JSON: { "characters": [...] }`,
      prompt: logline,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse character data" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed.characters);
  } catch (error) {
    console.error("Spark route error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate characters";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
