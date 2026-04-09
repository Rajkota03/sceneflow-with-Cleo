'use client';

import { useCallback } from 'react';
import type { TitlePage } from '@/lib/types';
import type { EditorTheme } from './editor-toolbar';

interface TitlePageProps {
  titlePage: TitlePage | undefined;
  onChange: (tp: TitlePage) => void;
  theme: EditorTheme;
  isOpen: boolean;
  onClose: () => void;
}

const THEME_COLORS: Record<EditorTheme, { paper: string; ink: string; cursor: string; bg: string }> = {
  parchment: { paper: '#1c1a14', ink: '#e0d8c0', cursor: '#c45c4a', bg: '#0f0e0a' },
  midnight:  { paper: '#0d1020', ink: '#b8c4dd', cursor: '#6888cc', bg: '#060810' },
  dawn:      { paper: '#faf6ee', ink: '#1a1510', cursor: '#8a7040', bg: '#e8e2d4' },
  classic:   { paper: '#ffffff', ink: '#000000', cursor: '#333333', bg: '#d0d0d0' },
};

const DEFAULT_TITLE_PAGE: TitlePage = {
  title: '',
  credit: 'Written by',
  author: '',
  source: '',
  draftDate: '',
  contact: '',
};

const FONT = 'var(--font-screenplay), "Courier New", Courier, monospace';

export function TitlePageEditor({ titlePage, onChange, theme, isOpen, onClose }: TitlePageProps) {
  const tp = titlePage ?? DEFAULT_TITLE_PAGE;
  const colors = THEME_COLORS[theme];

  const update = useCallback(
    (field: keyof TitlePage, value: string) => {
      onChange({ ...tp, [field]: value });
    },
    [tp, onChange],
  );

  if (!isOpen) return null;

  const inputBase: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid transparent',
    color: colors.ink,
    fontFamily: FONT,
    outline: 'none',
    width: '100%',
    padding: '4px 0',
    textAlign: 'center',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: `1px solid ${colors.ink}22`,
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: 13,
            letterSpacing: '0.15em',
            color: colors.ink,
            opacity: 0.5,
            textTransform: 'uppercase',
          }}
        >
          Title Page
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: `1px solid ${colors.ink}33`,
            color: colors.ink,
            fontFamily: FONT,
            fontSize: 13,
            padding: '6px 16px',
            borderRadius: 4,
            cursor: 'pointer',
            opacity: 0.7,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
        >
          Back to Editor
        </button>
      </div>

      {/* Page */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            width: 816,
            minHeight: 1056,
            background: colors.paper,
            borderRadius: 2,
            boxShadow: `0 4px 40px ${colors.ink}11`,
            position: 'relative',
            fontFamily: FONT,
            color: colors.ink,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Top section: title block centered ~40% from top */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingTop: '38%',
            }}
          >
            {/* Title */}
            <input
              value={tp.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="UNTITLED SCREENPLAY"
              style={{
                ...inputBase,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                maxWidth: 600,
              }}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = colors.cursor; }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
            />

            {/* Credit line */}
            <input
              value={tp.credit}
              onChange={(e) => update('credit', e.target.value)}
              placeholder="Written by"
              style={{
                ...inputBase,
                fontSize: 14,
                marginTop: 32,
                maxWidth: 400,
                opacity: 0.7,
              }}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = colors.cursor; }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
            />

            {/* Author */}
            <input
              value={tp.author}
              onChange={(e) => update('author', e.target.value)}
              placeholder="Author Name"
              style={{
                ...inputBase,
                fontSize: 16,
                marginTop: 8,
                maxWidth: 400,
              }}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = colors.cursor; }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
            />

            {/* Source / Based on */}
            <input
              value={tp.source}
              onChange={(e) => update('source', e.target.value)}
              placeholder="Based on..."
              style={{
                ...inputBase,
                fontSize: 13,
                marginTop: 24,
                maxWidth: 400,
                opacity: 0.6,
              }}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = colors.cursor; }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
            />
          </div>

          {/* Bottom section: draft date (left) + contact (right) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              padding: '0 64px 64px',
            }}
          >
            {/* Draft date — lower left */}
            <input
              value={tp.draftDate}
              onChange={(e) => update('draftDate', e.target.value)}
              placeholder="Draft Date"
              style={{
                ...inputBase,
                textAlign: 'left',
                fontSize: 12,
                width: 200,
                opacity: 0.6,
              }}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = colors.cursor; }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
            />

            {/* Contact — lower right */}
            <textarea
              value={tp.contact}
              onChange={(e) => update('contact', e.target.value)}
              placeholder={'Contact Info'}
              rows={3}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid transparent',
                color: colors.ink,
                fontFamily: FONT,
                fontSize: 12,
                outline: 'none',
                textAlign: 'right',
                width: 220,
                resize: 'none',
                padding: '4px 0',
                opacity: 0.6,
              }}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = colors.cursor; }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
