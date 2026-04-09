'use client';
import { useState, useRef, useEffect } from 'react';
import type { EditorPalette } from './theme-picker';

export interface ExportOptions {
  showSceneNumbers: boolean;
  includeTitlePage: boolean;
  watermark: string;
  header: string;
  defaultTitle: string;
  scenePerPage: boolean;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  palette: EditorPalette | null;
  defaultTitle: string;
}

export function ExportDialog({ isOpen, onClose, onExport, palette, defaultTitle }: ExportDialogProps) {
  const [showSceneNumbers, setShowSceneNumbers] = useState(false);
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [watermark, setWatermark] = useState('');
  const [headerMode, setHeaderMode] = useState<'title' | 'custom'>('title');
  const [customHeader, setCustomHeader] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const bg = palette?.headerBg ?? '#161410';
  const border = palette?.border ?? 'rgba(200,189,160,0.10)';
  const ink = palette?.ink ?? '#c8bda0';
  const muted = palette?.muted ?? '#7a7060';
  const accent = palette?.cursor ?? '#c45c4a';
  const inputBg = palette?.desk ?? '#1c1a14';

  const handleExport = () => {
    onExport({
      showSceneNumbers,
      includeTitlePage,
      scenePerPage: false,
      watermark: watermark.trim(),
      header: headerMode === 'custom' ? customHeader.trim() : defaultTitle,
      defaultTitle,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '16vh', background: 'rgba(0,0,0,0.55)',
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        style={{
          background: bg, border: `1px solid ${border}`, borderRadius: 10,
          padding: '24px 28px', width: 380, maxWidth: '90vw',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Title */}
        <div style={{
          fontSize: 11, color: muted, marginBottom: 20,
          textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600,
        }}>
          Export PDF
        </div>

        {/* Scene Numbers */}
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', marginBottom: 20,
          }}
          onClick={() => setShowSceneNumbers(v => !v)}
        >
          <div style={{
            width: 18, height: 18, borderRadius: 4, flexShrink: 0,
            border: `1.5px solid ${showSceneNumbers ? accent : muted}`,
            background: showSceneNumbers ? accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>
            {showSceneNumbers && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, color: ink, fontWeight: 500 }}>Show Scene Numbers</div>
            <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>
              Left and right margins, production draft style
            </div>
          </div>
        </label>

        {/* Include Title Page */}
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', marginBottom: 20,
          }}
          onClick={() => setIncludeTitlePage(v => !v)}
        >
          <div style={{
            width: 18, height: 18, borderRadius: 4, flexShrink: 0,
            border: `1.5px solid ${includeTitlePage ? accent : muted}`,
            background: includeTitlePage ? accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>
            {includeTitlePage && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, color: ink, fontWeight: 500 }}>Include Title Page</div>
            <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>
              Title, author, and contact info on first page
            </div>
          </div>
        </label>

        {/* Watermark */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Watermark
          </div>
          <input
            type="text"
            value={watermark}
            onChange={e => setWatermark(e.target.value)}
            placeholder="e.g. CONFIDENTIAL"
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13,
              fontFamily: 'Courier, monospace',
              background: inputBg, border: `1px solid ${border}`,
              borderRadius: 5, color: ink, outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = accent; }}
            onBlur={e => { e.currentTarget.style.borderColor = border; }}
          />
          <div style={{ fontSize: 10, color: muted, marginTop: 3 }}>
            Diagonal text on every page, light gray
          </div>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Page Header
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['title', 'custom'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setHeaderMode(mode)}
                style={{
                  padding: '5px 12px', fontSize: 11, borderRadius: 4,
                  background: headerMode === mode ? `${accent}22` : 'transparent',
                  color: headerMode === mode ? accent : muted,
                  border: `1px solid ${headerMode === mode ? `${accent}44` : border}`,
                  cursor: 'pointer', fontWeight: headerMode === mode ? 600 : 400,
                  transition: 'all 0.15s', textTransform: 'capitalize',
                }}
              >
                {mode === 'title' ? 'Screenplay Title' : 'Custom'}
              </button>
            ))}
          </div>
          {headerMode === 'title' ? (
            <div style={{ fontSize: 12, color: ink, opacity: 0.6, fontFamily: 'Courier, monospace', padding: '4px 0' }}>
              {defaultTitle || 'Untitled Screenplay'}
            </div>
          ) : (
            <input
              type="text"
              value={customHeader}
              onChange={e => setCustomHeader(e.target.value)}
              placeholder="e.g. Producer's Draft"
              autoFocus
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13,
                fontFamily: 'Courier, monospace',
                background: inputBg, border: `1px solid ${border}`,
                borderRadius: 5, color: ink, outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = accent; }}
              onBlur={e => { e.currentTarget.style.borderColor = border; }}
            />
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', fontSize: 12, fontWeight: 500,
              background: 'transparent', color: muted,
              border: `1px solid ${border}`, borderRadius: 5,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: '8px 22px', fontSize: 12, fontWeight: 600,
              background: accent, color: '#fff',
              border: 'none', borderRadius: 5,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
