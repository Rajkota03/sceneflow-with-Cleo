'use client';
import { useState, useRef, useEffect } from 'react';
import { AmbientPlayer } from './ambient-player';
import type { ScreenplayElementType } from '@/lib/types';
import { typeLabel } from '@/lib/screenplay-format';

export type ScriptView = 'normal' | 'page' | 'speed' | 'focus';
export type PanelView = 'none' | 'beats' | 'stats' | 'cards' | 'title-page' | 'characters';
export type ViewMode = 'write' | 'read' | 'focus';
export type EditorTheme = 'parchment' | 'midnight' | 'dawn' | 'classic';

const ELEMENT_TYPES: { type: ScreenplayElementType; label: string }[] = [
  { type: 'scene-heading', label: 'Scene Heading' },
  { type: 'action', label: 'Action' },
  { type: 'character', label: 'Character' },
  { type: 'parenthetical', label: 'Parenthetical' },
  { type: 'dialogue', label: 'Dialogue' },
  { type: 'transition', label: 'Transition' },
];

const SCRIPT_VIEWS: { id: ScriptView; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'page', label: 'Page' },
  { id: 'speed', label: 'Speed' },
  { id: 'focus', label: 'Focus' },
];

const PANEL_VIEWS: { id: PanelView; label: string }[] = [
  { id: 'beats', label: 'Beat Board' },
  { id: 'cards', label: 'Index Cards' },
  { id: 'stats', label: 'Script Stats' },
  { id: 'characters', label: 'Characters' },
  { id: 'title-page', label: 'Title Page' },
];

const THEME_OPTIONS: { id: EditorTheme; label: string; swatch: string }[] = [
  { id: 'classic', label: 'Classic', swatch: '#ffffff' },
  { id: 'dawn', label: 'Dawn', swatch: '#f5f0e6' },
  { id: 'parchment', label: 'Parchment', swatch: '#1a1610' },
  { id: 'midnight', label: 'Midnight', swatch: '#0a0d18' },
];

// Theme-aware toolbar colors
const TB: Record<EditorTheme, {
  bg: string; border: string; text: string; muted: string; accent: string;
  dropBg: string; dropBorder: string; hoverBg: string;
}> = {
  classic: {
    bg: '#f5f5f5', border: '#ddd', text: '#222', muted: '#888',
    accent: '#1a73e8', dropBg: '#fff', dropBorder: '#e0e0e0', hoverBg: 'rgba(0,0,0,0.04)',
  },
  dawn: {
    bg: '#ede6d8', border: '#ccc0a8', text: '#2a2010', muted: '#9a9080',
    accent: '#7a6030', dropBg: '#f8f2e6', dropBorder: '#d4c8b0', hoverBg: 'rgba(0,0,0,0.04)',
  },
  parchment: {
    bg: '#17160f', border: 'rgba(200,189,160,0.06)', text: '#c8bda0', muted: '#4a4535',
    accent: '#c45c4a', dropBg: '#1e1c17', dropBorder: 'rgba(200,189,160,0.09)', hoverBg: 'rgba(200,189,160,0.04)',
  },
  midnight: {
    bg: '#080a14', border: 'rgba(255,255,255,0.06)', text: '#b0bcd0', muted: '#3a4560',
    accent: '#6888cc', dropBg: '#0d1020', dropBorder: 'rgba(255,255,255,0.08)', hoverBg: 'rgba(255,255,255,0.04)',
  },
};

interface EditorToolbarProps {
  scriptView: ScriptView;
  onScriptViewChange: (view: ScriptView) => void;
  panelView: PanelView;
  onPanelViewChange: (view: PanelView) => void;
  theme: EditorTheme;
  onThemeChange: (theme: EditorTheme) => void;
  currentElementType: ScreenplayElementType | null;
  onElementTypeChange?: (type: ScreenplayElementType) => void;
  onFormatCommand?: (command: 'bold' | 'italic' | 'underline') => void;
  wordCount: number;
  pageCount: number;
  isSaved: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  sprintMinutes: number | null;
  sprintSecondsLeft: number | null;
  onStartSprint: (minutes: number) => void;
  onStopSprint: () => void;
  onToggleSidebar?: () => void;
  onToggleShortcuts?: () => void;
}

export function EditorToolbar({
  scriptView, onScriptViewChange,
  panelView, onPanelViewChange,
  theme, onThemeChange,
  currentElementType, onElementTypeChange, onFormatCommand,
  wordCount, pageCount, isSaved,
  isFullscreen, onToggleFullscreen,
  sprintMinutes, sprintSecondsLeft, onStartSprint, onStopSprint,
  onToggleSidebar, onToggleShortcuts,
}: EditorToolbarProps) {
  const [openDrop, setOpenDrop] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const c = TB[theme];
  const isLight = theme === 'classic' || theme === 'dawn';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) setOpenDrop(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (name: string) => setOpenDrop(prev => prev === name ? null : name);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentTypeLabel = currentElementType ? typeLabel(currentElementType) : 'Action';

  const dropdownBase: React.CSSProperties = {
    position: 'absolute', top: '100%', marginTop: 4, zIndex: 30,
    background: c.dropBg, border: `1px solid ${c.dropBorder}`,
    borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    padding: '4px 0',
  };

  const dropItemBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 12,
    background: 'transparent', textAlign: 'left',
  };

  return (
    <div
      ref={toolbarRef}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 12px', borderBottom: `1px solid ${c.border}`,
        background: c.bg, userSelect: 'none', flexShrink: 0, minHeight: 34,
      }}
    >
      {/* ── LEFT: sidebar + element type + format ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              background: 'none', border: 'none', color: c.muted,
              cursor: 'pointer', fontSize: 16, padding: '2px 6px', lineHeight: 1,
            }}
            title="Toggle scenes"
          >&#9776;</button>
        )}

        {/* Element Type Dropdown — the primary control */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggle('elements')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px 5px 12px', borderRadius: 4,
              background: openDrop === 'elements' ? c.hoverBg : 'transparent',
              border: `1px solid ${c.border}`, color: c.text,
              cursor: 'pointer', minWidth: 140, fontSize: 12.5, fontWeight: 500,
            }}
          >
            <span>{currentTypeLabel}</span>
            <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ marginLeft: 'auto', opacity: 0.5 }}>
              <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>

          {openDrop === 'elements' && (
            <div style={{ ...dropdownBase, left: 0, minWidth: 200 }}>
              {ELEMENT_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => { onElementTypeChange?.(type); setOpenDrop(null); }}
                  style={{
                    ...dropItemBase,
                    background: currentElementType === type ? c.hoverBg : 'transparent',
                    color: currentElementType === type ? c.accent : c.text,
                  }}
                >
                  <span style={{ width: 16, textAlign: 'center', fontSize: 11, flexShrink: 0 }}>
                    {currentElementType === type ? '✓' : ''}
                  </span>
                  {label}
                </button>
              ))}
              <div style={{ borderTop: `1px solid ${c.dropBorder}`, margin: '4px 12px' }} />
              <div style={{ padding: '4px 12px 6px', fontSize: 10, color: c.muted }}>
                Tab to cycle · Enter for next
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: c.border, margin: '0 2px' }} />

        {/* B I U format buttons */}
        {(['bold', 'italic', 'underline'] as const).map(cmd => (
          <button
            key={cmd}
            onMouseDown={e => { e.preventDefault(); onFormatCommand?.(cmd); }}
            style={{
              width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4, background: 'transparent', cursor: 'pointer',
              border: `1px solid ${c.border}`, color: c.text, fontSize: 13,
              fontWeight: cmd === 'bold' ? 700 : 400,
              fontStyle: cmd === 'italic' ? 'italic' : 'normal',
              textDecoration: cmd === 'underline' ? 'underline' : 'none',
            }}
          >
            {cmd[0].toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── CENTER: sprint timer or view mode ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sprintSecondsLeft !== null ? (
          <>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, fontVariantNumeric: 'tabular-nums',
              color: sprintSecondsLeft < 60 ? '#cc5f5f' : c.accent,
            }}>
              {formatTime(sprintSecondsLeft)}
            </span>
            <button
              onClick={onStopSprint}
              style={{ fontSize: 10, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              Stop
            </button>
          </>
        ) : (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => toggle('views')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 4, background: 'transparent', border: 'none',
                color: c.muted, cursor: 'pointer', fontSize: 10,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              {SCRIPT_VIEWS.find(v => v.id === scriptView)?.label ?? 'Page'} View
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ opacity: 0.4 }}>
                <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>

            {openDrop === 'views' && (
              <div style={{ ...dropdownBase, left: '50%', transform: 'translateX(-50%)', minWidth: 180 }}>
                <div style={{ padding: '6px 12px 4px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: c.muted, fontWeight: 600 }}>
                  Script View
                </div>
                {SCRIPT_VIEWS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { onScriptViewChange(v.id); setOpenDrop(null); }}
                    style={{
                      ...dropItemBase,
                      background: scriptView === v.id ? c.hoverBg : 'transparent',
                      color: scriptView === v.id ? c.accent : c.text,
                    }}
                  >
                    <span style={{ width: 14, fontSize: 11, textAlign: 'center', flexShrink: 0 }}>
                      {scriptView === v.id ? '✓' : ''}
                    </span>
                    {v.label}
                  </button>
                ))}

                <div style={{ borderTop: `1px solid ${c.dropBorder}`, margin: '4px 12px' }} />

                <div style={{ padding: '6px 12px 4px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: c.muted, fontWeight: 600 }}>
                  Panels
                </div>
                {PANEL_VIEWS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { onPanelViewChange(panelView === v.id ? 'none' : v.id); setOpenDrop(null); }}
                    style={{
                      ...dropItemBase,
                      background: panelView === v.id ? c.hoverBg : 'transparent',
                      color: panelView === v.id ? c.accent : c.text,
                    }}
                  >
                    <span style={{ width: 14, fontSize: 11, textAlign: 'center', flexShrink: 0 }}>
                      {panelView === v.id ? '✓' : ''}
                    </span>
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: stats + tools ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: c.muted, fontVariantNumeric: 'tabular-nums' }}>
          {wordCount} words
        </span>
        <span style={{ fontSize: 10, color: c.muted, fontVariantNumeric: 'tabular-nums' }}>
          ~{pageCount} pg
        </span>
        <span style={{ fontSize: 10, color: isSaved ? '#5cb88a' : c.muted, transition: 'color 0.3s' }}>
          {isSaved ? 'Saved' : 'Saving...'}
        </span>

        <div style={{ width: 1, height: 16, background: c.border, margin: '0 2px' }} />

        {/* Sprint */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggle('sprint')}
            style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: sprintMinutes ? c.accent : c.muted, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Sprint
          </button>
          {openDrop === 'sprint' && !sprintMinutes && (
            <div style={{ ...dropdownBase, right: 0, minWidth: 120, padding: '4px' }}>
              <div style={{ padding: '4px 10px 6px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: c.muted }}>Write for</div>
              {[5, 10, 15, 25].map(mins => (
                <button
                  key={mins}
                  onClick={() => { onStartSprint(mins); setOpenDrop(null); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px',
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: c.text, fontSize: 12, borderRadius: 4,
                  }}
                >
                  {mins} minutes
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ambient */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggle('ambient')}
            style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: c.muted, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Mood
          </button>
          <AmbientPlayer isOpen={openDrop === 'ambient'} onToggle={() => toggle('ambient')} />
        </div>

        {/* Theme */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggle('themes')}
            style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: c.muted, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Theme
          </button>
          {openDrop === 'themes' && (
            <div style={{ ...dropdownBase, right: 0, minWidth: 140, padding: '4px' }}>
              <div style={{ padding: '4px 10px 6px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: c.muted }}>Theme</div>
              {THEME_OPTIONS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onThemeChange(t.id); setOpenDrop(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '5px 10px', border: 'none', cursor: 'pointer', borderRadius: 4,
                    background: theme === t.id ? c.hoverBg : 'transparent',
                    color: theme === t.id ? c.accent : c.text, fontSize: 12,
                  }}
                >
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    background: t.swatch, border: '1px solid rgba(128,128,128,0.3)',
                  }} />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Shortcuts */}
        {onToggleShortcuts && (
          <button
            onClick={onToggleShortcuts}
            style={{
              width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${c.border}`, borderRadius: 4,
              background: 'transparent', color: c.muted, cursor: 'pointer', fontSize: 10, fontWeight: 600,
            }}
            title="Keyboard shortcuts"
          >?</button>
        )}

        {/* Zen mode */}
        <button
          onClick={onToggleFullscreen}
          style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: c.muted, cursor: 'pointer', background: 'none', border: 'none' }}
        >
          {isFullscreen ? 'Exit' : 'Zen'}
        </button>
      </div>
    </div>
  );
}
