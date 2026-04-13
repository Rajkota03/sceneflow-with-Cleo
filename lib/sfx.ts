// .sfw — SceneFlow project file format
// JSON-based, stores screenplay + metadata + Kleo conversations

import type { Screenplay } from './types';
import type { KleoMessage, KleoTasteProfile, KleoWritingStyle } from './kleo-store';

export interface SfxFile {
  format: 'sceneflow';
  version: 1;
  screenplay: Screenplay;
  kleo?: {
    taste?: KleoTasteProfile;
    style?: KleoWritingStyle;
    conversations?: KleoMessage[];
  };
  savedAt: number;
}

export function packSfx(
  screenplay: Screenplay,
  kleo?: { taste?: KleoTasteProfile; style?: KleoWritingStyle; conversations?: KleoMessage[] },
): string {
  const file: SfxFile = {
    format: 'sceneflow',
    version: 1,
    screenplay,
    kleo,
    savedAt: Date.now(),
  };
  return JSON.stringify(file, null, 2);
}

export function unpackSfx(raw: string): SfxFile {
  const data = JSON.parse(raw);
  if (data.format !== 'sceneflow' || !data.screenplay) {
    throw new Error('Not a valid .sfw file');
  }
  return data as SfxFile;
}

// File System Access API — native save/open dialogs (Chrome, Edge, PWA)
// Falls back to download/upload for Safari/Firefox

const SFX_TYPE = {
  description: 'SceneFlow Project',
  accept: { 'application/json': ['.sfw'] },
};

let fileHandle: FileSystemFileHandle | null = null;

export function clearFileHandle() {
  fileHandle = null;
}

export function hasFileHandle(): boolean {
  return fileHandle !== null;
}

export async function saveSfx(
  screenplay: Screenplay,
  kleo?: SfxFile['kleo'],
): Promise<string | null> {
  const json = packSfx(screenplay, kleo);

  // If we already have a handle (previously opened/saved), write directly
  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
      return fileHandle.name;
    } catch {
      fileHandle = null; // handle went stale, fall through to picker
    }
  }

  return saveAsSfx(screenplay, kleo);
}

export async function saveAsSfx(
  screenplay: Screenplay,
  kleo?: SfxFile['kleo'],
): Promise<string | null> {
  const json = packSfx(screenplay, kleo);
  const filename = `${screenplay.title || 'Untitled'}.sfw`;

  if ('showSaveFilePicker' in window) {
    try {
      fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [SFX_TYPE],
      });
      const writable = await fileHandle!.createWritable();
      await writable.write(json);
      await writable.close();
      return fileHandle!.name;
    } catch (e: any) {
      if (e.name === 'AbortError') return null; // user cancelled
      throw e;
    }
  }

  // Fallback: trigger download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

export async function openSfx(): Promise<SfxFile | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [SFX_TYPE],
        multiple: false,
      });
      fileHandle = handle;
      const file = await handle.getFile();
      const text = await file.text();
      return unpackSfx(text);
    } catch (e: any) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
  }

  // Fallback: file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sfw';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const text = await file.text();
      try { resolve(unpackSfx(text)); } catch { resolve(null); }
    };
    input.click();
  });
}
