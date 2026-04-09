import type { ScreenplayElementType, ScreenplayElement, ScreenplayScene, Screenplay } from './types';
import { uid } from './screenplay-store';

const TYPE_MAP: Record<string, ScreenplayElementType> = {
  'Scene Heading': 'scene-heading',
  'Action': 'action',
  'Character': 'character',
  'Dialogue': 'dialogue',
  'Parenthetical': 'parenthetical',
  'Transition': 'transition',
  'General': 'action',
};

/** Parse an FDX (Final Draft XML) string into a Screenplay. */
export function parseFdx(xml: string, sessionId: string): Screenplay {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  // Extract title from TitlePage
  let title = 'Imported Screenplay';
  const titleParagraph = doc.querySelector('TitlePage Paragraph[Type="Title"] Text');
  if (titleParagraph?.textContent) {
    title = titleParagraph.textContent.trim();
  }

  // Extract all paragraphs from Content
  const paragraphs = doc.querySelectorAll('Content > Paragraph');
  const scenes: ScreenplayScene[] = [];
  let currentScene: ScreenplayScene | null = null;

  for (const p of paragraphs) {
    const fdxType = p.getAttribute('Type') ?? 'Action';
    const type = TYPE_MAP[fdxType] ?? 'action';

    // Collect all text nodes within the paragraph (handles multiple <Text> children and styled runs)
    const textNodes = p.querySelectorAll('Text');
    const text = Array.from(textNodes).map(t => t.textContent ?? '').join('');

    if (type === 'scene-heading') {
      // Start a new scene
      currentScene = {
        id: uid(),
        heading: text.trim().toUpperCase(),
        elements: [],
      };
      scenes.push(currentScene);
    } else {
      // If no scene started yet, create one
      if (!currentScene) {
        currentScene = { id: uid(), heading: '', elements: [] };
        scenes.push(currentScene);
      }
      const el: ScreenplayElement = { id: uid(), type, text };
      currentScene.elements.push(el);
    }
  }

  // Ensure at least one scene
  if (scenes.length === 0) {
    scenes.push({ id: uid(), heading: 'INT. UNTITLED - DAY', elements: [{ id: uid(), type: 'action', text: '' }] });
  }

  // Ensure each scene has at least one element
  for (const scene of scenes) {
    if (scene.elements.length === 0) {
      scene.elements.push({ id: uid(), type: 'action', text: '' });
    }
  }

  return {
    sessionId,
    title,
    scenes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
