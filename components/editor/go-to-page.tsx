'use client';
import { useState, useRef, useEffect } from 'react';
import type { EditorTheme } from './editor-toolbar';

const GTB: Record<EditorTheme, { bg: string; border: string; text: string; muted: string; accent: string; inputBg: string }> = {
  classic: { bg: '#ffffff', border: '#ddd', text: '#222', muted: '#888', accent: '#1a73e8', inputBg: '#f8f8f8' },
  dawn: { bg: '#f8f2e6', border: '#ccc0a8', text: '#2a2010', muted: '#9a9080', accent: '#7a6030', inputBg: '#f0e8d8' },
  parchment: { bg: '#161410', border: 'rgba(255,255,255,0.08)', text: '#d6ccb0', muted: '#5a5440', accent: '#c45c4a', inputBg: '#1c1a14' },
  midnight: { bg: '#0d1020', border: 'rgba(255,255,255,0.08)', text: '#b0bcd0', muted: '#3a4560', accent: '#6888cc', inputBg: '#0a0d18' },
};

interface GoToPageProps {
  theme: EditorTheme;
  totalPages: number;
  onGoToPage: (page: number) => void;
  onClose: () => void;
}

export function GoToPageDialog({ theme, totalPages, onGoToPage, onClose }: GoToPageProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const c = GTB[theme];

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const num = parseInt(value, 10);
    if (num >= 1 && num <= totalPages) {
      onGoToPage(num);
      onClose();
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '20vh', background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8,
          padding: '16px 20px', width: 280, boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ fontSize: 11, color: c.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Go to Page
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={totalPages}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onClose();
            }}
            placeholder={`1–${totalPages}`}
            style={{
              flex: 1, padding: '6px 10px', fontSize: 14,
              background: c.inputBg, border: `1px solid ${c.border}`,
              borderRadius: 4, color: c.text, outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <button
            onClick={submit}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              background: c.accent, color: '#fff', border: 'none',
              borderRadius: 4, cursor: 'pointer',
            }}
          >
            Go
          </button>
        </div>
        <div style={{ fontSize: 10, color: c.muted, marginTop: 6 }}>
          {totalPages} page{totalPages !== 1 ? 's' : ''} total
        </div>
      </div>
    </div>
  );
}
