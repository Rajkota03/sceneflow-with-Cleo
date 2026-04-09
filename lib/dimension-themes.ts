import type { DimensionId } from './types';

export interface DimensionEpigraph {
  text: string;
  source: string;
}

// Quotes, dialogues, and provocations mapped to each dimension.
// Drawn from McKee, Chubbuck, Weiland, Egri, and Jung.
// Each question rotates through these via questionIndex % length.

export const DIMENSION_EPIGRAPHS: Record<DimensionId, DimensionEpigraph[]> = {
  wound: [
    { text: 'There is no coming to consciousness without pain.', source: 'Jung' },
    { text: 'The wound is where the character begins. Everything before page one is the real story.', source: 'Weiland' },
    { text: 'Previous circumstances are the fuel the actor brings to every scene. Without them, the character walks in empty.', source: 'Chubbuck' },
    { text: 'A character driven by something they refuse to name is a character worth watching.', source: 'Egri' },
  ],
  lie: [
    { text: 'The persona is a complicated system of relations between individual consciousness and society, a kind of mask.', source: 'Jung' },
    { text: 'The Lie Your Character Believes is the foundation of the entire character arc.', source: 'Weiland' },
    { text: 'What the character believes to be true about the world — and is dead wrong about — that\'s the engine of the story.', source: 'Egri' },
  ],
  drive: [
    { text: 'The overall objective is what the character would sell their soul to achieve.', source: 'Chubbuck' },
    { text: 'The Want is what the character demands from the world. The Need is what the world demands from the character.', source: 'Weiland' },
    { text: 'A character without a burning desire is not yet a character. They are furniture.', source: 'Egri' },
    { text: 'Desire is the blood of drama. A story is simply one person who wants something and what they do to get it.', source: 'McKee' },
  ],
  mask: [
    { text: 'The persona is that which in reality one is not, but which oneself as well as others think one is.', source: 'Jung' },
    { text: 'There are three levels of character: what they say, what they don\'t say, and what they can never say.', source: 'McKee' },
    { text: 'Inner objects are the imaginary relationships the character carries everywhere — the voices that argue in the silence.', source: 'Chubbuck' },
  ],
  voice: [
    { text: 'What is said is only the tip of the iceberg. The unsayable — the deeply repressed — is the submerged mass beneath.', source: 'McKee' },
    { text: 'Dialogue is not conversation. It is carefully crafted speech that sounds like conversation.', source: 'McKee' },
    { text: 'The inner monologue is a constant stream of dialogue that runs beneath the spoken words, feeding every line delivery.', source: 'Chubbuck' },
    { text: 'How a character speaks reveals what they are hiding. The syntax itself is a confession.', source: 'Egri' },
  ],
  body: [
    { text: 'The body does not lie. When words say one thing and the body says another, the audience trusts the body.', source: 'Chubbuck' },
    { text: 'Physiology is the first dimension of character. Before they speak, they exist in space.', source: 'Egri' },
    { text: 'The shadow is the person you would rather not be. But it lives in the body, in the gesture, in the walk.', source: 'Jung' },
  ],
  relationships: [
    { text: 'No one exists alone. Character is revealed through the pressure that other people apply.', source: 'McKee' },
    { text: 'Sociology — the character\'s environment, class, education, relationships — shapes everything they can become.', source: 'Egri' },
    { text: 'Scene objectives only work when they involve another person. Drama is what happens between people.', source: 'Chubbuck' },
    { text: 'The people we cannot leave reveal more about us than the people we choose.', source: 'Weiland' },
  ],
  arc: [
    { text: 'The privilege of a lifetime is to become who you truly are.', source: 'Jung' },
    { text: 'A positive arc moves the character from the Lie to the Truth. But the Truth always costs them something they loved.', source: 'Weiland' },
    { text: 'Individuation — the process by which a person becomes a psychological whole — is the central drama of every human life.', source: 'Jung' },
  ],
};

/** Pick an epigraph for the current question, cycling through available quotes. */
export function getEpigraph(dimension: DimensionId, questionIndex: number): DimensionEpigraph {
  const quotes = DIMENSION_EPIGRAPHS[dimension];
  return quotes[questionIndex % quotes.length];
}
