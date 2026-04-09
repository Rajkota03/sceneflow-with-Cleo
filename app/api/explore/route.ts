import { NextResponse } from "next/server";
import { getDemoQuestion, getSketchLine } from "@/lib/demo-data";
import { DIMENSIONS } from "@/lib/types";

export async function POST(request: Request) {
  const { characterName, essence, previousAnswers, dimensionIndex, questionIndex } = await request.json();

  if (!characterName || !essence) {
    return NextResponse.json({ error: "characterName and essence are required" }, { status: 400 });
  }

  const dimIdx = dimensionIndex ?? 0;
  const qIdx = questionIndex ?? 0;

  // Demo mode — no API key needed
  if (!process.env.ANTHROPIC_API_KEY) {
    await new Promise(r => setTimeout(r, qIdx === 0 ? 1200 : 800));
    const question = getDemoQuestion(characterName, dimIdx, qIdx);
    if (!question) {
      return NextResponse.json({ error: "No more questions available" }, { status: 404 });
    }
    // Build sketch lines from demo data (only for guided questions with options)
    const sketchLines: Record<string, string> = {};
    for (const opt of question.options) {
      sketchLines[opt.id] = getSketchLine(characterName, question.dimension, opt.id);
    }
    return NextResponse.json({ ...question, sketchLines });
  }

  // Real AI mode
  const { generateText } = await import("ai");
  const { anthropic } = await import("@ai-sdk/anthropic");

  const dimension = DIMENSIONS[dimIdx];
  if (!dimension) {
    return NextResponse.json({ error: "Invalid dimension index" }, { status: 400 });
  }

  try {
    const answersContext =
      previousAnswers && previousAnswers.length > 0
        ? previousAnswers
            .map((a: { questionText: string; chosenText: string; dimension?: string }, i: number) =>
              `${a.dimension ? `[${a.dimension}] ` : ''}Q${i + 1}: ${a.questionText}\nAnswer: ${a.chosenText}`)
            .join("\n\n")
        : "No previous answers yet.";

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: `You are SceneFlow, exploring a character through 8 dimensions. You are now exploring the "${dimension.label}" dimension (${dimension.sketchLabel}).

Rules:
- NEVER generic ("What's their flaw?"). Be SPECIFIC and VIVID.
- Ask scenario-based questions that reveal the "${dimension.id}" dimension
- Build on previous answers — go DEEPER into what was revealed
- Use the character's name
- Provide 3 options: vivid, specific, 1-2 sentences each. All good but different facets.
- Also provide a "kleo" suggestion — Kleo is the AI writing partner who offers a bold, insightful answer the writer might not think of
- Provide sketchLines — a one-line poetic summary for each option (used in a live character sketch)

Respond ONLY with JSON:
{
  "dimension": "${dimension.id}",
  "dimensionLabel": "${dimension.label}",
  "question": "...",
  "options": [{ "id": "a", "text": "..." }, { "id": "b", "text": "..." }, { "id": "c", "text": "..." }],
  "kleo": { "answer": "A bold answer...", "reasoning": "Why this is interesting..." },
  "sketchLines": { "a": "One-line sketch...", "b": "One-line sketch...", "c": "One-line sketch..." }
}`,
      prompt: `Character: ${characterName}\nEssence: ${essence}\nDimension ${dimIdx + 1} of ${DIMENSIONS.length}: ${dimension.label} — ${dimension.sketchLabel}\n\nPrevious discoveries:\n${answersContext}\n\nGenerate the next question exploring the "${dimension.label}" dimension.`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse question data" }, { status: 500 });
    }
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    console.error("Explore route error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate question";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
