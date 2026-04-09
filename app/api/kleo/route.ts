import { NextResponse } from 'next/server';
import {
  buildOnboardingAnalysisPrompt,
  buildRecapPrompt,
  buildStuckPrompt,
  buildChatPrompt,
  buildScriptContext,
} from '@/lib/kleo-brain';
import type { KleoMode } from '@/lib/kleo-brain';

export async function POST(request: Request) {
  const body = await request.json();
  const { action } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // No API key — use smart fallbacks
  if (!apiKey) {
    return handleWithoutAI(action, body);
  }

  try {
    if (action === 'analyze-taste') {
      const prompt = buildOnboardingAnalysisPrompt(body.films, body.writerIdentity);
      const text = await callClaude(apiKey, prompt, 300);
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed);
    }

    if (action === 'recap') {
      const prompt = buildRecapPrompt(body.taste, body.lastSession, body.style, body.scenes);
      const text = await callClaude(apiKey, prompt, 200);
      return NextResponse.json({ message: text });
    }

    if (action === 'stuck') {
      const scriptContext = buildScriptContext(body.scenes, body.activeSceneId);
      const prompt = buildStuckPrompt(body.taste, body.style, scriptContext, body.conversations || []);
      const text = await callClaude(apiKey, prompt, 300);
      return NextResponse.json({ message: text });
    }

    if (action === 'chat') {
      const scriptContext = buildScriptContext(body.scenes, body.activeSceneId);
      const mode: KleoMode = body.mode || 'sounding-board';
      const prompt = buildChatPrompt(
        body.taste,
        body.style,
        scriptContext,
        body.conversations || [],
        body.message,
        mode,
        body.selectedText,
      );
      // Script Doctor needs more tokens for screenplay blocks; Story Brain for analysis
      const maxTokens = mode === 'script-doctor' ? 1000 : mode === 'story-brain' ? 1200 : 600;
      const text = await callClaude(apiKey, prompt, maxTokens);
      return NextResponse.json({ message: text });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Kleo API error:', err);
    return handleWithoutAI(action, body);
  }
}

async function callClaude(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

// ── Smart fallbacks when no API key ──

function handleWithoutAI(action: string, body: Record<string, unknown>) {
  if (action === 'analyze-taste') {
    const films = body.films as string[];
    const identity = body.writerIdentity as string;
    return NextResponse.json({
      tasteReading: generateLocalTasteReading(films, identity),
      personality: detectPersonality(films),
    });
  }

  if (action === 'recap') {
    const session = body.lastSession as {
      lastActiveSceneHeading: string; wordsWritten: number;
      lastElementText: string; lastElementType: string; durationMinutes: number;
    };
    if (!session) return NextResponse.json({ message: "Welcome back. Your story is waiting." });
    const msg = `Welcome back. Last time you were deep in "${session.lastActiveSceneHeading}" — wrote ${session.wordsWritten} words in about ${session.durationMinutes} minutes. You left off on a ${session.lastElementType}: "${session.lastElementText.slice(0, 60)}${session.lastElementText.length > 60 ? '...' : ''}". Pick up where the feeling was.`;
    return NextResponse.json({ message: msg });
  }

  if (action === 'stuck') {
    const scenes = body.scenes as Array<{ heading: string; elements: Array<{ type: string; text: string }> }>;
    const activeId = body.activeSceneId as string;
    return NextResponse.json({ message: generateLocalStuckHelp(scenes, activeId) });
  }

  if (action === 'chat') {
    const msg = body.message as string || '';
    const lower = msg.toLowerCase();

    // Basic intent detection for offline mode
    if (lower.match(/dialogue|line|says?|speak|tell/)) {
      return NextResponse.json({
        message: "That's a strong instinct. Think about what this character would NEVER say — then figure out the closest they'd get to saying it. The best dialogue lives in that gap between what's felt and what's spoken."
      });
    }
    if (lower.match(/polish|rewrite|tighten|fix|better|improve/)) {
      return NextResponse.json({
        message: "Read it out loud. If you stumble, cut it. If it sounds like writing instead of talking, cut it. The best version of this is probably shorter than what you have."
      });
    }
    if (lower.match(/stuck|blocked|don't know|next|what happens/)) {
      return NextResponse.json({
        message: "What does your character want right now that they can't say out loud? Start there. The scene is about that wanting."
      });
    }

    return NextResponse.json({
      message: "Tell me more about what you're going for in this moment. What should the audience feel?"
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

function generateLocalTasteReading(films: string[], identity: string): string {
  return `${films.join(', ')} — there's a through-line here. You're drawn to stories where the surface hides something deeper, where characters carry weight they can't put into words. "${identity}" — that tells me you're not just writing to entertain. You're writing to excavate something true. Let's find it together.`;
}

function detectPersonality(films: string[]): string {
  const all = films.join(' ').toLowerCase();
  if (all.match(/tarantino|pulp|reservoir|django|kill bill|park chan|oldboy|parasite|bong/)) return 'provocateur';
  if (all.match(/nolan|inception|interstellar|fincher|fight club|villeneuve|arrival|blade runner|memento/)) return 'analytical';
  if (all.match(/malick|wong kar|tarkovsky|tree of life|mood for love|stalker|terrence/)) return 'poetic';
  return 'gentle';
}

function generateLocalStuckHelp(
  scenes: Array<{ heading: string; elements: Array<{ type: string; text: string }> }> | undefined,
  activeId: string | undefined,
): string {
  if (!scenes || scenes.length === 0) {
    return "The blank page is the hardest part. Don't think about the whole story — think about one image. What's the first thing the audience sees? Start there.";
  }

  const chars: string[] = [];
  let lastDialogue = '';
  let hasConflict = false;

  for (const scene of scenes) {
    for (const el of scene.elements) {
      if (el.type === 'character') {
        const name = el.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
        if (name && !chars.includes(name)) chars.push(name);
      }
      if (el.type === 'dialogue') lastDialogue = el.text;
    }
  }

  for (const scene of scenes) {
    for (const el of scene.elements) {
      if (el.text.match(/\?|no[,.]|but |however|wrong|can't|won't|don't/i)) {
        hasConflict = true;
        break;
      }
    }
  }

  if (chars.length >= 2 && !hasConflict) {
    return `${chars[0]} and ${chars[1]} are being too polite. What's the one thing ${chars[1]} could say that ${chars[0]} doesn't want to hear? Say it. The scene starts when someone's uncomfortable.`;
  }

  if (lastDialogue && chars.length > 0) {
    return `"${lastDialogue.slice(0, 50)}..." — ${chars[0]} just said that. But what did they MEAN? There's a gap between the words and the intention. Write the next line from what they're hiding, not what they're showing.`;
  }

  return "You know what happens next — you're just afraid of how it sounds. Write the ugly version first. The worst version of this scene. You can make it pretty later. Right now, make it true.";
}
