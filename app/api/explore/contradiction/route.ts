import { NextResponse } from "next/server";
import { getDemoContradictionInsight } from "@/lib/demo-data";

export async function POST(request: Request) {
  const { characterName } = await request.json();

  if (!characterName) {
    return NextResponse.json({ error: "characterName required" }, { status: 400 });
  }

  // Demo mode
  if (!process.env.ANTHROPIC_API_KEY) {
    await new Promise(r => setTimeout(r, 800));
    const insight = getDemoContradictionInsight(characterName);
    return NextResponse.json(insight);
  }

  // Real AI mode would generate contradiction insight dynamically
  // by analyzing all previous dimension answers for the character
  return NextResponse.json({
    observation: "Something interesting is emerging from the contradictions in this character.",
    question: "What happens when these opposing forces collide?",
  });
}
