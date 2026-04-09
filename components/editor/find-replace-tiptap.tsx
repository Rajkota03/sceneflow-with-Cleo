'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import type { EditorTheme } from './editor-toolbar'

interface FindReplaceTiptapProps {
  editor: Editor
  theme: EditorTheme
  onClose: () => void
}

/**
 * Minimal find & replace bar for the TipTap screenplay editor.
 * Uses the CSS Custom Highlight API for visual highlighting and
 * walks the editor's ProseMirror doc for match counting / navigation.
 */
export function FindReplaceTiptap({ editor, theme, onClose }: FindReplaceTiptapProps) {
  const [search, setSearch] = useState('')
  const [replace, setReplace] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [currentMatch, setCurrentMatch] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Escape closes the bar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Collect all match positions in the ProseMirror doc
  const getMatches = useCallback((): { from: number; to: number }[] => {
    if (!search) return []
    const matches: { from: number; to: number }[] = []
    const lower = search.toLowerCase()
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText) return
      const text = node.text?.toLowerCase() ?? ''
      let idx = 0
      while ((idx = text.indexOf(lower, idx)) !== -1) {
        matches.push({ from: pos + idx, to: pos + idx + search.length })
        idx++
      }
    })
    return matches
  }, [editor, search])

  // Update match count and CSS highlights whenever search changes
  useEffect(() => {
    const matches = getMatches()
    setMatchCount(matches.length)
    if (matches.length > 0 && currentMatch >= matches.length) {
      setCurrentMatch(0)
    }

    // CSS Highlight API for visual feedback
    if (typeof CSS === 'undefined' || !CSS.highlights) return
    if (!search || matches.length === 0) {
      CSS.highlights.delete('search-highlight')
      return
    }

    const ranges: Range[] = []
    const lower = search.toLowerCase()
    const editorEl = editor.view.dom
    const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT)

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const text = node.textContent?.toLowerCase() ?? ''
      let idx = 0
      while ((idx = text.indexOf(lower, idx)) !== -1) {
        const range = new Range()
        range.setStart(node, idx)
        range.setEnd(node, idx + search.length)
        ranges.push(range)
        idx++
      }
    }

    if (ranges.length > 0) {
      CSS.highlights.set('search-highlight', new Highlight(...ranges))
    } else {
      CSS.highlights.delete('search-highlight')
    }

    return () => { CSS.highlights?.delete('search-highlight') }
  }, [search, editor, getMatches, currentMatch])

  // Navigate to next match
  const goToMatch = useCallback((index: number) => {
    const matches = getMatches()
    if (matches.length === 0) return
    const i = ((index % matches.length) + matches.length) % matches.length
    setCurrentMatch(i)
    const match = matches[i]
    editor.chain().setTextSelection(match).scrollIntoView().run()
  }, [editor, getMatches])

  const handleNext = () => goToMatch(currentMatch + 1)
  const handlePrev = () => goToMatch(currentMatch - 1)

  // Replace current match
  const handleReplace = useCallback(() => {
    const matches = getMatches()
    if (matches.length === 0 || !search) return
    const i = Math.min(currentMatch, matches.length - 1)
    const match = matches[i]
    editor.chain()
      .setTextSelection(match)
      .deleteSelection()
      .insertContent(replace)
      .run()
  }, [editor, search, replace, currentMatch, getMatches])

  // Replace all matches — single transaction, end-to-start so positions stay valid
  const handleReplaceAll = useCallback(() => {
    const matches = getMatches()
    if (matches.length === 0 || !search) return
    const sorted = [...matches].sort((a, b) => b.from - a.from)
    const { tr } = editor.state
    for (const match of sorted) {
      if (replace) {
        tr.replaceWith(match.from, match.to, editor.schema.text(replace))
      } else {
        tr.delete(match.from, match.to)
      }
    }
    editor.view.dispatch(tr)
    setCurrentMatch(0)
  }, [editor, search, replace, getMatches])

  const isDark = theme === 'parchment' || theme === 'midnight'

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
          onChange={e => { setSearch(e.target.value); setCurrentMatch(0) }}
          placeholder="Find..."
          className="flex-1 bg-transparent outline-none text-xs"
          style={{
            color: isDark ? '#d6d1c4' : '#1a1a1a',
            caretColor: isDark ? '#c45c4a' : '#333',
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && !e.shiftKey) handleNext()
            if (e.key === 'Enter' && e.shiftKey) handlePrev()
          }}
        />
        <span
          className="text-[10px] tabular-nums shrink-0"
          style={{ color: isDark ? '#4a4740' : '#999' }}
        >
          {search ? `${matchCount > 0 ? currentMatch + 1 : 0}/${matchCount}` : ''}
        </span>
        <button
          onClick={handlePrev}
          className="text-xs cursor-pointer shrink-0 px-1"
          style={{ color: isDark ? '#8a8578' : '#666' }}
          title="Previous (Shift+Enter)"
        >
          &#9650;
        </button>
        <button
          onClick={handleNext}
          className="text-xs cursor-pointer shrink-0 px-1"
          style={{ color: isDark ? '#8a8578' : '#666' }}
          title="Next (Enter)"
        >
          &#9660;
        </button>
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
        <div
          className="flex items-center gap-2 px-3 py-2 border-t"
          style={{ borderColor: isDark ? 'var(--color-border)' : '#eee' }}
        >
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
              if (e.key === 'Enter') handleReplace()
            }}
          />
          <button
            onClick={handleReplace}
            className="text-[10px] uppercase tracking-wider cursor-pointer shrink-0 px-2 py-1 rounded"
            style={{
              color: isDark ? '#c45c4a' : '#333',
              backgroundColor: isDark ? 'rgba(196,92,74,0.08)' : 'rgba(0,0,0,0.05)',
            }}
          >
            One
          </button>
          <button
            onClick={handleReplaceAll}
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
  )
}
