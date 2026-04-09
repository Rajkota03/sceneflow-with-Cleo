// Demo data engine — realistic character discovery responses without API calls
// Questions synthesized from: McKee (Dialogue), Chubbuck (Power of the Actor),
// Egri (Art of Creative Writing), Weiland (Creating Character Arcs), Jung (Man and His Symbols)

import type { Character, DimensionId, DimensionQuestion, ContradictionInsight, CharacterPortrait, QuestionMode } from './types';
import { DIMENSIONS } from './types';

interface DemoQuestion {
  mode: QuestionMode;
  text: string;
  options: { id: string; text: string }[];
}

interface DemoCharacterSet {
  logline: string;
  characters: Omit<Character, 'id'>[];
  // questions[characterName][dimensionIndex] = array of questions for that dimension
  questions: Record<string, DemoQuestion[][]>;
  // Sketch lines: characterName -> dimensionIndex -> optionId -> sketch line (guided questions only)
  sketchLines: Record<string, Record<number, Record<string, string>>>;
  // Kleo suggestions per character: [dimensionIndex][questionIndex]
  kleo: Record<string, { answer: string; reasoning: string; source?: string }[][]>;
  // Contradiction insights per character
  contradictions: Record<string, ContradictionInsight>;
  portraits: Record<string, CharacterPortrait>;
}

// ─────────────────────────────────────────────────────────
// ARJUN — 28 questions across 8 dimensions
// ─────────────────────────────────────────────────────────

const ARJUN_QUESTIONS: DemoQuestion[][] = [
  // DIM 0: THE WOUND (4 questions)
  [
    { mode: 'open', text: "Something happened to Arjun before page one that made him hide behind other people's words. In your own words — what broke him?", options: [] },
    { mode: 'open', text: "How old was Arjun when this happened? What did he understand about it then — and what did he get wrong?", options: [] },
    { mode: 'guided', text: "What did that event take from Arjun — not externally, but inside? What belief about himself was destroyed?",
      options: [
        { id: "a", text: "The belief he was talented enough to stand on his own. His mentor's betrayal wasn't just theft — it was a verdict on his worth." },
        { id: "b", text: "The belief that the world rewards honesty. He wrote from the heart and the heart got stolen. Now he writes from the head." },
        { id: "c", text: "The belief he was safe being seen. Visibility became dangerous. Invisibility became armor." },
      ] },
    { mode: 'open', text: "Where does this wound live in Arjun's body? What physical habit — a posture, a tic, a way of entering rooms — traces back to what happened?", options: [] },
  ],

  // DIM 1: THE LIE (3 questions)
  [
    { mode: 'open', text: "Based on what happened, Arjun drew a conclusion about how the world works. It felt true then. State that false belief in one sentence — the Lie he lives by.", options: [] },
    { mode: 'guided', text: "How does this Lie show up in Arjun's daily behavior? What symptoms does it create?",
      options: [
        { id: "a", text: "Fear of completion. He starts things brilliantly and abandons them. The half-finished screenplay is the proof — finishing means being judged." },
        { id: "b", text: "Compulsive self-erasure. He removes his fingerprints from everything. His craft is invisible by design." },
        { id: "c", text: "Judgmentalism toward anyone who puts themselves out there. He calls it 'taste.' It's actually envy fortified by terror." },
      ] },
    { mode: 'open', text: "What does believing this Lie protect Arjun from having to feel, risk, or face? The Lie is armor — what is it guarding?", options: [] },
  ],

  // DIM 2: THE DRIVE (4 questions)
  [
    { mode: 'guided', text: "Underneath everything — what does Arjun need from life more than anything? His primal drive. The thing his heart has always been reaching for.",
      options: [
        { id: "a", text: "To be seen as the author of his own story — not someone else's ghost. Recognition isn't vanity. It's proof he exists." },
        { id: "b", text: "To finish what he started at 22. Not the screenplay — the promise he made to himself about who he would become." },
        { id: "c", text: "To be loved for what he actually writes, not what he performs. He wants someone to read the real thing and stay." },
      ] },
    { mode: 'open', text: "Why THIS drive and not another? Connect it to the wound. What did the wound take that this drive is desperately trying to recover?", options: [] },
    { mode: 'open', text: "What does Arjun tell others about why he ghostwrites? And what is the real reason he can't say out loud?", options: [] },
    { mode: 'guided', text: "Arjun's WANT is what he consciously chases. His NEED is what would actually heal him. These are at war. What are they?",
      options: [
        { id: "a", text: "WANT: A produced screenplay with his name on it. NEED: To forgive himself for hiding — and realize the half-finished script is already the best thing he's written." },
        { id: "b", text: "WANT: To be respected as a writer. NEED: To stop measuring respect in credits and start measuring it in truth." },
        { id: "c", text: "WANT: Financial security through ghostwriting. NEED: To understand that the security he built is also the cage." },
      ] },
  ],

  // DIM 3: THE MASK (3 questions)
  [
    { mode: 'open', text: "Who does Arjun pretend to be? Not in a sinister way — what version of himself does he perform for the world? Describe the mask.", options: [] },
    { mode: 'guided', text: "When does the mask crack? What situation, person, or pressure makes the real Arjun leak through despite his best efforts?",
      options: [
        { id: "a", text: "When someone reads something he ghostwrote and praises it — not knowing he wrote it. The pride flashes before the mask can catch it." },
        { id: "b", text: "At 2 AM, alone, with the laptop open to both files. The mask can't operate without an audience." },
        { id: "c", text: "When Meera asks a question that's too specific, too right, too close. She reads people the way he reads scripts — and he can't hide from that." },
      ] },
    { mode: 'open', text: "What would it cost Arjun to drop the mask entirely — not just for a moment, but permanently? What would he lose? Who would he lose?", options: [] },
  ],

  // DIM 4: THE VOICE (4 questions)
  [
    { mode: 'guided', text: "What kind of language does Arjun use? Not pet phrases — what is the register of his speech?",
      options: [
        { id: "a", text: "Observational and deflecting. He describes the world precisely to avoid describing himself. His metaphors are always about other people." },
        { id: "b", text: "Quiet and economical on the surface, but when pushed — sudden raw poetry. Like he's been saving the real words." },
        { id: "c", text: "Self-deprecating humor that sounds comfortable but is actually strategic. Each joke is a door closing." },
      ] },
    { mode: 'open', text: "What topic or emotional territory will Arjun never go near in conversation? What word, subject, or feeling does he consistently avoid?", options: [] },
    { mode: 'open', text: "What is running in Arjun's head during a conversation that he will never say out loud? Write a line of his inner monologue — the uncensored thought beneath the polite surface.", options: [] },
    { mode: 'open', text: "How does Arjun's speech change when he's cornered — when someone has seen through the mask? Does he become more controlled or more chaotic? More honest or more evasive?", options: [] },
  ],

  // DIM 5: THE BODY (3 questions)
  [
    { mode: 'open', text: "How does Arjun walk into a room? Describe it without adjectives — just the physical behavior. Fast or slow? Center or periphery? Who does he look at first?", options: [] },
    { mode: 'guided', text: "What is Arjun's primary physical modus operandi — the way he uses his body to get what he needs from people?",
      options: [
        { id: "a", text: "Stillness as camouflage. He makes himself physically small, unremarkable. The less space he takes, the safer he feels." },
        { id: "b", text: "Attentive listening posture — leaning in, eye contact, making the other person feel heard. It's genuine AND strategic. If they're talking, they're not asking about him." },
        { id: "c", text: "Restless hands. Always touching something — pen, coffee cup, phone edge. The hands are working on something even when the body is sitting still." },
      ] },
    { mode: 'open', text: "What does Arjun do with his hands when he's writing something true — something that's actually his? Is it different from when he's ghostwriting?", options: [] },
  ],

  // DIM 6: THE RELATIONSHIPS (4 questions)
  [
    { mode: 'open', text: "Who is the person Arjun is in the most necessary conflict with? The one he can't walk away from even though the relationship hurts? What holds them together?", options: [] },
    { mode: 'guided', text: "What is Arjun's pattern in relationships — the thing he does every time, sometimes without realizing it?",
      options: [
        { id: "a", text: "He disappears. Slowly, methodically, until the other person thinks the silence was mutual. He's done it with friends, lovers, and himself." },
        { id: "b", text: "He becomes the listener, the supporter, the ghost-therapist. He gives everyone else what he can't give himself — attention without agenda." },
        { id: "c", text: "He falls for people who don't need him. Safety in their independence. If they don't need him, they can't be betrayed by his absence." },
      ] },
    { mode: 'open', text: "Who does Arjun consistently misread — projecting something onto them that's actually about himself? What quality does he see in someone else that is really his own shadow?", options: [] },
    { mode: 'guided', text: "Where is Arjun's deepest, most alive conflict? Is it with the world, with someone he loves, or with himself?",
      options: [
        { id: "a", text: "With himself. The war between the writer who wants to be seen and the ghost who built a life out of being invisible. Both are him." },
        { id: "b", text: "With Meera. She's the only person who can see what he's hiding — and that makes her the most dangerous and necessary person in his life." },
        { id: "c", text: "With his mentor's memory. The man who stole his screenplay is dead, but Arjun is still having the argument every time he opens a blank page." },
      ] },
  ],

  // DIM 7: THE ARC (3 questions)
  [
    { mode: 'open', text: "Where does Arjun begin this story — emotionally, psychologically? What does he believe, and what is he defended against? Describe his inner state at page one.", options: [] },
    { mode: 'guided', text: "Which arc describes Arjun's trajectory through this story?",
      options: [
        { id: "a", text: "Positive Change Arc — He believes a Lie (his voice isn't worth hearing), is forced to confront it through Meera and the story's events, and ultimately writes something under his own name." },
        { id: "b", text: "Disillusionment Arc — He discovers the industry he's been serving doesn't deserve his loyalty, and the truth is colder than the lie he was living." },
        { id: "c", text: "Flat Arc — Arjun already knows the truth about storytelling's power. His journey is about forcing others to see it too, at great personal cost." },
      ] },
    { mode: 'open', text: "Where does Arjun end? What does he now believe — and what did the change cost him? Describe the person who walks out of the last scene.", options: [] },
  ],
];

// ─────────────────────────────────────────────────────────
// MEERA — 28 questions across 8 dimensions
// ─────────────────────────────────────────────────────────

const MEERA_QUESTIONS: DemoQuestion[][] = [
  // DIM 0: THE WOUND (4 questions)
  [
    { mode: 'open', text: "Meera turned grief into a production company. What grief? What happened — and what made her decide to build rather than mourn?", options: [] },
    { mode: 'open', text: "How old was Meera when she lost her mother? What did she understand about loss at that age — and what did she get catastrophically wrong?", options: [] },
    { mode: 'guided', text: "What did her mother's death take from Meera — not externally, but inside?",
      options: [
        { id: "a", text: "The belief she was allowed to be soft. Her mother was soft and the world took her. Meera decided softness was a death sentence." },
        { id: "b", text: "The belief she was loved unconditionally. Her mother's last words — 'I'm sorry I wasn't enough' — installed a belief that love always comes with apology." },
        { id: "c", text: "The belief that time is unlimited. She watched someone run out of it. Now she treats every moment like a deadline." },
      ] },
    { mode: 'open', text: "Where does this loss live in Meera's body? What physical habit — a gesture, a tension, a ritual — connects back to her mother?", options: [] },
  ],

  // DIM 1: THE LIE (3 questions)
  [
    { mode: 'open', text: "What false belief did her mother's death install? The conclusion Meera drew about the world that felt survival-critical then but is now the thing holding her captive. State it in one sentence.", options: [] },
    { mode: 'guided', text: "How does the Lie manifest in Meera's daily life?",
      options: [
        { id: "a", text: "She treats every relationship like a production — planned, budgeted, with a clear deliverable. Spontaneity feels like chaos. Chaos killed her mother." },
        { id: "b", text: "She can produce vulnerability on screen but can't experience it in person. She's an expert on emotion she refuses to feel." },
        { id: "c", text: "She measures her worth in output. One day without producing something tangible feels like sliding backwards toward the person she was when her mother died — helpless." },
      ] },
    { mode: 'open', text: "What does the Lie protect Meera from? If she stopped believing it tomorrow, what feeling would flood in that she's been keeping at bay for years?", options: [] },
  ],

  // DIM 2: THE DRIVE (4 questions)
  [
    { mode: 'guided', text: "What does Meera need from life more than anything? Not what she tells herself — what her heart has actually been reaching for all these years.",
      options: [
        { id: "a", text: "To hear her mother say 'I'm proud of you' — and since that's impossible, to build something so undeniable that the universe says it instead." },
        { id: "b", text: "To feel safe enough to stop. To discover there's a person underneath the producer — and that person is worth knowing." },
        { id: "c", text: "To be loved without having to earn it. Every relationship she has requires her to be impressive first." },
      ] },
    { mode: 'open', text: "Why THIS drive? Connect it to the wound. What did her mother's death take that this drive is desperately trying to recover?", options: [] },
    { mode: 'open', text: "What does Meera tell the world about why she works so hard? And what is the real reason — the one she'd never put in an interview?", options: [] },
    { mode: 'open', text: "What does Meera consciously WANT from this story — and what does she actually NEED that she can't yet see?", options: [] },
  ],

  // DIM 3: THE MASK (3 questions)
  [
    { mode: 'open', text: "Describe the Meera the world sees. The producer, the boss, the woman in the room. What version of herself has she perfected?", options: [] },
    { mode: 'guided', text: "When does the real Meera leak through the mask?",
      options: [
        { id: "a", text: "In the edit suite, alone, wearing her mother's glasses. Her shoulders drop. Her voice softens. The producer disappears and a grieving daughter takes her place." },
        { id: "b", text: "When a story she's producing accidentally mirrors her own. She becomes aggressive, controlling — trying to direct the emotions she can't manage in herself." },
        { id: "c", text: "Late at night, watching dailies from a film nobody asked her to watch. She whispers notes to the screen like she's talking to someone who isn't there." },
      ] },
    { mode: 'open', text: "If Meera dropped the mask permanently, who would she be? Describe the person underneath — the one she's most afraid to meet.", options: [] },
  ],

  // DIM 4: THE VOICE (4 questions)
  [
    { mode: 'guided', text: "What register does Meera speak in?",
      options: [
        { id: "a", text: "Controlled, precise, producer-efficient. Every word has a purpose. She edits herself in real time the way she edits footage." },
        { id: "b", text: "Warm but boundaried. She gives people exactly enough warmth to feel valued, never enough to get close. Professional intimacy." },
        { id: "c", text: "Commanding when public, musical when alone. The shift between the two is the distance between who she is and who she performs." },
      ] },
    { mode: 'open', text: "What will Meera never talk about? What topic or emotion is completely off-limits — the territory her language refuses to enter?", options: [] },
    { mode: 'open', text: "Write a line of Meera's inner monologue — the thought running beneath a conversation she'd never let anyone hear.", options: [] },
    { mode: 'open', text: "How does Meera's speech change when she's emotionally cornered? When someone gets past the professional armor?", options: [] },
  ],

  // DIM 5: THE BODY (3 questions)
  [
    { mode: 'open', text: "How does Meera enter a room? Not what she looks like — how she moves, where she goes, what she does with her hands and her eyes.", options: [] },
    { mode: 'guided', text: "What is Meera's primary physical M.O. — how she uses presence to get what she needs?",
      options: [
        { id: "a", text: "Command through composure. She is always the most put-together person in the room. The armor is visible — and it's beautiful." },
        { id: "b", text: "Strategic vulnerability. She knows exactly when to show tiredness, when to remove the glasses, when to let her guard seem to slip. Each moment is a choice." },
        { id: "c", text: "Kinetic energy. She's always moving — checking her phone, reviewing notes, walking through sets. Stillness is the enemy because stillness invites feeling." },
      ] },
    { mode: 'open', text: "What does Meera's body do when she's alone and the performance stops? Describe the physical Meera nobody sees.", options: [] },
  ],

  // DIM 6: THE RELATIONSHIPS (4 questions)
  [
    { mode: 'open', text: "Who is the person Meera is in the most necessary conflict with? The relationship she can't leave, no matter how much it costs her?", options: [] },
    { mode: 'guided', text: "What is Meera's pattern in intimate relationships?",
      options: [
        { id: "a", text: "Three rehearsed vulnerabilities on rotation. She gives just enough openness to seem real, then redirects the conversation. She turns lovers into colleagues." },
        { id: "b", text: "She chooses people who need her more than she needs them. It's safer to be needed than to need." },
        { id: "c", text: "She works so hard that distance looks like dedication. By the time anyone notices she's pulled away, they blame the schedule, not the woman." },
      ] },
    { mode: 'open', text: "Who does Meera project onto — seeing in them something that's actually about herself? What quality does she admire or despise in someone that is actually her own shadow?", options: [] },
    { mode: 'open', text: "If her mother could see Meera now — the empire, the armor, the loneliness — what would she say? And why is Meera terrified of the answer?", options: [] },
  ],

  // DIM 7: THE ARC (3 questions)
  [
    { mode: 'open', text: "Where does Meera begin this story — emotionally? What does she believe about herself and the world at page one?", options: [] },
    { mode: 'guided', text: "Which arc describes Meera's trajectory?",
      options: [
        { id: "a", text: "Positive Change Arc — The Lie (achievement = safety) cracks as she encounters something she can't produce her way through. She learns to grieve, finally." },
        { id: "b", text: "Disillusionment Arc — She discovers the empire she built to honor her mother actually betrays everything her mother valued. The truth is devastating." },
        { id: "c", text: "Fall Arc — She doubles down on control, sacrificing every genuine relationship for the company, becoming someone her mother wouldn't recognize." },
      ] },
    { mode: 'open', text: "Where does Meera end? What has she gained, and what has she paid? Who walks out of the last scene?", options: [] },
  ],
];

// ─────────────────────────────────────────────────────────
// RAVI — 28 questions across 8 dimensions
// ─────────────────────────────────────────────────────────

const RAVI_QUESTIONS: DemoQuestion[][] = [
  // DIM 0: THE WOUND (4 questions)
  [
    { mode: 'open', text: "Ravi peaked at 30 and has been performing confidence ever since. What happened at that peak — and what happened right after — that turned success into a prison?", options: [] },
    { mode: 'open', text: "His mentor gave him the lighter before the stroke. What was their last real conversation about? What did the mentor say that Ravi can never unhear?", options: [] },
    { mode: 'guided', text: "What did that experience take from Ravi internally?",
      options: [
        { id: "a", text: "The belief that his talent was his own. His mentor's influence on that first film was so deep that Ravi can never be sure where the mentor ends and he begins." },
        { id: "b", text: "The ability to create without self-consciousness. Once you know you can fail, recklessness dies. And recklessness was his entire gift." },
        { id: "c", text: "The belief that art happens when you're ready. His best work came from ignorance. Knowledge poisoned the well." },
      ] },
    { mode: 'open', text: "The lighter flick — when does it happen? Not just 'when he's about to lie.' What specific kinds of moments trigger it?", options: [] },
  ],

  // DIM 1: THE LIE (3 questions)
  [
    { mode: 'open', text: "What false belief has Ravi been living by since his first film? The Lie that feels like wisdom but is actually fear wearing a philosophy. State it.", options: [] },
    { mode: 'guided', text: "How does this Lie operate in Ravi's creative life?",
      options: [
        { id: "a", text: "He over-prepares everything. Every shot planned, every beat rehearsed. He calls it 'mastery.' It's actually the elimination of surprise — and surprise was the only thing that made his first film great." },
        { id: "b", text: "He surrounds himself with people who confirm his reputation. Anyone who challenges him feels dangerous. He's curated an echo chamber and called it a team." },
        { id: "c", text: "He talks about his first film constantly — in interviews, at dinners, in pitches. He's living off the interest of a single deposit he made a decade ago." },
      ] },
    { mode: 'open', text: "What would Ravi have to face if the Lie stopped working? What feeling is the Lie holding at bay?", options: [] },
  ],

  // DIM 2: THE DRIVE (4 questions)
  [
    { mode: 'guided', text: "What does Ravi need from life more than anything?",
      options: [
        { id: "a", text: "To make something that proves the first film wasn't a fluke — that there's an artist under the reputation, not just a lucky accident." },
        { id: "b", text: "To be forgiven — by himself, by his mentor's memory — for not being able to do it alone. For needing someone else's spark to ignite." },
        { id: "c", text: "To feel the recklessness again. Not the confidence — the actual willingness to fail. He'd trade his entire filmography for one more moment of creative freedom." },
      ] },
    { mode: 'open', text: "Why THIS drive? How does it connect back to the wound?", options: [] },
    { mode: 'open', text: "What does Ravi tell the industry about what he's working on next? And what does he actually feel when he sits alone with a blank page?", options: [] },
    { mode: 'open', text: "What does Ravi consciously WANT versus what he actually NEEDS?", options: [] },
  ],

  // DIM 3: THE MASK (3 questions)
  [
    { mode: 'open', text: "Describe the Ravi the public sees — the director at festivals, in interviews, at production meetings. What's the performance?", options: [] },
    { mode: 'guided', text: "When does the real Ravi show up?",
      options: [
        { id: "a", text: "On set, in the gap between 'cut' and the next setup. When he's not directing anyone, his face goes blank. The confidence evaporates like a held breath released." },
        { id: "b", text: "When he watches someone else's film that's genuinely great. The admiration is real — and so is the grief for the version of himself that could have made it." },
        { id: "c", text: "When he flicks the lighter. That involuntary reach is the truest thing about him — the body remembering a relationship the mouth won't discuss." },
      ] },
    { mode: 'open', text: "What would Ravi lose if the world saw through the mask? Not career consequences — what personal loss terrifies him?", options: [] },
  ],

  // DIM 4: THE VOICE (4 questions)
  [
    { mode: 'guided', text: "How does Ravi speak?",
      options: [
        { id: "a", text: "Interview-polished. Quotable. Every sentence sounds like it's been said before — because it has. He's rehearsed his spontaneity." },
        { id: "b", text: "Charismatic and referential — always citing other directors, other films, other eras. His speech is a bibliography of influences, hiding the absence of his own." },
        { id: "c", text: "Warm, funny, disarming. He makes everyone feel like his equal. It's a form of control — if you like him, you won't question him." },
      ] },
    { mode: 'open', text: "What will Ravi never talk about voluntarily? What subject does he redirect away from every time?", options: [] },
    { mode: 'open', text: "Write a line of Ravi's inner monologue — what he's really thinking during a pitch meeting while performing confidence.", options: [] },
    { mode: 'open', text: "What does Ravi sound like when the guard drops completely — when he says something he hasn't rehearsed?", options: [] },
  ],

  // DIM 5: THE BODY (3 questions)
  [
    { mode: 'open', text: "How does Ravi carry himself on set versus off set? Is there a physical difference between Director Ravi and private Ravi?", options: [] },
    { mode: 'guided', text: "What's his physical M.O.?",
      options: [
        { id: "a", text: "Command through ease. He lounges, he leans, he takes up space. The relaxation is performed but effective — it makes everyone around him feel safe." },
        { id: "b", text: "Kinetic authority. He's always moving on set — touching the camera, adjusting the light, showing actors the gesture he wants. His body is his directing tool." },
        { id: "c", text: "The lighter as fidget object. His hands are never still. The lighter is his anchor, his tell, and his prayer all at once." },
      ] },
    { mode: 'open', text: "Describe Ravi alone in a screening room, watching the rough cut of something he knows isn't working. What does his body do?", options: [] },
  ],

  // DIM 6: THE RELATIONSHIPS (4 questions)
  [
    { mode: 'open', text: "Who is Ravi in the most necessary conflict with — the person he measures himself against, resents, and can't quit?", options: [] },
    { mode: 'guided', text: "What's Ravi's pattern with collaborators?",
      options: [
        { id: "a", text: "He competes with ghosts. Every collaborator is measured against his mentor, his younger self, the impossible standard of a film made by someone who didn't know enough to be afraid." },
        { id: "b", text: "He mentors aggressively — pouring into younger filmmakers what his mentor poured into him. But he can never let them surpass him. Generosity with a ceiling." },
        { id: "c", text: "Charm first, distance later. He's the most exciting person in the room for exactly long enough to get what he needs, then the warmth fades." },
      ] },
    { mode: 'open', text: "What does Ravi see in Arjun that frightens him — some quality that mirrors something Ravi has lost or is afraid to acknowledge?", options: [] },
    { mode: 'open', text: "Where is Ravi's deepest conflict — with the industry, with someone he loves, or with himself?", options: [] },
  ],

  // DIM 7: THE ARC (3 questions)
  [
    { mode: 'open', text: "Where does Ravi begin this story? What does he believe, what is he defended against, what is he performing?", options: [] },
    { mode: 'guided', text: "Which arc describes Ravi's trajectory?",
      options: [
        { id: "a", text: "Positive Change Arc — He lets go of the need to repeat his past and makes something imperfect, honest, and entirely new. The lighter stays in his pocket." },
        { id: "b", text: "Fall Arc — He chases another masterpiece so desperately that he destroys the relationships and trust that were the only genuine things left in his life." },
        { id: "c", text: "Disillusionment Arc — He discovers his mentor wasn't the genius he remembered. The pedestal collapses — and with it, his excuse for not trying." },
      ] },
    { mode: 'open', text: "Where does Ravi end? What has changed in him — and what was the moment the change became irreversible?", options: [] },
  ],
];

// ─────────────────────────────────────────────────────────
// LAKSHMI — 28 questions across 8 dimensions
// ─────────────────────────────────────────────────────────

const LAKSHMI_QUESTIONS: DemoQuestion[][] = [
  // DIM 0: THE WOUND (4 questions)
  [
    { mode: 'open', text: "Lakshmi pulled her own short film from a festival the night before the screening. Why? What was in that film that was too true to show?", options: [] },
    { mode: 'open', text: "She was 25 when she pulled it. Fifteen years later, the sticky note still says 'Not ready.' What happened in her life around 25 that made visibility feel dangerous?", options: [] },
    { mode: 'guided', text: "What did that self-silencing take from Lakshmi?",
      options: [
        { id: "a", text: "The belief she had a story worth telling. She decided she was a mirror, not a light source — and she's been reflecting other people's truth ever since." },
        { id: "b", text: "Permission to be seen. She became so good at making other people visible that her own invisibility started feeling like a skill, not a wound." },
        { id: "c", text: "The belief that her emotions were proportionate. The film scared her because the feelings were too big. She's spent fifteen years making herself smaller." },
      ] },
    { mode: 'open', text: "How does Lakshmi's body carry this wound? What does she do physically in moments when she's about to reveal something personal?", options: [] },
  ],

  // DIM 1: THE LIE (3 questions)
  [
    { mode: 'open', text: "What false belief did pulling the film install? The Lie Lakshmi lives by — the sentence that keeps her behind the editing console instead of in front of the camera.", options: [] },
    { mode: 'guided', text: "How does this Lie show up in her daily behavior?",
      options: [
        { id: "a", text: "She makes herself indispensable to everyone else's projects. If she's always busy with their stories, she never has to face her own." },
        { id: "b", text: "She collects other people's moments on sticky notes but never writes about her own. She's the world's most meticulous observer of lives she won't live." },
        { id: "c", text: "She fights passionately for other people's vulnerable footage but pulled her own. The double standard is invisible to her because the Lie tells her their truth matters and hers doesn't." },
      ] },
    { mode: 'open', text: "What would Lakshmi have to feel if the Lie broke? What emotion is the Lie holding back?", options: [] },
  ],

  // DIM 2: THE DRIVE (4 questions)
  [
    { mode: 'guided', text: "What does Lakshmi need from life more than anything — the primal drive underneath the selflessness?",
      options: [
        { id: "a", text: "To be witnessed. Not praised, not validated — witnessed. To have someone see HER the way she sees everyone else." },
        { id: "b", text: "To tell her own story before it's too late. She's watched enough films to know what happens to characters who wait too long." },
        { id: "c", text: "To matter as a protagonist, not a supporting character in everyone else's narrative." },
      ] },
    { mode: 'open', text: "Why THIS drive? What did the wound take that she's been trying to recover?", options: [] },
    { mode: 'open', text: "What does Lakshmi tell people about why she loves editing? And what's the real reason — the one even she might not fully see?", options: [] },
    { mode: 'open', text: "What does Lakshmi consciously WANT from this story versus what she actually NEEDS?", options: [] },
  ],

  // DIM 3: THE MASK (3 questions)
  [
    { mode: 'open', text: "Describe the Lakshmi everyone knows. The editor, the listener, the woman who holds space. What is the performance?", options: [] },
    { mode: 'guided', text: "When does the mask fail?",
      options: [
        { id: "a", text: "When someone turns the question back on her — genuinely asks how SHE is — and the silence that follows is too long. The mask doesn't have a script for receiving." },
        { id: "b", text: "When she finds a frame in someone's footage that accidentally captures her reflection. She stares at it. She doesn't cut it." },
        { id: "c", text: "At the wall of sticky notes. Each one is someone else's moment. She can't explain why she keeps going back to it, or why it sometimes makes her cry." },
      ] },
    { mode: 'open', text: "If Lakshmi stopped being everyone's editor and confessor — if she put herself first for one year — what would happen?", options: [] },
  ],

  // DIM 4: THE VOICE (4 questions)
  [
    { mode: 'guided', text: "How does Lakshmi speak?",
      options: [
        { id: "a", text: "Spare and precise — the economy of someone who removes for a living. She speaks in cuts. Every word earned its place." },
        { id: "b", text: "Warm but redirecting. She asks questions instead of answering them. A conversation with Lakshmi feels like therapy — and that's by design." },
        { id: "c", text: "Observational and quiet, with sudden devastating accuracy. She'll say one sentence that makes you feel completely seen — then go silent." },
      ] },
    { mode: 'open', text: "What does Lakshmi refuse to talk about? What emotion or experience is outside the boundary of her language?", options: [] },
    { mode: 'open', text: "The sticky notes reveal a secret lyricism. Write one of her sticky notes — a moment she overheard and couldn't forget.", options: [] },
    { mode: 'open', text: "How does Lakshmi sound when she's defending someone else's work versus when someone asks about hers?", options: [] },
  ],

  // DIM 5: THE BODY (3 questions)
  [
    { mode: 'open', text: "How does Lakshmi inhabit the editing suite? Describe her physical relationship to that space — the chair, the screens, the way she moves.", options: [] },
    { mode: 'guided', text: "What's Lakshmi's physical M.O.?",
      options: [
        { id: "a", text: "Contained stillness. She takes up as little space as possible — not from insecurity but from a practiced art of disappearing that she's mistaken for peace." },
        { id: "b", text: "Attentive presence. When she's with someone, her body is completely oriented toward them. She gives total attention to everyone except herself." },
        { id: "c", text: "Hands that touch carefully. How she handles a tape, a sticky note, a coffee cup — everything is deliberate, gentle, precise. The hands of someone who knows things are fragile." },
      ] },
    { mode: 'open', text: "What does Lakshmi's body do in the moment she decides not to share something personal? Is there a tell?", options: [] },
  ],

  // DIM 6: THE RELATIONSHIPS (4 questions)
  [
    { mode: 'open', text: "Everyone tells Lakshmi everything. Who tells Lakshmi what she needs to hear? Is there anyone?", options: [] },
    { mode: 'guided', text: "What's her relationship pattern?",
      options: [
        { id: "a", text: "She becomes the confessor. Everyone's secrets land in her lap. The cost: she knows everything about everyone and nobody knows anything about her." },
        { id: "b", text: "She orbits. She stays close enough to be essential but never close enough to be known. Proximity without intimacy." },
        { id: "c", text: "She chooses people who are in crisis. Their urgency gives her a role. When they stabilize, she drifts — because a stable person might ask about her." },
      ] },
    { mode: 'open', text: "Who in this story sees Lakshmi in a way she doesn't want to be seen? Who looks past the selflessness and spots the hunger underneath?", options: [] },
    { mode: 'open', text: "What would Lakshmi need from a relationship to feel truly met — not needed, not useful, but met?", options: [] },
  ],

  // DIM 7: THE ARC (3 questions)
  [
    { mode: 'open', text: "Where does Lakshmi begin this story? What is she defending against, and what does she believe about her place in the world?", options: [] },
    { mode: 'guided', text: "Which arc describes Lakshmi?",
      options: [
        { id: "a", text: "Positive Change Arc — She believes her story isn't worth telling. The events of this film force her to step into the frame — literally or figuratively — and tell it anyway." },
        { id: "b", text: "Flat Arc — Lakshmi already knows the truth about stories (they must be told, not hoarded). Her arc is about finally applying that truth to herself." },
        { id: "c", text: "Corruption Arc — She knows she should tell her own story but keeps choosing other people's. Safety wins. The sticky note never comes down." },
      ] },
    { mode: 'open', text: "Where does Lakshmi end? Does she write the sticky note about herself — and if so, what does it say?", options: [] },
  ],
];

// ─────────────────────────────────────────────────────────
// VIKRAM — 28 questions across 8 dimensions
// ─────────────────────────────────────────────────────────

const VIKRAM_QUESTIONS: DemoQuestion[][] = [
  // DIM 0: THE WOUND (4 questions)
  [
    { mode: 'open', text: "Vikram's father was a gaffer — thirty years in film, zero credits. What specific moment crystallized Vikram's decision that visibility was survival?", options: [] },
    { mode: 'open', text: "When did young Vikram first feel ashamed of his father's work? What happened — and what did he do with that shame?", options: [] },
    { mode: 'guided', text: "What did growing up as a gaffer's son take from Vikram?",
      options: [
        { id: "a", text: "The ability to value invisible work. His father lit the frame for thirty years and Vikram learned to despise the dark. Light without credit became the worst thing he could imagine." },
        { id: "b", text: "Trust in the meritocracy. He watched his father do beautiful, essential work and get nothing. He concluded: the world doesn't reward skill. It rewards positioning." },
        { id: "c", text: "A son's uncomplicated love for his father. The shame came with conditions — he could love his father privately but not publicly. That split has never healed." },
      ] },
    { mode: 'open', text: "Vikram tells people his father was a cinematographer. When did the lie start — and what did it feel like the first time he said it?", options: [] },
  ],

  // DIM 1: THE LIE (3 questions)
  [
    { mode: 'open', text: "What is the Lie Vikram lives by? The false belief about power, worth, and visibility that drives every decision he makes. State it.", options: [] },
    { mode: 'guided', text: "How does this Lie shape his behavior?",
      options: [
        { id: "a", text: "Everything is transactional. People are useful until the shoot wraps. He can't afford loyalty because loyalty is what his father had — and look where it got him." },
        { id: "b", text: "He never stops building. The empire isn't big enough because the fear underneath it is bottomless. Every new acquisition is a sandbag against invisibility." },
        { id: "c", text: "He lies about origins — his father's, his own, the story of how he got his first break. The truth is too small for the mythology he needs to survive." },
      ] },
    { mode: 'open', text: "What would Vikram have to feel if the Lie collapsed? What's underneath the power?", options: [] },
  ],

  // DIM 2: THE DRIVE (4 questions)
  [
    { mode: 'guided', text: "What does Vikram need from life more than anything?",
      options: [
        { id: "a", text: "To never be erased the way his father was. To be the name that greenlights dreams — the person no one can ignore or forget." },
        { id: "b", text: "To reconcile with his father's legacy. Not publicly — privately. To look at the framed photo on his desk and feel pride instead of complicated shame." },
        { id: "c", text: "To be respected for something real. He's built an empire on positioning, but what he secretly wants is for someone to say 'the work is good' and mean the work, not the deal." },
      ] },
    { mode: 'open', text: "Why THIS drive? What did his father's invisibility take from young Vikram that the adult is still trying to recover?", options: [] },
    { mode: 'open', text: "What does Vikram tell the industry about his ambitions? What's the real engine underneath that he'd never admit?", options: [] },
    { mode: 'open', text: "What does Vikram WANT versus what he NEEDS?", options: [] },
  ],

  // DIM 3: THE MASK (3 questions)
  [
    { mode: 'open', text: "Describe the Vikram the industry sees. The producer, the dealmaker, the man in the room. What version of himself has he built?", options: [] },
    { mode: 'guided', text: "When does the mask fail?",
      options: [
        { id: "a", text: "On empty sets at 4 AM. He adjusts the lights with his father's hands — the same careful precision. Nobody important sees this. That's the point." },
        { id: "b", text: "When he learns a spot boy's name. He does it every time, compulsively — the small people, the invisible ones. It's the wound speaking through kindness." },
        { id: "c", text: "When someone mentions gaffers. His face does something fast and complicated — a micro-expression of grief, shame, and love that he kills before anyone can read it." },
      ] },
    { mode: 'open', text: "If the mask came off — if the industry discovered who his father really was, what he really came from — what does Vikram believe would happen?", options: [] },
  ],

  // DIM 4: THE VOICE (4 questions)
  [
    { mode: 'guided', text: "How does Vikram speak?",
      options: [
        { id: "a", text: "Smooth, efficient, every syllable load-bearing. Compliments that feel like contracts. Silences that feel like verdicts. He speaks in power." },
        { id: "b", text: "Strategic warmth. He can make anyone feel like the most important person in the room — for exactly as long as it serves him." },
        { id: "c", text: "Numbers and outcomes. He frames everything in terms of results, markets, returns. The language of money keeps the language of feeling at bay." },
      ] },
    { mode: 'open', text: "What will Vikram never discuss? What topic makes him change the subject or leave the room?", options: [] },
    { mode: 'open', text: "There's a line Vikram said once, alone, adjusting lights on an empty set. Something he whispered that no one heard. What was it?", options: [] },
    { mode: 'open', text: "How does Vikram talk when the deal has gone wrong — when the power is slipping? Does the voice change, or does the mask hold?", options: [] },
  ],

  // DIM 5: THE BODY (3 questions)
  [
    { mode: 'open', text: "How does Vikram move through the world? Describe his physical presence — the walk, the posture, the way he occupies a room.", options: [] },
    { mode: 'guided', text: "What's Vikram's physical M.O.?",
      options: [
        { id: "a", text: "Territorial. He claims space — the best seat, the head of the table, the center of the frame. His body says 'I belong here' even when the rest of him isn't sure." },
        { id: "b", text: "Immaculate presentation. Every detail controlled — the watch, the shoes, the posture. The body is another production he's managing." },
        { id: "c", text: "Surprising gentleness with objects. He handles equipment, props, and tools with a care that contradicts his ruthlessness with people. His father's hands never left him." },
      ] },
    { mode: 'open', text: "Describe Vikram alone with his father's framed photo. What does his body do that his words never would?", options: [] },
  ],

  // DIM 6: THE RELATIONSHIPS (4 questions)
  [
    { mode: 'open', text: "Who is Vikram in the most productive conflict with? Not his rival — the person whose existence challenges his Lie?", options: [] },
    { mode: 'guided', text: "What's Vikram's relationship pattern?",
      options: [
        { id: "a", text: "Transactional above, paternal below. He treats equals and superiors as assets. But the spot boys, the runners, the invisible workers — them he treats like sons." },
        { id: "b", text: "He tests loyalty constantly. Small betrayals planted to see who stays. He doesn't trust anyone who hasn't proven they'll stay through his worst." },
        { id: "c", text: "He builds dependencies. If people need him, they can't leave. He confused being needed with being loved a long time ago." },
      ] },
    { mode: 'open', text: "What does Vikram see in Arjun — the ghostwriter — that mirrors something about his own father? Why does that recognition disturb him?", options: [] },
    { mode: 'open', text: "Has Vikram ever been genuinely loved by someone who saw all of him — the ambition AND the shame? What happened?", options: [] },
  ],

  // DIM 7: THE ARC (3 questions)
  [
    { mode: 'open', text: "Where does Vikram begin this story? What does he believe about power, legacy, and what it means to matter?", options: [] },
    { mode: 'guided', text: "Which arc describes Vikram?",
      options: [
        { id: "a", text: "Positive Change Arc — Through the events of this story, Vikram discovers his father wasn't invisible — he was essential. The shame transforms into pride, and the empire becomes less important than the man." },
        { id: "b", text: "Fall Arc — He doubles down on control, sacrifices the last genuine connections he has, and ends up exactly where his father was — alone in a room full of equipment, invisible to the people who matter." },
        { id: "c", text: "Corruption Arc — He starts with a genuine love of cinema (inherited from his father) but the Lie corrupts it into pure commerce. By the end, he can't tell the difference between a good story and a good deal." },
      ] },
    { mode: 'open', text: "Where does Vikram end — and what does the framed photo of his father mean to him in the last scene?", options: [] },
  ],
];


// ─────────────────────────────────────────────────────────
// SKETCH LINES (for guided questions with options)
// Organized by character -> dimensionIndex -> optionId
// ─────────────────────────────────────────────────────────

const ALL_SKETCH_LINES: Record<string, Record<number, Record<string, string>>> = {
  "Arjun": {
    // Dim 0 (wound) Q2 guided
    0: {
      "a": "The wound is a verdict — his mentor's theft told him talent without power is just raw material for someone else's name.",
      "b": "The wound is a corruption — honesty became dangerous. He writes from the head now because the heart got robbed.",
      "c": "The wound is a lesson in visibility — being seen was the thing that destroyed him. So he disappeared.",
    },
    // Dim 1 (lie) Q1 guided
    1: {
      "a": "The Lie makes him allergic to completion — every unfinished draft is a judgment deferred.",
      "b": "The Lie makes him a ghost by design — invisible craft is the only kind that feels safe.",
      "c": "The Lie makes him a critic of courage — he calls other people's bravery 'naivete' because he can't afford to call it what it is.",
    },
    // Dim 2 (drive) Q0 guided
    2: {
      "a": "He needs his name on a page — not for fame, but for proof of existence.",
      "b": "He needs to finish the promise he made to himself at 22 — the screenplay is a vow, not a file.",
      "c": "He needs someone to read the real writing and not leave — love that survives honesty.",
    },
    // Dim 3 (mask) Q1 guided
    3: {
      "a": "The mask cracks on pride — when someone praises his ghost-work, the real writer flashes before the professional can catch him.",
      "b": "The mask dissolves in solitude — at 2 AM, with both files open, there is no audience to perform for.",
      "c": "The mask fails against Meera — she reads people the way he reads scripts, and there's no hiding from that.",
    },
    // Dim 4 (voice) Q0 guided
    4: {
      "a": "He speaks in observations about others to avoid being observed himself — every metaphor is a misdirection.",
      "b": "Quiet surface, sudden raw poetry — like he's been hoarding the real words for an emergency.",
      "c": "Self-deprecating humor as architecture — each joke is a door closing on an honest conversation.",
    },
    // Dim 5 (body) Q1 guided
    5: {
      "a": "He makes himself physically small — camouflage as lifestyle. The less space he claims, the safer the wound.",
      "b": "Attentive listening as deflection — he leans into you so you won't notice he's leaning away from himself.",
      "c": "Restless hands always working on something — the body writing even when the will won't.",
    },
    // Dim 6 (relationships) Q1 guided, Q3 guided
    6: {
      "a": "He disappears from relationships in slow motion — methodical withdrawal disguised as mutual silence.",
      "b": "He becomes everyone's ghost-therapist — giving the attention he can't give himself.",
      "c": "He falls for people who don't need him — if they're independent, they can't be hurt by his disappearance.",
      // Q3 options
      "d": "His deepest war is with himself — the writer who wants to be seen versus the ghost who built a life out of being invisible.",
      "e": "His deepest war is with Meera — the only person who can see what he's hiding, making her the most dangerous and necessary person alive.",
      "f": "His deepest war is with a dead man — his mentor stole his screenplay but Arjun is still arguing with the empty chair.",
    },
    // Dim 7 (arc) Q1 guided
    7: {
      "a": "Positive Change — from believing his voice isn't worth hearing to writing something under his own name, because Meera showed him silence was the real theft.",
      "b": "Disillusionment — the industry he served doesn't deserve his loyalty, and the truth is colder than the comfortable anonymity he'd built.",
      "c": "Flat Arc — he always knew storytelling's power. The cost was making others see it too.",
    },
  },
  "Meera": {
    0: {
      "a": "The wound said softness kills — her mother was soft and the world took her. Meera armored up.",
      "b": "The wound installed conditional love — 'I'm sorry I wasn't enough' became the price of admission for every relationship.",
      "c": "The wound collapsed time — she watched it run out once and now treats every moment like borrowed footage.",
    },
    1: {
      "a": "The Lie runs her like a production — every emotion scheduled, every relationship budgeted. Spontaneity is chaos, and chaos killed her mother.",
      "b": "The Lie makes her an expert on emotion she refuses to feel — she can produce vulnerability but can't experience it.",
      "c": "The Lie measures her in output — one unproductive day feels like sliding back toward the helpless girl at her mother's bedside.",
    },
    2: {
      "a": "She needs her mother's pride — and since that's impossible, she needs the universe to say it instead, through awards and empires.",
      "b": "She needs permission to stop — to discover there's a Meera underneath the producer worth knowing.",
      "c": "She needs to be loved without earning it — every relationship requires her to be impressive first.",
    },
    3: {
      "a": "The mask fails in the edit suite — alone, wearing her mother's glasses, the producer disappears and a grieving daughter takes her place.",
      "b": "The mask fails when art mirrors life — a story that accidentally resembles hers makes her controlling, aggressive. The emotions she can't manage in herself, she tries to direct on screen.",
      "c": "The mask fails in secret screenings — watching dailies nobody asked her to watch, whispering notes to the screen like talking to someone who isn't there.",
    },
    4: {
      "a": "Controlled precision — every word has a purpose. She edits herself in real time the way she edits footage.",
      "b": "Warm but boundaried — exactly enough openness to feel valued, never enough to get close. Professional intimacy as art form.",
      "c": "Commanding in public, musical in private — the distance between the two is the distance between who she is and who she performs.",
    },
    5: {
      "a": "Command through composure — always the most put-together person in the room. The armor is beautiful.",
      "b": "Strategic vulnerability — she knows when to show tiredness, when to let the guard seem to slip. Each moment is a choice.",
      "c": "Perpetual motion — always moving, always busy. Stillness invites feeling and feeling is the enemy.",
    },
    6: {
      "a": "Three rehearsed vulnerabilities on rotation — enough openness to seem real, then redirect. She turns lovers into colleagues.",
      "b": "She chooses people who need her more than she needs them — it's safer to be needed than to need.",
      "c": "She works so hard that distance looks like dedication — by the time anyone notices she's pulled away, they blame the schedule.",
    },
    7: {
      "a": "Positive Change — the Lie cracks against something she can't produce her way through. She learns to grieve. Finally.",
      "b": "Disillusionment — the empire she built to honor her mother actually betrays everything her mother valued. The truth is devastating and freeing.",
      "c": "Fall — she doubles down on control, sacrificing every genuine relationship. She becomes someone her mother wouldn't recognize.",
    },
  },
  "Ravi": {
    0: {
      "a": "The wound is ownership — he can never be sure where the mentor ends and he begins. The first film might not be his.",
      "b": "The wound killed recklessness — once you know you can fail, the ignorance that made you great dies.",
      "c": "The wound is about readiness — his best work came from not knowing enough to be afraid. Knowledge poisoned the well.",
    },
    1: {
      "a": "The Lie over-prepares everything — he calls it mastery. It's the elimination of surprise, which was his only gift.",
      "b": "The Lie curates an echo chamber — anyone who challenges him feels dangerous. He built a team of mirrors.",
      "c": "The Lie trades on past glory — living off the interest of a single deposit made a decade ago.",
    },
    2: {
      "a": "He needs proof the first film wasn't a fluke — an artist under the reputation, not a lucky accident.",
      "b": "He needs forgiveness — from himself, from his mentor's memory — for not being able to do it alone.",
      "c": "He needs the recklessness back — he'd trade his filmography for one more moment of creative freedom.",
    },
    3: {
      "a": "The mask fails between 'cut' and the next setup — when he's not directing, his face goes blank. The confidence evaporates.",
      "b": "The mask fails watching someone else's great film — admiration and grief for the version of himself that could have made it.",
      "c": "The mask fails at the lighter — the involuntary reach is the truest thing about him.",
    },
    4: {
      "a": "Interview-polished and quotable — every sentence rehearsed. He's practiced spontaneity until it's seamless.",
      "b": "Referential and charming — always citing other directors. His speech is a bibliography hiding the absence of his own voice.",
      "c": "Warm and disarming — he makes everyone feel equal. It's control dressed as generosity.",
    },
    5: {
      "a": "Command through ease — lounging, leaning, taking up space. The relaxation is performed but effective.",
      "b": "Kinetic authority — always touching the camera, adjusting lights, demonstrating. His body is his directing instrument.",
      "c": "The lighter as anchor — his hands are never still. It's a fidget, a tell, and a prayer.",
    },
    6: {
      "a": "He competes with ghosts — every collaborator measured against the mentor, the younger self, the impossible standard.",
      "b": "Aggressive mentoring with a ceiling — pouring into younger filmmakers but never letting them surpass him.",
      "c": "Charm first, distance later — the most exciting person in the room for exactly long enough.",
    },
    7: {
      "a": "Positive Change — he makes something imperfect, honest, and new. The lighter stays in his pocket.",
      "b": "Fall — he chases another masterpiece so desperately he destroys everything genuine left in his life.",
      "c": "Disillusionment — the mentor wasn't the genius he remembered. The pedestal collapses, and with it, the excuse.",
    },
  },
  "Lakshmi": {
    0: {
      "a": "The wound made her a mirror — she decided she reflects, not emits. Fifteen years of other people's light.",
      "b": "The wound made invisibility feel like skill — she's so good at making others visible that her own disappearance looks intentional.",
      "c": "The wound was proportion — the feelings in the film were too big. She's spent fifteen years making herself smaller.",
    },
    1: {
      "a": "The Lie keeps her busy with everyone else's stories — perpetual indispensability as avoidance strategy.",
      "b": "The Lie collects others' moments on sticky notes — meticulous observation of lives she won't live.",
      "c": "The Lie fights for others' vulnerable footage while her own stays in a drawer — a double standard invisible to her.",
    },
    2: {
      "a": "She needs to be witnessed — not praised, not validated. Seen. The way she sees everyone else.",
      "b": "She needs to tell her own story before it's too late — she's watched enough films to know what happens to characters who wait.",
      "c": "She needs to matter as a protagonist — not a supporting character in everyone else's narrative.",
    },
    3: {
      "a": "The mask fails when someone asks how SHE is — the silence is too long. The mask has no script for receiving.",
      "b": "The mask fails when she finds her own reflection in someone's footage — she stares. She doesn't cut it.",
      "c": "The mask fails at the sticky note wall — she can't explain why it makes her cry.",
    },
    4: {
      "a": "Spare and precise — the economy of someone who removes for a living. She speaks in cuts.",
      "b": "Warm but redirecting — she asks questions instead of answering. A conversation with her feels like therapy.",
      "c": "Quiet with sudden devastating accuracy — one sentence makes you feel seen. Then silence.",
    },
    5: {
      "a": "Contained stillness — as little space as possible. Not insecurity — a practiced art of disappearing mistaken for peace.",
      "b": "Complete orientation toward others — her body says 'I see you' to everyone but herself.",
      "c": "Hands that touch carefully — every object handled with deliberate gentleness. The hands of someone who knows things break.",
    },
    6: {
      "a": "She becomes the confessor — everyone's secrets, no one knows hers. The cost is total asymmetry.",
      "b": "She orbits — close enough to be essential, never close enough to be known.",
      "c": "She chooses people in crisis — their urgency gives her a role. When they stabilize, she drifts.",
    },
    7: {
      "a": "Positive Change — she steps into the frame and tells her own story. The sticky note comes down.",
      "b": "Flat Arc — she knows stories must be told. Her arc is applying that truth to herself.",
      "c": "Corruption — she keeps choosing other people's stories. Safety wins. The note stays up forever.",
    },
  },
  "Vikram": {
    0: {
      "a": "The wound taught him to despise invisible work — his father lit the frame for thirty years and Vikram learned to hate the dark.",
      "b": "The wound killed meritocracy — skill without positioning is just labor. His father proved that.",
      "c": "The wound split love from pride — he could love his father privately but not publicly. That split never healed.",
    },
    1: {
      "a": "The Lie makes everything transactional — loyalty is what his father had, and look where it landed.",
      "b": "The Lie never stops building — the empire is never enough because the fear underneath is bottomless.",
      "c": "The Lie rewrites origins — his father's story, his own, the mythology he needs to survive.",
    },
    2: {
      "a": "He needs to never be erased — to be the name no one can ignore or forget.",
      "b": "He needs reconciliation — to look at his father's photo and feel pride instead of complicated shame.",
      "c": "He needs to be respected for something real — 'the work is good' meaning the work, not the deal.",
    },
    3: {
      "a": "The mask fails at 4 AM on empty sets — adjusting lights with his father's hands. Nobody sees this. That's the point.",
      "b": "The mask fails at names — he learns every spot boy's name. The invisible workers get his tenderness.",
      "c": "The mask fails at the word 'gaffer' — his face does something fast and complicated: grief, shame, love, all killed before anyone can read it.",
    },
    4: {
      "a": "Smooth and efficient — compliments that feel like contracts, silences that feel like verdicts. He speaks in power.",
      "b": "Strategic warmth — he can make anyone feel important for exactly as long as it serves him.",
      "c": "Numbers and outcomes — the language of money keeps the language of feeling at bay.",
    },
    5: {
      "a": "Territorial — best seat, head of table, center of frame. His body says 'I belong here' even when the rest of him isn't sure.",
      "b": "Immaculate presentation — every detail controlled. The body is another production he's managing.",
      "c": "Surprising gentleness with objects — he handles equipment with a care that contradicts his ruthlessness. His father's hands.",
    },
    6: {
      "a": "Transactional above, paternal below — equals are assets, but spot boys are sons.",
      "b": "Constant loyalty tests — small planted betrayals to see who stays. Trust must be proven through his worst.",
      "c": "He builds dependencies — if people need him, they can't leave. He confused 'needed' with 'loved' a long time ago.",
    },
    7: {
      "a": "Positive Change — he discovers his father wasn't invisible, he was essential. The shame becomes pride. The empire matters less than the man.",
      "b": "Fall — he doubles down, sacrifices every connection, ends up alone in a room full of equipment. His father's fate from the opposite direction.",
      "c": "Corruption — genuine cinema love corrupts into pure commerce. By the end he can't tell a good story from a good deal.",
    },
  },
};


// ─────────────────────────────────────────────────────────
// KLEO SUGGESTIONS — per character, per dimension, per question
// ─────────────────────────────────────────────────────────

const ALL_KLEO: Record<string, { answer: string; reasoning: string; source?: string }[][]> = {
  "Arjun": [
    // Dim 0: Wound
    [
      { answer: "His first screenplay was stolen by his mentor — the man he trusted most. The film won a National Award. Arjun's name appeared nowhere. He never wrote under his own name again.", reasoning: "Chubbuck's Previous Circumstances: the wound must explain the Overall Objective. If Arjun hides behind other people's words, something made authorship dangerous. Theft by a trusted figure does that.", source: "Chubbuck" },
      { answer: "He was 22. Old enough to understand betrayal, young enough to think it was a verdict on his talent rather than a comment on his mentor's character.", reasoning: "Weiland's Ghost: the misinterpretation IS the wound. A 22-year-old doesn't have the perspective to separate theft from judgment.", source: "Weiland" },
      { answer: "The belief he was safe being seen. Visibility became dangerous. Invisibility became armor.", reasoning: "Jung's Shadow: the thing Arjun represses is his own desire for recognition. It's not that he doesn't want to be seen — it's that being seen once destroyed him.", source: "Jung" },
      { answer: "His shoulders pull in slightly when he enters rooms — as if making himself a smaller target. And his right hand reaches for a pen that isn't always there, like the body still wants to write even when the will won't.", reasoning: "Egri's Physiology: the wound doesn't just live in the mind. It reshapes the body. Physical habits are involuntary confessions.", source: "Egri" },
    ],
    // Dim 1: Lie
    [
      { answer: "If I put my real name on my real work, it will be stolen again — or worse, it will be ignored, and I'll learn the first time wasn't about theft at all. It was about quality.", reasoning: "Weiland: The Lie is always a specific, statable belief. Arjun's deepest fear isn't theft — it's the possibility that his work isn't good enough to survive being his.", source: "Weiland" },
      { answer: "Fear of completion. He starts things brilliantly and abandons them. The half-finished screenplay is the proof — finishing means being judged, and the last judgment destroyed him.", reasoning: "McKee's Gap: the symptom reveals the disease. Arjun's pattern of non-completion is the Lie made behavioral.", source: "McKee" },
      { answer: "The Lie protects him from the possibility that the screenplay, if finished and shown, might not be great. As long as it's unfinished, it's still potentially perfect. Completion would make it finite — and finite things can fail.", reasoning: "Jung's Compensation: the unconscious protects the ego from truths it can't handle. Arjun's non-completion is a defense mechanism masquerading as creative temperament.", source: "Jung" },
    ],
    // Dim 2: Drive
    [
      { answer: "To be seen as the author of his own story — not someone else's ghost. Recognition isn't vanity for Arjun. It's proof of existence. His mentor erased him. He needs to write himself back.", reasoning: "Chubbuck: the Overall Objective must be a primal human need with the heart in jeopardy. 'To exist as oneself' is as primal as it gets.", source: "Chubbuck" },
      { answer: "The wound took authorship — the right to claim his own voice. The drive is trying to recover exactly that. Not fame, not success — the right to say 'I wrote this.'", reasoning: "The drive is the equal-and-opposite response to the wound. What was taken → what is pursued.", source: "Chubbuck + Weiland" },
      { answer: "He tells people ghostwriting is smart, sustainable, professional. The real reason: it's the only kind of writing where failure is impossible because success was never the point.", reasoning: "McKee's Motivation vs. Justification: the gap between the stated reason and the real reason is the character's richest territory.", source: "McKee" },
      { answer: "WANT: A produced screenplay with his name on it. NEED: To forgive himself for hiding and realize the half-finished script is already the best thing he's written — it just needs an author brave enough to claim it.", reasoning: "Weiland: Want and Need are always at war. The Want is what the Lie says he needs. The Need is what would actually heal the Ghost.", source: "Weiland" },
    ],
    // Dim 3: Mask
    [
      { answer: "The pragmatist. He wears competence and professionalism like a second skin. 'I'm not hiding — I'm being strategic.' The mask is fear in a sensible outfit.", reasoning: "Jung's Persona: the mask is never random — it's the wound's answer to the world. Arjun's wound made visibility dangerous, so the mask performs comfortable invisibility.", source: "Jung" },
      { answer: "When Meera asks a question that's too specific, too right, too close. She reads people the way he reads scripts — and the mask can't operate against someone who sees through text.", reasoning: "Chubbuck's Obstacles: the person most capable of triggering the mask's failure is also the person most necessary for the character's growth.", source: "Chubbuck" },
      { answer: "It would cost him the identity he's built for a decade. If the mask drops, he's not 'Arjun the reliable ghostwriter' anymore. He's 'Arjun the man who hid for ten years.' That's a harder person to be.", reasoning: "Egri: dropping the mask means admitting the crystallized trait has been a defense, not a personality. That's an identity crisis.", source: "Egri" },
    ],
    // Dim 4: Voice
    [
      { answer: "Quiet and economical on the surface, but when pushed — sudden raw poetry. Like he's been saving the real words for an emergency that might never come.", reasoning: "McKee's speech signature: a character's voice must be so specific you could identify them from dialogue alone. Arjun's compression-to-eruption pattern IS his voice.", source: "McKee" },
      { answer: "His own first film. The stolen screenplay. His mentor. He'll discuss craft, industry, other people's work — but the moment anyone gets near HIS story, the subject changes.", reasoning: "McKee's Three Spheres: the Unsaid (Sphere 2) and the Unsayable (Sphere 3). Arjun's stolen screenplay lives in the Unsayable — it exceeds his capacity for speech.", source: "McKee" },
      { answer: "'You have no idea how good that script you're reading is. You think you wrote it. You didn't. I did. And the fact that you'll never know is the thing I'll carry home tonight and unpack like a suitcase full of someone else's clothes.'", reasoning: "Chubbuck's Inner Monologue: always addressed to 'you,' always uncensored, always revealing what the spoken words conceal.", source: "Chubbuck" },
      { answer: "He gets quieter and more precise — not more chaotic. The mask tightens under pressure. He edits himself in real time until there's almost nothing left. The silence that follows is the most honest thing he says.", reasoning: "McKee: how speech changes under pressure reveals true character. Some people explode; some people compress. Arjun compresses to nothing.", source: "McKee" },
    ],
    // Dim 5: Body
    [
      { answer: "Periphery first. He scans the room from the edge before committing to a position. Finds the seat with the best sightline but worst visibility. Sits down like he's borrowing the chair.", reasoning: "Egri's Physiology: the body enacts the psychology. A man who hides in his work will hide in a room.", source: "Egri" },
      { answer: "Attentive listening as deflection — he leans into you so you won't notice he's leaning away from himself. The posture says 'I'm here for you' and means 'please don't ask about me.'", reasoning: "Chubbuck's DOINGS: 'words can lie, but behavior always tells the truth.' Arjun's listening posture is his M.O. — genuine care AND strategic self-concealment.", source: "Chubbuck" },
      { answer: "When he's ghostwriting, his hands are efficient, fast, professional. When he opens the real file — the 2 AM file — his hands slow down. They hover over the keys like the words might be hot.", reasoning: "The body knows the difference between work and truth. The hesitation is the body protecting the wound.", source: "Egri + Chubbuck" },
    ],
    // Dim 6: Relationships
    [
      { answer: "Meera. She's the only person who sees what he's hiding, and that makes her simultaneously the most dangerous and most necessary person in his life. He can't walk away because she holds a mirror he needs.", reasoning: "Egri's Unity of Opposites: the unbreakable bond. The person you most need is often the person you most fear. That's the bond.", source: "Egri" },
      { answer: "He disappears. Slowly, methodically, until the other person thinks the silence was mutual. He did it with his best friend, he's doing it with himself. It's his signature move and his deepest cruelty.", reasoning: "Chubbuck's relationship pattern: every character has a repeating relationship M.O. that traces back to the wound. Arjun's wound was someone taking his work; his pattern is taking himself away.", source: "Chubbuck" },
      { answer: "He sees cowardice in Vikram — the producer who builds empires instead of making art. But Arjun's contempt is projection. Vikram chose visibility and power; Arjun chose hiding and craft. Both are running from the same fear.", reasoning: "Jung's Projection: what we hate in others is what we refuse to see in ourselves. Arjun's shadow IS the desire for power and recognition he's denied.", source: "Jung" },
      { answer: "With himself. The writer who wants to be seen versus the ghost who built a life out of being invisible. Both are him. The conflict can't be externalized because the enemy lives inside.", reasoning: "McKee's Private Conflict: the deepest, most revealing conflict is always the character's war with themselves. Everything else is a symptom.", source: "McKee" },
    ],
    // Dim 7: Arc
    [
      { answer: "At page one, Arjun believes his voice isn't worth hearing — or worse, that it's worth hearing but exposing it would destroy him. He's defended against hope. He's made a life that doesn't require risk. It works. It's killing him.", reasoning: "Weiland: the character's starting state must clearly dramatize the Lie. Arjun's opening is a functional life built on a dysfunctional belief.", source: "Weiland" },
      { answer: "Positive Change Arc — He believes a Lie, is forced by Meera and the story's events to confront it, and ultimately writes something under his own name. The screenplay isn't the climax — letting someone read it is.", reasoning: "Weiland: in a Positive Change Arc, the character rejects the Lie and embraces the Truth. For Arjun, the Truth is: 'My voice matters enough to risk.'", source: "Weiland" },
      { answer: "Arjun ends as someone who has written his own name on his own work — not because it's safe, but because he's no longer willing to be invisible. What it cost: the comfortable anonymity that protected him for a decade. He's exposed now. And alive.", reasoning: "Egri's pole-to-pole growth: Arjun travels from invisible → visible, from ghost → author. The cost is the safety of hiding.", source: "Egri" },
    ],
  ],

  // Simplified Kleo entries for remaining characters (first entry per dimension)
  "Meera": [
    [{ answer: "Her mother died in a hospital bed, mid-sentence. The last words were 'I'm sorry I wasn't enough.' Meera was 19. She's been proving that sentence wrong ever since — and the person she's arguing with is already gone.", reasoning: "Chubbuck: the wound must explain the drive. Meera's empire is a rebuttal to a dead woman's apology.", source: "Chubbuck" }, { answer: "She was 19 — old enough to hear the words, too young to understand they were her mother's self-assessment, not a judgment of Meera.", reasoning: "The misinterpretation is the wound.", source: "Weiland" }, { answer: "The belief she was allowed to be soft. Softness killed her mother. Meera armored up.", reasoning: "Jung: what we reject in ourselves becomes the Shadow.", source: "Jung" }, { answer: "She puts on her mother's glasses when she needs to feel. It's the only ritual that bypasses the armor.", reasoning: "Egri: the body carries what the mind won't.", source: "Egri" }],
    [{ answer: "If I stop producing, I will feel the grief I've been outrunning since I was 19. The Lie says: keep building, keep moving, don't stop — because stillness is where the pain lives.", reasoning: "Weiland: the Lie is always a survival adaptation that has become a prison.", source: "Weiland" }, { answer: "She treats every relationship like a production — planned, budgeted, deliverable. Spontaneity feels like chaos. Chaos killed her mother.", reasoning: "The Lie shapes daily behavior.", source: "Weiland + Chubbuck" }, { answer: "Grief. Unprocessed, unfilmed, un-produced grief. The Lie holds it back like a dam.", reasoning: "The Lie is armor against a specific feeling.", source: "Jung" }],
    [{ answer: "To hear 'I'm proud of you' from someone who can never say it — so she's building something so undeniable the universe says it instead.", reasoning: "Chubbuck: the Overall Objective is always a primal need with the heart in jeopardy.", source: "Chubbuck" }, { answer: "Her mother's death took the only audience whose opinion mattered. The drive is trying to replace that audience with the entire world.", reasoning: "The wound → the drive.", source: "Chubbuck + Weiland" }, { answer: "She says: 'My mother deserved to have her stories told.' Real reason: 'If I stop, I'll have to feel what happened.'", reasoning: "Motivation vs. justification.", source: "McKee" }, { answer: "WANT: The biggest production company in South India. NEED: To stop running and grieve — to make her mother's film as a love letter, not a production.", reasoning: "Want vs. Need.", source: "Weiland" }],
    [{ answer: "Professional excellence as identity. She's built a life indistinguishable from a production schedule — everything planned, crewed, budgeted. Including her emotions.", reasoning: "Jung: the Persona is the wound's answer to the world.", source: "Jung" }, { answer: "In the edit suite, alone, wearing her mother's glasses. Her shoulders finally drop.", reasoning: "The mask fails when the audience disappears.", source: "Chubbuck" }, { answer: "A grieving 19-year-old who never got to finish the conversation. That's who's underneath — and Meera is terrified she's still that helpless.", reasoning: "Under every mask is the age the wound happened.", source: "Jung" }],
    [{ answer: "Controlled, precise, producer-efficient. Every word has a purpose. She edits herself in real time.", reasoning: "McKee: voice IS character.", source: "McKee" }, { answer: "Her mother. The hospital room. The last sentence. Everything around it. She'll discuss grief in the abstract, never the specific.", reasoning: "McKee's Unsayable.", source: "McKee" }, { answer: "'You think I'm strong. I need you to think that. If you saw what I'm actually holding together right now you'd understand why I can't let you any closer.'", reasoning: "Chubbuck: Inner Monologue is defined paranoia.", source: "Chubbuck" }, { answer: "She gets sharper. Colder. More efficient. The emotion compresses into precision. She weaponizes competence.", reasoning: "Speech under pressure reveals true character.", source: "McKee" }],
    [{ answer: "She enters like she owns the building — which she might. Straight to the center. Eye contact with everyone she needs, no one she doesn't. The body is a press release.", reasoning: "Egri: the body enacts the psychology.", source: "Egri" }, { answer: "Command through composure. Always the most put-together person in the room.", reasoning: "Chubbuck's DOINGS.", source: "Chubbuck" }, { answer: "Her body curls. She becomes smaller. She holds the glasses in both hands like something alive. The producer is gone and a daughter is sitting in the dark.", reasoning: "The private body is the real body.", source: "Egri" }],
    [{ answer: "Her mother's memory. The empire was built for her, but the building of it required becoming someone she wouldn't recognize. Meera can't leave the relationship with a ghost.", reasoning: "Egri: Unity of Opposites with the dead.", source: "Egri" }, { answer: "Three rehearsed vulnerabilities on rotation. She turns lovers into colleagues.", reasoning: "Chubbuck: relationship pattern.", source: "Chubbuck" }, { answer: "She projects control onto Vikram — judging his transactional nature while being equally transactional about emotions.", reasoning: "Jung: projection.", source: "Jung" }, { answer: "'You did enough. You were enough. Please stop apologizing.' But Meera can't say it because the woman who needs to hear it can't hear anymore.", reasoning: "The relationship that can't resolve is the engine.", source: "Chubbuck" }],
    [{ answer: "At page one, Meera believes achievement = safety. She is a fortress. Everything runs. Nothing is felt.", reasoning: "Weiland: opening state dramatizes the Lie.", source: "Weiland" }, { answer: "Positive Change Arc — the Lie cracks when she encounters something she can't produce her way through. She learns to grieve. Finally.", reasoning: "Weiland: Positive Change.", source: "Weiland" }, { answer: "She ends wearing the glasses not as armor but as connection. The empire is still there, but it's not all of her anymore. What it cost: the myth of invulnerability.", reasoning: "Egri: pole-to-pole.", source: "Egri" }],
  ],

  "Ravi": [
    [{ answer: "His mentor gave him the core idea for the first film during their last conversation. Then the stroke. The lighter isn't a memento — it's evidence of a debt he can never repay or verify.", reasoning: "The wound is ambiguity — he'll never know how much was his.", source: "Chubbuck" }, { answer: "The mentor said something like 'You have the instinct. You just need to stop thinking.' And then he couldn't speak again.", reasoning: "The last conversation becomes scripture.", source: "Weiland" }, { answer: "The ability to create without self-consciousness. Once you know you can fail, recklessness dies. And recklessness was his entire gift.", reasoning: "The wound killed the mechanism that made him great.", source: "Jung" }, { answer: "The flick happens when the body remembers the debt the mouth won't discuss.", reasoning: "Egri: physiology.", source: "Egri" }],
    [{ answer: "What worked once will work again if I'm careful enough. The Lie turns art into engineering and spontaneity into risk management.", reasoning: "Weiland: the Lie.", source: "Weiland" }, { answer: "He over-prepares. Every shot planned. He calls it mastery. It's the elimination of surprise.", reasoning: "The Lie in behavior.", source: "Weiland" }, { answer: "That the first film was an accident — that he has no actual talent, only the borrowed spark of a dead man.", reasoning: "What the Lie guards against.", source: "Jung" }],
    [{ answer: "To feel the recklessness again. Not confidence — the actual willingness to fail. He'd trade his filmography for one more moment of creative freedom.", reasoning: "Chubbuck: primal need.", source: "Chubbuck" }, { answer: "The wound took spontaneity. The drive wants it back. But you can't will yourself into recklessness — that's the paradox.", reasoning: "Wound → drive.", source: "Chubbuck" }, { answer: "He tells people: 'I'm taking my time. Choosing the right project.' Real answer: every project terrifies him.", reasoning: "Motivation vs. justification.", source: "McKee" }, { answer: "WANT: Another masterpiece. NEED: To make something imperfect and survive it.", reasoning: "Want vs. Need.", source: "Weiland" }],
    [{ answer: "Director-as-brand. Charming, quotable, the lighter flick as signature move. The performance is so good he's forgotten what conviction feels like.", reasoning: "Jung: the Persona.", source: "Jung" }, { answer: "The lighter is the truest thing about him — the involuntary reach is the body remembering a relationship the mouth won't discuss.", reasoning: "The mask fails at the body.", source: "Chubbuck" }, { answer: "That people would see him as a one-hit wonder. Not a has-been — a never-was-in-the-first-place.", reasoning: "The mask guards against an identity death.", source: "Weiland" }],
    [{ answer: "Interview-polished. Every sentence sounds rehearsed because it has been. He's practiced spontaneity.", reasoning: "McKee: voice.", source: "McKee" }, { answer: "His mentor's stroke. The film's true origins. Anything that threatens the mythology.", reasoning: "McKee: the Unsayable.", source: "McKee" }, { answer: "'If they knew. If they knew how much of it was his idea. If they knew I've been performing a version of a dead man's vision for a decade.'", reasoning: "Chubbuck: Inner Monologue.", source: "Chubbuck" }, { answer: "When the guard drops, he becomes unbearably honest — raw, unpolished, frightened. It lasts seconds before the mask reassembles.", reasoning: "Speech under pressure.", source: "McKee" }],
    [{ answer: "On set: kinetic, confident, taking up space. Off set: the energy leaves. He deflates like someone cut the power. The difference is the audience.", reasoning: "Egri: the body.", source: "Egri" }, { answer: "The lighter as anchor — his hands are never still. It's a fidget, a tell, and a prayer.", reasoning: "Chubbuck: DOINGS.", source: "Chubbuck" }, { answer: "He sinks into the chair. His hand goes to the lighter but doesn't open it. His eyes stay on the screen. He watches himself fail in real time, very still.", reasoning: "The body in private.", source: "Egri" }],
    [{ answer: "His mentor's ghost. Every collaborator is measured against a man who can no longer speak.", reasoning: "Egri: Unity of Opposites.", source: "Egri" }, { answer: "He competes with ghosts — the mentor, the younger self, the impossible standard.", reasoning: "Chubbuck: relationship pattern.", source: "Chubbuck" }, { answer: "Arjun's willingness to stay invisible terrifies Ravi — because it mirrors the artistic integrity Ravi abandoned in exchange for reputation.", reasoning: "Jung: projection.", source: "Jung" }, { answer: "With himself. The artist versus the brand. Everything else — the industry, the collaborators, the audience — is a stage for that private war.", reasoning: "McKee: Private Conflict.", source: "McKee" }],
    [{ answer: "Performing confidence so convincingly he's forgotten what real conviction feels like. Defended against imperfection.", reasoning: "Weiland: opening state.", source: "Weiland" }, { answer: "Positive Change — he lets go of the need to repeat and makes something imperfect, honest, and new.", reasoning: "Weiland: Positive Change.", source: "Weiland" }, { answer: "He ends with a lighter in his pocket he doesn't need to reach for anymore. What it cost: the reputation. What it gave: the artist underneath.", reasoning: "Egri: pole-to-pole.", source: "Egri" }],
  ],

  "Lakshmi": [
    [{ answer: "The short film was about her family — a portrait so honest it felt like exposure. She wasn't protecting her privacy. She was protecting her family from her clarity.", reasoning: "The wound is the power of her own seeing.", source: "Chubbuck" }, { answer: "At 25 she was between identities — no longer the promising young filmmaker, not yet the reliable editor. The pull was terrifying.", reasoning: "Weiland: timing.", source: "Weiland" }, { answer: "The belief she had a story worth telling on its own. She became a mirror — brilliant at reflecting others, invisible as a light source.", reasoning: "Jung: the Shadow as the unlived creative self.", source: "Jung" }, { answer: "She does something with her hands — a small folding gesture, as if tucking something away for later. It's the body's version of 'not ready.'", reasoning: "Egri: physiology.", source: "Egri" }],
    [{ answer: "Other people's stories are more important than mine. The Lie sounds like humility. It's actually terror wearing a noble face.", reasoning: "Weiland: the Lie.", source: "Weiland" }, { answer: "She makes herself indispensable to everyone else's projects. If she's always editing their truth, she never has to face her own.", reasoning: "The Lie in behavior.", source: "Weiland" }, { answer: "Longing. The specific kind that comes from watching other people do the thing you want to do and convincing yourself you prefer watching.", reasoning: "What the Lie holds back.", source: "Jung" }],
    [{ answer: "To be witnessed. Not praised, not validated — witnessed. Seen the way she sees everyone else.", reasoning: "Chubbuck: primal need.", source: "Chubbuck" }, { answer: "The wound took her right to be a protagonist. The drive wants it back — but fifteen years of supporting roles make it feel impossible.", reasoning: "Wound → drive.", source: "Chubbuck" }, { answer: "She says: 'I love editing because I see what others miss.' The truth: 'I edit because I'm afraid to create.'", reasoning: "Motivation vs. justification.", source: "McKee" }, { answer: "WANT: To be the best editor. NEED: To stop being everyone's mirror and look at her own reflection.", reasoning: "Want vs. Need.", source: "Weiland" }],
    [{ answer: "Selfless, warm, essential. She holds space for everyone so skillfully nobody notices she never takes up any.", reasoning: "Jung: the Persona.", source: "Jung" }, { answer: "When someone genuinely asks how she is. The silence is too long. The mask has no script for receiving.", reasoning: "The mask fails at simple attention.", source: "Chubbuck" }, { answer: "A woman who makes things — her own things, with her own name on them. But she'd have to stop being everyone's safe harbor first.", reasoning: "Under the mask.", source: "Weiland" }],
    [{ answer: "Spare, precise, economical. She speaks in cuts. Every word earned its place in the final version.", reasoning: "McKee: voice.", source: "McKee" }, { answer: "Her own desires. Not her analysis of others' desires — her OWN. She'll discuss what everyone else wants with devastating clarity but goes silent about herself.", reasoning: "McKee: the Unsaid.", source: "McKee" }, { answer: "'A man at a bus stop, talking to the empty seat beside him. He said: I saved you a place.' — This is the kind of moment she steals and hoards on sticky notes.", reasoning: "Her private voice is more lyrical than she'll ever speak aloud.", source: "Chubbuck" }, { answer: "Defending others: passionate, fierce, precise. Asked about herself: the voice drops, the sentences trail off, the precision dissolves into ellipses.", reasoning: "Speech under pressure.", source: "McKee" }],
    [{ answer: "She inhabits the editing suite like it's a body — the chair is a second spine, the screens are her eyes, the mouse is an extension of her nervous system.", reasoning: "Egri: the body.", source: "Egri" }, { answer: "Hands that touch carefully — every object handled with deliberate gentleness. The hands of someone who knows things are fragile.", reasoning: "Chubbuck: DOINGS.", source: "Chubbuck" }, { answer: "A barely perceptible withdrawal — shoulders pulling in, gaze dropping, hands finding something to fold or straighten. The body says 'not ready' a half-second before the mouth does.", reasoning: "The body's tell.", source: "Egri" }],
    [{ answer: "No one. Everyone tells Lakshmi everything and nobody asks about her. The asymmetry is total. She built it herself.", reasoning: "Egri: Unity of Opposites — the bond is the asymmetry.", source: "Egri" }, { answer: "She becomes the confessor. The cost: total knowledge asymmetry.", reasoning: "Chubbuck: relationship pattern.", source: "Chubbuck" }, { answer: "Arjun. He's hiding behind other people's words the way she's hiding behind other people's footage. He's the mirror she doesn't want to look into.", reasoning: "Jung: projection.", source: "Jung" }, { answer: "To be met — not needed, not useful. Met. Someone who sits across from her and asks 'What do YOU see?' and waits.", reasoning: "The need.", source: "Chubbuck" }],
    [{ answer: "Defended against her own story. Comfortable in the edit suite. Terrified of the blank page.", reasoning: "Weiland: opening state.", source: "Weiland" }, { answer: "Positive Change — the events force her into the frame. She tells her own story. The sticky note comes down.", reasoning: "Weiland: Positive Change.", source: "Weiland" }, { answer: "She writes a sticky note about herself. And for the first time, she doesn't fold it away.", reasoning: "Egri: pole-to-pole.", source: "Egri" }],
  ],

  "Vikram": [
    [{ answer: "At a school function, age 12. A classmate asked what his father did. Vikram said 'cinematographer.' The ease of the lie and the shame that followed it taught him everything about how the world works.", reasoning: "The wound crystallizes in a single social moment.", source: "Chubbuck" }, { answer: "Early — before he had language for it. The shame wasn't intellectual. It was physical — a hot face, a looked-away-from feeling.", reasoning: "Weiland: timing.", source: "Weiland" }, { answer: "Trust in meritocracy. He watched his father do beautiful, essential work and get nothing. Conclusion: the world doesn't reward skill. It rewards positioning.", reasoning: "Jung: the Shadow.", source: "Jung" }, { answer: "It felt like putting on a coat that fit perfectly — and the first realization that the truth was too small for the world he wanted to enter.", reasoning: "The first lie is the wound's architecture.", source: "Egri" }],
    [{ answer: "Invisible work is worthless. Be seen or be erased. The Lie sounds like ambition. It's actually his father's eulogy delivered as a business plan.", reasoning: "Weiland: the Lie.", source: "Weiland" }, { answer: "Everything is transactional — loyalty is what his father had, and it got him nothing.", reasoning: "The Lie in behavior.", source: "Weiland" }, { answer: "The love he had for his father — simple, uncomplicated, a boy's admiration. That love became dangerous because it attached to something the world told him was worthless.", reasoning: "What the Lie guards against.", source: "Jung" }],
    [{ answer: "To never be erased. To be the name that greenlights dreams — the person no one can ignore, overlook, or forget.", reasoning: "Chubbuck: primal need.", source: "Chubbuck" }, { answer: "His father's invisibility took a son's right to be proud. The drive is trying to build something so visible that the pride becomes unavoidable.", reasoning: "Wound → drive.", source: "Chubbuck" }, { answer: "He says: 'I want to build the best production house in the south.' Real answer: 'I want to build something my father should have had.'", reasoning: "Motivation vs. justification.", source: "McKee" }, { answer: "WANT: Total industry control. NEED: To recognize his father's legacy isn't shame — it's the quiet, essential work of making light for other people's visions.", reasoning: "Want vs. Need.", source: "Weiland" }],
    [{ answer: "Power. Strategic, every word load-bearing. Compliments that feel like contracts, silences like threats. But at 4 AM on empty sets, he adjusts lights with his father's hands.", reasoning: "Jung: Persona.", source: "Jung" }, { answer: "On empty sets at 4 AM — adjusting lights with his father's hands. Nobody important sees this. That's the point.", reasoning: "The mask fails in private.", source: "Chubbuck" }, { answer: "That they'd see a gaffer's son — and that everything he built would be reinterpreted as compensation rather than achievement.", reasoning: "The mask's deepest fear.", source: "Weiland" }],
    [{ answer: "Smooth, efficient — compliments that feel like contracts. He speaks in power and outcomes.", reasoning: "McKee: voice.", source: "McKee" }, { answer: "His father's real job. The word 'gaffer.' His childhood home. Anything that smells like where he came from.", reasoning: "McKee: the Unsayable.", source: "McKee" }, { answer: "'Everyone wants their name in lights. My father made the lights. I still don't know which of us had it right.'", reasoning: "The whisper on the empty set.", source: "Chubbuck" }, { answer: "The smoothness hardens into something colder. The warmth disappears first. What's left is his father's quiet endurance dressed in expensive clothes.", reasoning: "Speech under pressure.", source: "McKee" }],
    [{ answer: "He enters rooms like he owns them — center, eye contact, claiming space. The body says 'I belong here' before anyone can suggest otherwise.", reasoning: "Egri: the body.", source: "Egri" }, { answer: "Surprising gentleness with objects — equipment handled with care that contradicts his ruthlessness with people. His father's hands never left him.", reasoning: "Chubbuck: DOINGS.", source: "Chubbuck" }, { answer: "He holds the framed photo with both hands. His thumbs trace the edge. He doesn't speak. The body says everything the empire is designed to avoid saying.", reasoning: "The body in private.", source: "Egri" }],
    [{ answer: "Arjun. The ghostwriter who chose invisibility — the thing Vikram fears most. Arjun is his father's path made contemporary, and it disturbs him profoundly.", reasoning: "Egri: Unity of Opposites.", source: "Egri" }, { answer: "Transactional above, paternal below. Equals are assets. Spot boys are sons.", reasoning: "Chubbuck: relationship pattern.", source: "Chubbuck" }, { answer: "Arjun's willingness to be invisible mirrors his father. Vikram's contempt for that choice is the contempt he's been directing at his own shame for decades.", reasoning: "Jung: projection.", source: "Jung" }, { answer: "Once. His father. His father loved all of him — the ambition and the shame. And Vikram repaid it by pretending the man was something he wasn't.", reasoning: "The relationship that haunts.", source: "Chubbuck" }],
    [{ answer: "He believes visibility = worth. He is an empire. The framed photo faces him, not visitors.", reasoning: "Weiland: opening state.", source: "Weiland" }, { answer: "Positive Change — he discovers his father wasn't invisible, he was essential. The shame becomes pride. The empire matters less than the man.", reasoning: "Weiland: Positive Change.", source: "Weiland" }, { answer: "He turns the photo to face outward. 'My father was a gaffer.' First time he's said it. Last time it hurts.", reasoning: "Egri: pole-to-pole.", source: "Egri" }],
  ],
};

// ─────────────────────────────────────────────────────────
// ASSEMBLE THE DEMO SET
// ─────────────────────────────────────────────────────────

const DEMO_SET: DemoCharacterSet = {
  logline: "Default demo story",
  characters: [
    {
      name: "Arjun",
      essence: "A man who writes other people's stories because he's terrified of telling his own",
      spark: "Keeps a half-finished screenplay on his laptop from when he was 22. Opens the file sometimes at 2 AM, reads the first page, then closes it.",
      role: "Protagonist",
      color: "#4d8be8",
    },
    {
      name: "Meera",
      essence: "A woman who turned her pain into a production company and now can't feel anything unless it's through a lens",
      spark: "Wears her late mother's reading glasses while reviewing scripts. Doesn't need glasses — it's the only way she lets herself be sentimental.",
      role: "Catalyst",
      color: "#d4a843",
    },
    {
      name: "Ravi",
      essence: "A director who peaked at 30 and has been performing confidence ever since",
      spark: "Still carries the lighter his mentor gave him. Quit smoking seven years ago. Flicks it open during meetings when he's about to lie.",
      role: "Mirror",
      color: "#cc5f5f",
    },
    {
      name: "Lakshmi",
      essence: "The editor who sees the real story hiding under everyone's rough cuts — including the ones they live",
      spark: "Keeps a wall of sticky notes at home. Each one is a moment from someone's life she overheard and never forgot. She calls it her 'story bank.'",
      role: "Guide",
      color: "#6dd4a0",
    },
    {
      name: "Vikram",
      essence: "A producer who treats stories like real estate and people like locations — useful until the shoot wraps",
      spark: "Has a framed photo of his father on set. His father was a gaffer. Vikram tells people he was a cinematographer.",
      role: "Antagonist",
      color: "#9b7ed8",
    },
  ],

  questions: {
    "Arjun": ARJUN_QUESTIONS,
    "Meera": MEERA_QUESTIONS,
    "Ravi": RAVI_QUESTIONS,
    "Lakshmi": LAKSHMI_QUESTIONS,
    "Vikram": VIKRAM_QUESTIONS,
  },

  sketchLines: ALL_SKETCH_LINES,
  kleo: ALL_KLEO,

  contradictions: {
    "Arjun": { observation: "You've built a character who writes confessions for others but can't write his own. The unfinished screenplay terrifies him more than the blank page. Completion, not failure, is what he fears.", question: "What if the screenplay IS finished — and it's Arjun's fear of it being good that keeps him from opening the file?" },
    "Meera": { observation: "Meera produces vulnerability for a living while her own grief stays in post-production. The empire she built to honor her mother required becoming someone her mother wouldn't recognize.", question: "What would Meera's mother say if she saw the company — and is Meera's real terror that she already knows the answer?" },
    "Ravi": { observation: "Ravi's best work came from recklessness, but success made him careful. The flame is more honest than anything he's directed in a decade.", question: "What if the lighter isn't connecting Ravi to his mentor — what if it's connecting him to the reckless version of himself who doesn't exist anymore?" },
    "Lakshmi": { observation: "Lakshmi can find the hidden story in anyone's footage but pulled her own film for showing too much. The editor who needs editing.", question: "If Lakshmi edited her own life the way she edits films — what scene would she cut? And what scene would she fight to keep?" },
    "Vikram": { observation: "Vikram escaped his father's invisibility and arrived at the same emptiness from the opposite direction. The producer who sets up lights alone — visible to everyone, seen by no one.", question: "When Vikram adjusts lights on empty sets at 4 AM — is he honoring his father or apologizing to him?" },
  },

  portraits: {
    "Arjun": {
      name: "Arjun",
      essence: "A man who gave his voice to others and now has to steal it back, one unwritten page at a time.",
      dimensions: {
        'wound': "The half-finished screenplay is about his father — a man who worked in film his whole life and never got a credit. Arjun ghostwrites because it makes him feel close to his father. Finishing it would mean admitting they both deserved better.",
        'lie': "If I put my name on my own work, it will be stolen or ignored — and I'll discover the theft wasn't personal, it was a verdict.",
        'drive': "To exist as the author of his own words. Not fame — proof that he was here and what he wrote mattered.",
        'mask': "Pragmatism. He tells himself ghostwriting is smart, sustainable, professional. It's fear wearing a sensible outfit.",
        'voice': "Quiet, observational, with sudden bursts of unexpected poetry. Speaks in other people's metaphors until pushed, then his own words come raw and unpolished.",
        'body': "He enters rooms from the periphery, finds the chair with the best sightline and worst visibility, and sits like he's borrowing it.",
        'relationships': "He disappears. Slowly, methodically, until the other person thinks the silence was mutual. He did it with his best friend, he's doing it with himself.",
        'arc': "From ghost to author. From invisible to exposed. The cost: the comfortable anonymity that protected him for a decade.",
      },
      unansweredQuestion: "If I tell my own story, will it be good enough? Or will I discover that the only gift I have is polishing other people's voices — and my own is just noise?",
      prose: "Arjun lives in the margins. Not of society — of stories. He inhabits the spaces between other people's words, finding the rhythm they couldn't hear, the scene they almost wrote, the ending they needed but couldn't reach. He is, by any measure, one of the best writers working in Telugu cinema today. Nobody knows this.\n\nHe works from the Irani cafe near Charminar or his apartment rooftop during monsoons, always with his laptop open to two files: the one he's being paid to write and the one he started at 22. The paid file gets his craft. The other file gets his cursor — blinking, waiting, accusing.\n\nWhat makes Arjun dangerous — to himself, to the story he's avoiding — is that he's not mediocre. A mediocre ghostwriter would have made peace with it. Arjun is gifted enough to know exactly what he's sacrificing, every single day, and he sacrifices it anyway.\n\nThe bravest thing Arjun will ever do is not write the screenplay. It's let someone read it.",
    },
    "Meera": {
      name: "Meera",
      essence: "A woman who turned grief into a production company and achievement into armor — the most successful person in any room and the loneliest.",
      dimensions: {
        'wound': "Her mother's last words weren't 'Tell my story.' They were 'I'm sorry I wasn't enough.' Meera has been proving her wrong ever since — and the person she's trying to convince is already gone.",
        'lie': "If I stop producing, I will feel the grief I've been outrunning since I was 19.",
        'drive': "To hear 'I'm proud of you' from someone who can never say it — so she builds empires that say it instead.",
        'mask': "Professional excellence. She's built a life indistinguishable from a production schedule — everything planned, crewed, budgeted. Including her emotions.",
        'voice': "Controlled, precise, a producer's instinct for saying exactly enough. But alone in the edit suite, her voice softens into something musical.",
        'body': "She enters rooms like a press release — center, composed, every detail managed. But alone, the body curls, the glasses come out, and the producer disappears.",
        'relationships': "Three rehearsed vulnerabilities on rotation. Redirects lovers into proteges. Works so hard that distance looks like dedication.",
        'arc': "From fortress to grief to the other side of grief — where the empire still stands but isn't all of her anymore.",
      },
      unansweredQuestion: "If I stop working — if I stop producing, building, succeeding — will there be anyone underneath all of that? Or did I pour so much of myself into the company that there's nothing left that's just Meera?",
      prose: "Meera moves through the world like a woman who has read the script of her own life and is executing it flawlessly. Every meeting is prepared for, every relationship has a purpose, every vulnerability she reveals is selected from a curated list of three.\n\nWatch her at the end of the day, in the edit suite, alone with someone else's footage. Watch her put on her dead mother's reading glasses — glasses she doesn't need — and how her shoulders finally drop. This is the only version of Meera that's real.\n\nThe production company was supposed to be a tribute. It became a fortress. She built something her mother would have been proud of, and the tragic irony is that the building of it required becoming someone her mother wouldn't recognize.\n\nMeera will tell her mother's story one day. Not because she finds the courage, but because the armor finally cracks — and the story pours out before she can stop it.",
    },
    "Ravi": {
      name: "Ravi",
      essence: "A director trapped in the amber of his own early genius, performing confidence so convincingly that he's forgotten what real conviction feels like.",
      dimensions: {
        'wound': "His mentor told him the core idea for his first film during their last conversation before the stroke. The lighter isn't a memento — it's evidence of a debt he can never repay or verify.",
        'lie': "What worked once will work again if I'm careful enough. The Lie turns art into engineering and spontaneity into risk management.",
        'drive': "To feel the recklessness again — not confidence, but the actual willingness to fail that made his first film possible.",
        'mask': "Confidence. Charming, quotable, every sentence rehearsed. The lighter flick is his tell — he reaches for it when he's about to say something he doesn't mean.",
        'voice': "Interview-polished on the surface, almost unbearably honest when the guard drops. The shift is the character.",
        'body': "On set: kinetic, commanding, taking up space. Off set: the energy leaves. He deflates like someone cut the power.",
        'relationships': "Competitive with ghosts. Every collaborator measured against his mentor, his younger self, the impossible standard of a film made by someone too ignorant to be afraid.",
        'arc': "From performance to presence. From careful to reckless. The lighter stays in his pocket because he doesn't need it anymore.",
      },
      unansweredQuestion: "Am I talented, or was I just young enough and reckless enough to stumble into something great? If I strip away the reputation — is there an artist underneath?",
      prose: "There is a specific kind of loneliness that belongs to men who peaked early. Ravi knows it intimately. It sits in the passenger seat of his car after meetings, in the gap between what he pitched and what he believes in.\n\nAt 30, Ravi made a film that changed Telugu cinema. It was raw, reckless, and true — the kind of film that could only come from someone who didn't know enough to be afraid. Now he knows too much.\n\nWatch him in a meeting: the confident lean, the easy smile, the way he flicks open his mentor's lighter when he's about to say something he doesn't mean. The lighter is his tell. He quit smoking seven years ago, but the flame still means something.\n\nRavi's redemption won't come from making another masterpiece. It'll come from making something small. Something that might fail. The lighter will be in his pocket when he does it, but for the first time, he won't need to reach for it.",
    },
    "Lakshmi": {
      name: "Lakshmi",
      essence: "The invisible architect of other people's stories who has edited everyone's life except her own.",
      dimensions: {
        'wound': "She made a short film at 25. It got into a festival. She pulled it the night before the screening — not because it was bad, but because it showed too much of her.",
        'lie': "Other people's stories are more important than mine. The Lie sounds like humility. It's actually terror wearing a noble face.",
        'drive': "To be witnessed — not praised, not validated — witnessed. Seen the way she sees everyone else.",
        'mask': "Selflessness. She holds space for everyone so skillfully that nobody notices she never takes up any.",
        'voice': "Spare, precise, the economy of someone who removes for a living. But her sticky notes reveal secret lyricism.",
        'body': "Contained stillness — she takes up as little space as possible. Not from insecurity but from a practiced art of disappearing.",
        'relationships': "She becomes the confessor. Everyone tells her everything. The cost: she knows all their secrets and nobody knows hers.",
        'arc': "From the editing suite to the frame. From supporting character to protagonist of her own story.",
      },
      unansweredQuestion: "If I step out from behind the editing console and into the frame — if I become a character instead of the person who shapes characters — will the story still work?",
      prose: "Lakshmi's apartment is the quietest place in Hyderabad. There's a wall of sticky notes — hundreds of them, each one a moment stolen from someone else's life. A man at a bus stop talking to an empty seat. A child at a wedding, choosing stillness. And not one of them is about Lakshmi.\n\nIn the edit suite, she is extraordinary. She sees what directors miss, what writers intended, what actors gave without knowing. She finds the frame where someone stopped performing and started being.\n\nThe short film from fifteen years ago sits in a drawer, next to a sticky note that says 'Not ready.' Lakshmi knows, with the certainty of someone who edits for a living, that 'not ready' is just 'afraid' in a more comfortable font.\n\nOne day she'll write a sticky note about herself. And that will be the beginning of the only story she's qualified to tell.",
    },
    "Vikram": {
      name: "Vikram",
      essence: "A self-made man who built himself so thoroughly that the original is buried somewhere underneath, still mourning a father the world never saw.",
      dimensions: {
        'wound': "His father was a gaffer — thirty years, zero credits. Young Vikram crystallized a devastating conclusion: be seen, or be erased.",
        'lie': "Invisible work is worthless. Be seen or be erased. The Lie sounds like ambition. It's his father's eulogy delivered as a business plan.",
        'drive': "To never be erased — to be the name that greenlights dreams, the person no one can ignore or forget.",
        'mask': "Power. Strategic, every word load-bearing. Compliments that feel like contracts, silences like threats. But at 4 AM on empty sets, he adjusts lights with his father's hands.",
        'voice': "Smooth, efficient, never wastes a syllable. But once, a gaffer heard him whisper on an empty set something he'd never say in daylight.",
        'body': "He enters rooms like he owns them — center, eye contact, claiming space. But his hands handle equipment with a gaffer's care.",
        'relationships': "Transactional above, paternal below. People are useful until the shoot wraps. The exception: the spot boys. He learns their names.",
        'arc': "From empire to essence. From his father's shame to his father's pride. The photo turns to face outward.",
      },
      unansweredQuestion: "Was I running toward power, or away from my father's anonymity? If I stripped away the empire — would I find a man worth knowing? Or just a gaffer's son ashamed of where he came from?",
      prose: "Vikram learned early that the world is organized by visibility. His father spent thirty years in film and died without a credit. A gaffer. The man who makes the light and goes home to a house the cinematographer's assistant could afford.\n\nSo he made himself seen. The most connected producer in Telugu cinema. He replaced his father's story with a better one — cinematographer, not gaffer — and the lie became load-bearing.\n\nBut there are cracks. The spot boys whose names he remembers. The lights he adjusts on empty sets. The father's photo on his desk, facing him, not visitors. These are the residue of a boy who loved his father and spends his adult life apologizing for that love.\n\nVikram's tragedy is not ruthlessness. It's that his ruthlessness serves a misunderstanding. His father wasn't invisible — he was essential.",
    },
  },
};

// ─────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────

export function getDemoCharacters(): Omit<Character, 'id'>[] {
  return DEMO_SET.characters;
}

export function getDemoQuestion(characterName: string, dimensionIndex: number, questionIndex: number): DimensionQuestion | null {
  const dimQuestions = DEMO_SET.questions[characterName];
  if (!dimQuestions || dimensionIndex >= dimQuestions.length || dimensionIndex >= DIMENSIONS.length) return null;

  const questionsForDim = dimQuestions[dimensionIndex];
  if (!questionsForDim || questionIndex >= questionsForDim.length) return null;

  const raw = questionsForDim[questionIndex];
  const dim = DIMENSIONS[dimensionIndex];
  const kleoData = DEMO_SET.kleo[characterName]?.[dimensionIndex]?.[questionIndex] ?? { answer: "Trust your instincts on this one.", reasoning: "Sometimes the writer knows best." };

  return {
    dimension: dim.id,
    dimensionLabel: dim.label,
    question: raw.text,
    mode: raw.mode,
    options: raw.options,
    kleo: kleoData,
    questionIndex,
    totalQuestionsInDimension: questionsForDim.length,
  };
}

export function getSketchLine(characterName: string, dimension: DimensionId, optionId: string): string {
  const dimIndex = DIMENSIONS.findIndex(d => d.id === dimension);
  if (dimIndex === -1) return '';
  return DEMO_SET.sketchLines[characterName]?.[dimIndex]?.[optionId] ?? '';
}

export function getDemoContradictionInsight(characterName: string): ContradictionInsight {
  return DEMO_SET.contradictions[characterName] ?? {
    observation: "Something interesting is emerging from the contradictions in this character.",
    question: "What happens when these opposing forces collide?",
  };
}

export function getDemoPortrait(characterName: string): CharacterPortrait | null {
  return DEMO_SET.portraits[characterName] || null;
}
