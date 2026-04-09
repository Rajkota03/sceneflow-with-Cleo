// ─── Character Builder: localStorage persistence ───

const STORAGE_KEY = 'sceneflow_characters';

export interface StoredCharacter {
  id: string;
  projectId?: string;
  name: string;
  answers: Record<string, string | string[]>;
  aiFeedback: Record<string, string>;
  pressureTest?: {
    scenarios: string;
    responses: [string, string, string];
  };
  crossValidation?: string;
  createdAt: number;
  updatedAt: number;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readAll(): StoredCharacter[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(chars: StoredCharacter[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
}

export function getCharacters(): StoredCharacter[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCharacter(id: string): StoredCharacter | undefined {
  return readAll().find(c => c.id === id);
}

export function createCharacter(projectId?: string): StoredCharacter {
  const char: StoredCharacter = {
    id: uid(),
    projectId,
    name: '',
    answers: {},
    aiFeedback: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const all = readAll();
  all.push(char);
  writeAll(all);
  return char;
}

export function saveCharacter(char: StoredCharacter) {
  const all = readAll();
  const idx = all.findIndex(c => c.id === char.id);
  const updated = { ...char, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  writeAll(all);
  return updated;
}

export function deleteCharacter(id: string) {
  writeAll(readAll().filter(c => c.id !== id));
}

export function exportCharacterMarkdown(
  char: StoredCharacter,
  phases: Array<{ id: string; num: string; title: string; questions: Array<{ id: string; label: string }> }>,
): string {
  const lines: string[] = [];
  const name = char.name || 'UNNAMED';
  lines.push(`# CHARACTER BIBLE: ${name.toUpperCase()}`);
  lines.push('');
  lines.push('*Built with SceneFlow Character Builder*');
  lines.push('');
  lines.push('---');

  for (const phase of phases) {
    lines.push('');
    lines.push(`## ${phase.num}. ${phase.title}`);
    lines.push('');

    let hasContent = false;
    for (const q of phase.questions) {
      const val = char.answers[q.id];
      if (!val || (typeof val === 'string' && !val.trim()) || (Array.isArray(val) && val.length === 0)) continue;
      hasContent = true;
      lines.push(`**${q.label}**`);
      if (Array.isArray(val)) {
        lines.push(val.join(', '));
      } else {
        lines.push(val);
      }
      lines.push('');
    }

    if (!hasContent) {
      lines.push('*Not yet explored.*');
      lines.push('');
    }

    const feedback = char.aiFeedback[phase.id];
    if (feedback) {
      lines.push('### Collaborator Notes');
      lines.push(feedback);
      lines.push('');
    }

    lines.push('---');
  }

  if (char.pressureTest) {
    lines.push('');
    lines.push('## PRESSURE TEST');
    lines.push('');
    lines.push(char.pressureTest.scenarios);
    lines.push('');
    for (let i = 0; i < 3; i++) {
      const resp = char.pressureTest.responses[i];
      if (resp) {
        lines.push(`**Response ${i + 1}:**`);
        lines.push(resp);
        lines.push('');
      }
    }
    lines.push('---');
  }

  if (char.crossValidation) {
    lines.push('');
    lines.push('## CROSS-VALIDATION');
    lines.push('');
    lines.push(char.crossValidation);
  }

  return lines.join('\n');
}
