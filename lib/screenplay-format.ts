import type { ScreenplayElementType } from './types';

/** Detect the element type from raw text and context. */
export function detectElementType(
  text: string,
  prevType: ScreenplayElementType | null,
  knownCharacters: string[],
): ScreenplayElementType {
  const trimmed = text.trim();
  if (!trimmed) return prevType === 'character' ? 'dialogue' : 'action';

  // Scene heading: starts with INT. or EXT. (or I/E.)
  if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/.test(trimmed.toUpperCase())) {
    return 'scene-heading';
  }

  // Transition: ends with "TO:" or is FADE IN: / FADE OUT.
  if (/^(FADE IN:|FADE OUT\.)$/i.test(trimmed) || /TO:$/i.test(trimmed)) {
    return 'transition';
  }

  // Parenthetical: starts with (
  if (trimmed.startsWith('(')) {
    return 'parenthetical';
  }

  // Character name: all uppercase, not a scene heading, optionally with (V.O.) or (O.S.)
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const matchesKnown = knownCharacters.some(
    c => trimmed.toUpperCase().startsWith(c.toUpperCase()),
  );

  if (isAllCaps && trimmed.length < 40) {
    return 'character';
  }
  if (matchesKnown && isAllCaps) {
    return 'character';
  }

  // After a character name or parenthetical, it's dialogue
  if (prevType === 'character' || prevType === 'parenthetical') {
    return 'dialogue';
  }

  return 'action';
}

/** What type should the next line default to after pressing Enter? */
export function nextTypeAfter(currentType: ScreenplayElementType): ScreenplayElementType {
  switch (currentType) {
    case 'scene-heading': return 'action';
    case 'action': return 'action';
    case 'character': return 'dialogue';
    case 'parenthetical': return 'dialogue';
    case 'dialogue': return 'action';
    case 'transition': return 'scene-heading';
    default: return 'action';
  }
}

/** Cycle element type with Tab key — context-aware like Final Draft. */
export function cycleType(currentType: ScreenplayElementType): ScreenplayElementType {
  switch (currentType) {
    case 'action':        return 'character';
    case 'character':     return 'action';
    case 'dialogue':      return 'parenthetical';
    case 'parenthetical': return 'dialogue';
    case 'scene-heading': return 'action';
    case 'transition':    return 'scene-heading';
    default:              return 'action';
  }
}

/** Filter characters matching partial input. */
export function matchCharacters(input: string, knownCharacters: string[]): string[] {
  const upper = input.trim().toUpperCase();
  if (!upper) return [];
  return knownCharacters.filter(c => c.toUpperCase().startsWith(upper));
}

/** Format type label for the UI indicator. */
export function typeLabel(type: ScreenplayElementType): string {
  switch (type) {
    case 'scene-heading': return 'Scene Heading';
    case 'action': return 'Action';
    case 'character': return 'Character';
    case 'parenthetical': return 'Parenthetical';
    case 'dialogue': return 'Dialogue';
    case 'transition': return 'Transition';
    case 'dual-start': return 'Dual Dialogue';
    case 'dual-end': return 'Dual Dialogue';
  }
}
