'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { KleoMessage, KleoTasteProfile, KleoWritingStyle } from '@/lib/kleo-store';
import type { KleoMode } from '@/lib/kleo-brain';
import type { ScreenplayScene } from '@/lib/types';

// ── Screenplay block parser ──
// Kleo wraps screenplay suggestions in <screenplay> blocks
// Each line starts with [type] content

export interface ScreenplayBlock {
  type: 'scene-heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition';
  text: string;
}

interface ParsedResponse {
  segments: Array<
    | { kind: 'text'; content: string }
    | { kind: 'screenplay'; blocks: ScreenplayBlock[]; label?: string }
  >;
}

function parseKleoResponse(text: string): ParsedResponse {
  const segments: ParsedResponse['segments'] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const startIdx = remaining.indexOf('<screenplay>');
    if (startIdx === -1) {
      if (remaining.trim()) segments.push({ kind: 'text', content: remaining.trim() });
      break;
    }

    // Text before the screenplay block
    const before = remaining.slice(0, startIdx).trim();
    if (before) segments.push({ kind: 'text', content: before });

    const endIdx = remaining.indexOf('</screenplay>', startIdx);
    if (endIdx === -1) {
      // Malformed — treat rest as text
      segments.push({ kind: 'text', content: remaining.slice(startIdx).trim() });
      break;
    }

    const blockContent = remaining.slice(startIdx + '<screenplay>'.length, endIdx).trim();
    const blocks: ScreenplayBlock[] = [];
    // Check for a label like "VERSION 1 (cold):" before the block
    let label: string | undefined;

    for (const line of blockContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for version labels
      const labelMatch = trimmed.match(/^(VERSION\s+\d+.*?):?\s*$/i);
      if (labelMatch) {
        label = labelMatch[1];
        continue;
      }

      const typeMatch = trimmed.match(/^\[(scene-heading|action|character|parenthetical|dialogue|transition)\]\s*(.*)$/);
      if (typeMatch) {
        blocks.push({ type: typeMatch[1] as ScreenplayBlock['type'], text: typeMatch[2] });
      }
    }

    if (blocks.length > 0) {
      segments.push({ kind: 'screenplay', blocks, label });
    }

    remaining = remaining.slice(endIdx + '</screenplay>'.length);
  }

  // If no screenplay blocks found, just return as text
  if (segments.length === 0 && text.trim()) {
    segments.push({ kind: 'text', content: text.trim() });
  }

  return { segments };
}

// ── Types ──

interface KleoPanelColors {
  bg: string; accent: string; accentDark: string; border: string;
  ink: string; muted: string; faint: string;
}

interface KleoPanelProps {
  taste: KleoTasteProfile;
  style: KleoWritingStyle | null;
  scenes: ScreenplayScene[];
  activeSceneId: string | null;
  conversations: KleoMessage[];
  onNewMessage: (msg: KleoMessage) => void;
  onClose: () => void;
  onInsertBlocks?: (blocks: ScreenplayBlock[]) => void;
  onReplaceSelection?: (blocks: ScreenplayBlock[]) => void;
  selectedText?: string;
  palette?: { paper: string; ink: string; inkFaint: string; cursor: string; headerBg: string; border: string; muted: string } | null;
}

// Kleo's brand: terracotta stays constant
const KLEO_ACCENT = '#c45c4a';
const KLEO_ACCENT_DARK = '#8a3a2a';

const DEFAULT_COLORS: KleoPanelColors = {
  bg: '#13120f', accent: KLEO_ACCENT, accentDark: KLEO_ACCENT_DARK,
  border: 'rgba(196, 92, 74, 0.12)', ink: '#d6ccb0', muted: '#5a5440', faint: '#8a8578',
};

function colorsFromPalette(p: KleoPanelProps['palette']): KleoPanelColors {
  if (!p) return DEFAULT_COLORS;
  return {
    bg: p.headerBg, accent: KLEO_ACCENT, accentDark: KLEO_ACCENT_DARK,
    border: p.border, ink: p.ink, muted: p.muted, faint: p.inkFaint,
  };
}

// ── Mode config ──

const MODE_CONFIG: Record<KleoMode, { label: string; icon: string; desc: string }> = {
  'sounding-board': { label: 'Sounding Board', icon: '💬', desc: 'Questions & provocations' },
  'script-doctor': { label: 'Script Doctor', icon: '✍️', desc: 'Writes screenplay content' },
  'story-brain': { label: 'Story Brain', icon: '🧠', desc: 'Analysis & structure' },
};

// Auto-detect mode from message content
function detectMode(message: string, hasSelection: boolean): KleoMode {
  const lower = message.toLowerCase();

  // Script Doctor triggers: selected text, rewrite/polish/tighten/dialogue requests
  if (hasSelection) return 'script-doctor';
  if (lower.match(/\b(rewrite|polish|tighten|fix|write me|give me|dialogue|action line|reword|draft|version|try this)\b/)) return 'script-doctor';

  // Story Brain triggers: analytical/structural questions
  if (lower.match(/\b(weakest|strongest|arc|plot hole|structure|pacing|act one|act two|act three|second act|theme|track|analyze|breakdown|character.*develop|emotional.*journey|stakes|where does|what's wrong)\b/)) return 'story-brain';

  // Default: Sounding Board
  return 'sounding-board';
}

// ── Screenplay Block Display Component ──

function ScreenplayBlockCard({
  blocks, label, colors, onInsert, onReplace, hasSelection,
}: {
  blocks: ScreenplayBlock[];
  label?: string;
  colors: KleoPanelColors;
  onInsert?: (blocks: ScreenplayBlock[]) => void;
  onReplace?: (blocks: ScreenplayBlock[]) => void;
  hasSelection: boolean;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '12px 14px',
      marginTop: 8,
      fontFamily: 'Courier, monospace',
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      {label && (
        <div style={{ fontSize: 9, color: colors.accent, fontWeight: 600, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>
          {label}
        </div>
      )}
      {blocks.map((block, i) => {
        const indent = block.type === 'character' ? '35%'
          : block.type === 'dialogue' ? '20%'
          : block.type === 'parenthetical' ? '25%'
          : block.type === 'transition' ? '0'
          : '0';
        const align = block.type === 'transition' ? 'right' as const : 'left' as const;
        const isBold = block.type === 'scene-heading';
        const isUpper = block.type === 'scene-heading' || block.type === 'character' || block.type === 'transition';

        return (
          <div key={i} style={{
            marginLeft: indent,
            textAlign: align,
            fontWeight: isBold ? 700 : 400,
            color: colors.ink,
            opacity: block.type === 'parenthetical' ? 0.7 : 1,
            marginTop: (block.type === 'character' || block.type === 'scene-heading') && i > 0 ? 8 : 2,
          }}>
            {block.type === 'parenthetical' ? `(${block.text.replace(/^\(|\)$/g, '')})` : isUpper ? block.text.toUpperCase() : block.text}
          </div>
        );
      })}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
        {hasSelection && onReplace && (
          <button
            onClick={() => onReplace(blocks)}
            style={{
              padding: '4px 10px', fontSize: 10, fontWeight: 600,
              background: `${colors.accent}15`, color: colors.accent,
              border: `1px solid ${colors.accent}33`, borderRadius: 4,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              letterSpacing: '0.03em',
            }}
          >
            Replace ↗
          </button>
        )}
        {onInsert && (
          <button
            onClick={() => onInsert(blocks)}
            style={{
              padding: '4px 10px', fontSize: 10, fontWeight: 600,
              background: `${colors.accent}15`, color: colors.accent,
              border: `1px solid ${colors.accent}33`, borderRadius: 4,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              letterSpacing: '0.03em',
            }}
          >
            Insert ↗
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ──

export function KleoPanel({
  taste, style, scenes, activeSceneId,
  conversations, onNewMessage, onClose,
  onInsertBlocks, onReplaceSelection,
  selectedText, palette,
}: KleoPanelProps) {
  const c = colorsFromPalette(palette);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [mode, setMode] = useState<KleoMode>(selectedText ? 'script-doctor' : 'sounding-board');
  const [modeAutoDetected, setModeAutoDetected] = useState(true);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If opened with selected text, pre-fill context
  useEffect(() => {
    if (selectedText && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedText]);

  // Focus input on open — Kleo stays silent until the writer speaks
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Auto-detect mode from message (unless user manually picked one)
    const activeMode = modeAutoDetected ? detectMode(text, !!selectedText) : mode;
    if (modeAutoDetected && activeMode !== mode) setMode(activeMode);

    const writerMsg: KleoMessage = { role: 'writer', text, timestamp: Date.now(), context: 'chat' };
    onNewMessage(writerMsg);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/kleo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat', taste, style, scenes, activeSceneId,
          conversations: [...conversations, writerMsg],
          message: text, mode: activeMode, selectedText,
        }),
      });
      const data = await res.json();
      const kleoMsg: KleoMessage = { role: 'kleo', text: data.message, timestamp: Date.now(), context: 'chat' };
      onNewMessage(kleoMsg);
      typeMessage(data.message);
    } catch {
      onNewMessage({
        role: 'kleo',
        text: "Let's come at this from a different angle. What does your character need from this scene?",
        timestamp: Date.now(), context: 'chat',
      });
    }
    setLoading(false);
  }, [input, loading, taste, style, scenes, activeSceneId, conversations, onNewMessage, mode, modeAutoDetected, selectedText]);

  const typeMessage = (text: string) => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    setTypingText('');
    let i = 0;
    // Faster typing for longer responses, snappy for short ones
    const speed = text.length > 200 ? 4 : text.length > 100 ? 8 : 14;
    typingIntervalRef.current = setInterval(() => {
      if (i < text.length) {
        // Jump multiple chars at a time for very long responses
        const step = text.length > 300 ? 3 : 1;
        i = Math.min(i + step, text.length);
        setTypingText(text.slice(0, i));
      } else {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        setTypingText('');
        inputRef.current?.focus();
      }
    }, speed);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [conversations, typingText]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Cleanup typing interval
  useEffect(() => {
    return () => { if (typingIntervalRef.current) clearInterval(typingIntervalRef.current); };
  }, []);

  // Filter messages
  const filtered = conversations.filter(m => m.context === 'stuck' || m.context === 'chat').slice(-10);
  const visibleMessages = typingText ? filtered.slice(0, -1) : filtered;

  // Render a message with screenplay block parsing
  const renderMessageContent = (text: string, isTyping?: boolean) => {
    if (isTyping) {
      return (
        <span>
          {text}
          <span style={{ opacity: 0.4, animation: 'blink 1s infinite' }}>|</span>
        </span>
      );
    }

    const parsed = parseKleoResponse(text);
    return (
      <>
        {parsed.segments.map((seg, i) => {
          if (seg.kind === 'text') {
            return <span key={i}>{seg.content}</span>;
          }
          return (
            <ScreenplayBlockCard
              key={i}
              blocks={seg.blocks}
              label={seg.label}
              colors={c}
              onInsert={onInsertBlocks}
              onReplace={onReplaceSelection}
              hasSelection={!!selectedText}
            />
          );
        })}
      </>
    );
  };

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 400,
      background: c.bg, borderLeft: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column', zIndex: 40,
      animation: 'slideIn 0.25s ease-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', borderBottom: `1px solid ${c.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: `linear-gradient(135deg, ${c.accent} 0%, ${c.accentDark} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
          }}>K</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: c.accent, letterSpacing: '0.06em' }}>KLEO</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: c.muted,
              cursor: 'pointer', fontSize: 16, padding: '2px 4px', lineHeight: 1,
            }}
          >×</button>
        </div>
      </div>

      {/* Mode buttons */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 18px',
        borderBottom: `1px solid ${c.border}`,
      }}>
        {(['sounding-board', 'script-doctor', 'story-brain'] as KleoMode[]).map(m => {
          const cfg = MODE_CONFIG[m];
          const isActive = mode === m;
          return (
            <button
              key={m}
              onClick={() => { setMode(m); setModeAutoDetected(false); }}
              style={{
                flex: 1, padding: '6px 4px', fontSize: 10, fontWeight: isActive ? 600 : 400,
                background: isActive ? `${c.accent}15` : 'rgba(255,255,255,0.02)',
                color: isActive ? c.accent : c.faint,
                border: `1px solid ${isActive ? `${c.accent}33` : c.border}`,
                borderRadius: 6, cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              <div style={{ fontSize: 14, marginBottom: 2 }}>{cfg.icon}</div>
              <div style={{ letterSpacing: '0.02em' }}>{cfg.label}</div>
            </button>
          );
        })}
      </div>

      {/* Selected text context indicator */}
      {selectedText && (
        <div style={{
          padding: '8px 18px', borderBottom: `1px solid ${c.border}`,
          background: `${c.accent}08`,
        }}>
          <div style={{ fontSize: 9, color: c.accent, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            Working on selection
          </div>
          <div style={{
            fontSize: 11, color: c.faint, fontFamily: 'Courier, monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {selectedText.slice(0, 80)}{selectedText.length > 80 ? '...' : ''}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '14px 18px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        {/* Empty state — Kleo waits for the writer */}
        {visibleMessages.length === 0 && !typingText && !loading && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            opacity: 0.5, padding: '40px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28 }}>✦</div>
            <div style={{ fontSize: 12, color: c.faint, lineHeight: 1.6 }}>
              {selectedText ? "What should I do with this?" : "What are you working on?"}
            </div>
          </div>
        )}

        {visibleMessages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'writer' ? 'flex-end' : 'flex-start',
            maxWidth: '92%',
          }}>
            {msg.role === 'kleo' && (
              <div style={{ fontSize: 9, color: c.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Kleo
              </div>
            )}
            <div style={{
              fontSize: msg.role === 'kleo' ? 13 : 12,
              lineHeight: 1.7,
              color: msg.role === 'kleo' ? c.ink : c.faint,
              background: msg.role === 'writer' ? 'rgba(255,255,255,0.04)' : 'transparent',
              padding: msg.role === 'writer' ? '6px 10px' : '0',
              borderRadius: msg.role === 'writer' ? 6 : 0,
            }}>
              {msg.role === 'kleo' ? renderMessageContent(msg.text) : msg.text}
            </div>
          </div>
        ))}

        {/* Typing animation */}
        {typingText && (
          <div style={{ maxWidth: '92%' }}>
            <div style={{ fontSize: 9, color: c.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Kleo
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: c.ink }}>
              {renderMessageContent(typingText, true)}
            </div>
          </div>
        )}

        {/* Loading pulse */}
        {loading && !typingText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: c.accent,
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{ fontSize: 10, color: c.muted, fontStyle: 'italic' }}>
              thinking...
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px', borderTop: `1px solid ${c.border}`,
        display: 'flex', gap: 8,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          placeholder={selectedText ? "What should Kleo do with this?" : mode === 'script-doctor' ? "What should Kleo write?" : mode === 'story-brain' ? "Ask about your story..." : "Talk to Kleo..."}
          style={{
            flex: 1, padding: '8px 12px', fontSize: 13,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${c.border}`,
            borderRadius: 6, color: c.ink, outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          style={{
            padding: '8px 14px', fontSize: 10, fontWeight: 600,
            background: input.trim() ? `${c.accent}18` : 'transparent',
            color: input.trim() ? c.accent : c.muted,
            border: `1px solid ${input.trim() ? `${c.accent}33` : c.border}`,
            borderRadius: 6, cursor: input.trim() ? 'pointer' : 'default',
            letterSpacing: '0.04em',
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes blink { 0%, 50% { opacity: 0.4; } 51%, 100% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
