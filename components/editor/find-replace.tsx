'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import type { ScreenplayScene } from '@/lib/types';
import type { EditorTheme } from './editor-toolbar';

interface FindReplaceProps {
  scenes: ScreenplayScene[];
  theme: EditorTheme;
  onReplace: (search: string, replace: string, replaceAll: boolean) => void;
  onClose: () => void;
}

export function FindReplace({ scenes, theme, onReplace, onClose }: FindReplaceProps) {
  const [search, setSearch] = useState('');
  const [replace, setReplace] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Count matches
  const matchCount = useMemo(() => {
    if (!search) return 0;
    const lower = search.toLowerCase();
    let count = 0;
    for (const scene of scenes) {
      // Count in heading
      let idx = 0;
      const headingLower = scene.heading.toLowerCase();
      while ((idx = headingLower.indexOf(lower, idx)) !== -1) { count++; idx++; }
      // Count in elements
      for (const el of scene.elements) {
        idx = 0;
        const textLower = el.text.toLowerCase();
        while ((idx = textLower.indexOf(lower, idx)) !== -1) { count++; idx++; }
      }
    }
    return count;
  }, [search, scenes]);

  // Highlight matches via CSS (mark text)
  useEffect(() => {
    if (typeof CSS === 'undefined' || !CSS.highlights) return;

    if (!search) {
      CSS.highlights.delete('search-highlight');
      return;
    }

    const ranges: Range[] = [];
    const lower = search.toLowerCase();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = node.textContent?.toLowerCase() ?? '';
      let idx = 0;
      while ((idx = text.indexOf(lower, idx)) !== -1) {
        const range = new Range();
        range.setStart(node, idx);
        range.setEnd(node, idx + search.length);
        ranges.push(range);
        idx++;
      }
    }

    if (ranges.length > 0) {
      CSS.highlights.set('search-highlight', new Highlight(...ranges));
    } else {
      CSS.highlights.delete('search-highlight');
    }

    return () => {
      CSS.highlights?.delete('search-highlight');
    };
  }, [search, scenes]);

  const isDark = theme === 'parchment' || theme === 'midnight';

  return (
    <div
      className="absolute top-0 right-0 z-20 m-3 border rounded-lg overflow-hidden"
      style={{
        backgroundColor: isDark ? 'var(--color-surface, #111520)' : '#f5f5f5',
        borderColor: isDark ? 'var(--color-border-2)' : '#ddd',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        width: 340,
      }}
    >
      {/* Search row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Find..."
          className="flex-1 bg-transparent outline-none text-xs"
          style={{
            color: isDark ? '#d6d1c4' : '#1a1a1a',
            caretColor: isDark ? '#c45c4a' : '#333',
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && e.shiftKey) setShowReplace(true);
          }}
        />
        <span className="text-[10px] tabular-nums shrink-0" style={{ color: isDark ? '#4a4740' : '#999' }}>
          {search ? `${matchCount} found` : ''}
        </span>
        <button
          onClick={() => setShowReplace(!showReplace)}
          className="text-[10px] uppercase tracking-wider cursor-pointer shrink-0"
          style={{ color: isDark ? '#8a8578' : '#666' }}
        >
          {showReplace ? 'Hide' : 'Replace'}
        </button>
        <button
          onClick={onClose}
          className="text-sm cursor-pointer leading-none"
          style={{ color: isDark ? '#4a4740' : '#999' }}
        >
          &times;
        </button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: isDark ? 'var(--color-border)' : '#eee' }}>
          <input
            type="text"
            value={replace}
            onChange={e => setReplace(e.target.value)}
            placeholder="Replace with..."
            className="flex-1 bg-transparent outline-none text-xs"
            style={{
              color: isDark ? '#d6d1c4' : '#1a1a1a',
              caretColor: isDark ? '#c45c4a' : '#333',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onReplace(search, replace, false);
              }
            }}
          />
          <button
            onClick={() => search && onReplace(search, replace, false)}
            className="text-[10px] uppercase tracking-wider cursor-pointer shrink-0 px-2 py-1 rounded"
            style={{
              color: isDark ? '#c45c4a' : '#333',
              backgroundColor: isDark ? 'rgba(196,92,74,0.08)' : 'rgba(0,0,0,0.05)',
            }}
          >
            One
          </button>
          <button
            onClick={() => search && onReplace(search, replace, true)}
            className="text-[10px] uppercase tracking-wider cursor-pointer shrink-0 px-2 py-1 rounded"
            style={{
              color: isDark ? '#c45c4a' : '#333',
              backgroundColor: isDark ? 'rgba(196,92,74,0.08)' : 'rgba(0,0,0,0.05)',
            }}
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
