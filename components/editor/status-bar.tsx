'use client';
import type { ScreenplayElementType } from '@/lib/types';
import { typeLabel } from '@/lib/screenplay-format';
import type { EditorTheme } from './editor-toolbar';

const SB: Record<EditorTheme, { bg: string; border: string; text: string; muted: string; accent: string }> = {
  classic: { bg: '#f0f0f0', border: '#ddd', text: '#222', muted: '#999', accent: '#1a73e8' },
  dawn: { bg: '#e8e0d0', border: '#ccc0a8', text: '#2a2010', muted: '#9a9080', accent: '#7a6030' },
  parchment: { bg: '#13120f', border: 'rgba(200,189,160,0.06)', text: '#c8bda0', muted: '#4a4535', accent: '#c45c4a' },
  midnight: { bg: '#060810', border: 'rgba(255,255,255,0.06)', text: '#b0bcd0', muted: '#3a4560', accent: '#6888cc' },
};

interface StatusBarProps {
  theme: EditorTheme;
  currentPage: number;
  totalPages: number;
  currentScene: number;
  totalScenes: number;
  currentElementType: ScreenplayElementType | null;
  wordCount: number;
  charCount: number;
  lineNumber: number;
  isSaved: boolean;
  typewriterMode: boolean;
  onTypewriterToggle: () => void;
}

export function StatusBar({
  theme, currentPage, totalPages, currentScene, totalScenes,
  currentElementType, wordCount, charCount, lineNumber,
  isSaved, typewriterMode, onTypewriterToggle,
}: StatusBarProps) {
  const c = SB[theme];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '2px 16px', borderTop: `1px solid ${c.border}`,
      background: c.bg, fontSize: 11, color: c.muted,
      userSelect: 'none', flexShrink: 0, height: 26,
      fontFamily: 'var(--font-mono)',
    }}>
      {/* Left: page and scene info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>Pg <span style={{ color: c.text }}>{currentPage}</span>/{totalPages}</span>
        <span>Sc <span style={{ color: c.text }}>{currentScene}</span>/{totalScenes}</span>
        <span>Ln <span style={{ color: c.text }}>{lineNumber}</span></span>
        {currentElementType && (
          <span style={{ color: c.accent, fontWeight: 500 }}>{typeLabel(currentElementType)}</span>
        )}
      </div>

      {/* Right: word count, save, typewriter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>{wordCount.toLocaleString()} words</span>
        <span>{charCount.toLocaleString()} chars</span>
        <button
          onClick={onTypewriterToggle}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: typewriterMode ? c.accent : c.muted, fontSize: 11,
            fontFamily: 'var(--font-mono)', padding: 0,
          }}
          title="Typewriter mode — keep current line at eye level"
        >
          TW {typewriterMode ? 'ON' : 'OFF'}
        </button>
        <span style={{ color: isSaved ? c.muted : c.accent }}>
          {isSaved ? 'Saved' : 'Saving...'}
        </span>
      </div>
    </div>
  );
}
