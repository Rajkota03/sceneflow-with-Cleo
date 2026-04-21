'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { KleoMessage, KleoTasteProfile, KleoWritingStyle, KleoIdentity, KleoVoice } from '@/lib/kleo-store';
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
    let label: string | undefined;

    // Check for a leading label like "VERSION 1 (cold):"
    const labelMatch = blockContent.match(/^(VERSION\s+\d+[^\n\[]*?):?\s*(?=\[|$)/i);
    let body = blockContent;
    if (labelMatch) {
      label = labelMatch[1].trim();
      body = blockContent.slice(labelMatch[0].length);
    }

    // Parse [type] markers regardless of newlines — model often emits inline
    const typeRegex = /\[(scene-heading|action|character|parenthetical|dialogue|transition)\]\s*([^\[]*)/g;
    let m: RegExpExecArray | null;
    while ((m = typeRegex.exec(body)) !== null) {
      const type = m[1] as ScreenplayBlock['type'];
      const text = m[2].trim();
      if (text || type === 'parenthetical') {
        blocks.push({ type, text });
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
  identity: KleoIdentity;
  onIdentityChange: (identity: KleoIdentity) => void;
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
              padding: '5px 12px', fontSize: 10, fontWeight: 700,
              background: colors.accent, color: '#fff',
              border: 'none', borderRadius: 4,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}
          >
            Try ↗
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ──

export function KleoPanel({
  taste, style, scenes, activeSceneId,
  conversations, identity, onIdentityChange,
  onNewMessage, onClose,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingReaction, setLoadingReaction] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRafRef = useRef<number | null>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  // Close settings popover on outside click / Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        settingsPopoverRef.current?.contains(target) ||
        settingsButtonRef.current?.contains(target)
      ) return;
      setSettingsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  // Voice-appropriate "thinking" reactions — picked randomly each time
  const BUDDY_REACTIONS = [
    'hmm let me think', 'okay okay…', 'oh wait…', 'hold on…',
    'mm, gimme a sec', 'thinking thinking', 'okay so…',
  ];
  const MENTOR_REACTIONS = [
    'reading the page', 'one sec', 'looking at it',
    'checking the script', 'working on it', 'reviewing',
  ];

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
    // Pick a voice-appropriate reaction
    const pool = identity.voice === 'mentor' ? MENTOR_REACTIONS : BUDDY_REACTIONS;
    setLoadingReaction(pool[Math.floor(Math.random() * pool.length)]);

    try {
      const res = await fetch('/api/kleo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat', taste, style, scenes, activeSceneId,
          conversations: [...conversations, writerMsg],
          message: text, mode: activeMode, selectedText, identity,
        }),
      });
      const data = await res.json();
      const kleoMsg: KleoMessage = { role: 'kleo', text: data.message, timestamp: Date.now(), context: 'chat' };
      onNewMessage(kleoMsg);
      // Skip typewriter for screenplay responses — they should pop in formatted, not type out raw tags
      if (data.message.includes('<screenplay>')) {
        setTypingText('');
        inputRef.current?.focus();
      } else {
        typeMessage(data.message);
      }
    } catch {
      onNewMessage({
        role: 'kleo',
        text: "Let's come at this from a different angle. What does your character need from this scene?",
        timestamp: Date.now(), context: 'chat',
      });
    }
    setLoading(false);
  }, [input, loading, taste, style, scenes, activeSceneId, conversations, onNewMessage, mode, modeAutoDetected, selectedText, identity]);

  const typeMessage = (text: string) => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingRafRef.current) cancelAnimationFrame(typingRafRef.current);
    setTypingText('');

    // Reading-paced reveal: ~42 chars/sec (~420 wpm) — slightly faster than
    // average reading so the eye is led along, not waiting. Smooth via rAF —
    // no jitter, no metronome feel. Punctuation gets a small gate so each
    // sentence "lands" before the next one starts.
    const CHARS_PER_MS = 0.042;
    const startTime = performance.now();
    let gateUntil = 0;
    let lastRevealedIdx = 0;

    const frame = (now: number) => {
      // How many chars *should* be visible by now, ignoring gates
      const elapsed = now - startTime;
      const target = Math.min(text.length, Math.floor(elapsed * CHARS_PER_MS));

      // If we're inside a punctuation gate, don't reveal past the gate point
      const reveal = now < gateUntil ? lastRevealedIdx : target;

      if (reveal !== lastRevealedIdx) {
        lastRevealedIdx = reveal;
        setTypingText(text.slice(0, reveal));

        // After revealing, check if the last char triggers a breath gate
        const lastChar = text[reveal - 1];
        const nextChar = text[reveal];
        if ((lastChar === '.' || lastChar === '?' || lastChar === '!') &&
            (nextChar === ' ' || nextChar === '\n' || nextChar === undefined)) {
          gateUntil = now + 220;
        } else if (lastChar === ',' || lastChar === ';' || lastChar === ':') {
          gateUntil = now + 90;
        } else if (lastChar === '—') {
          gateUntil = now + 120;
        } else if (lastChar === '\n') {
          gateUntil = now + 140;
        }
      }

      if (reveal >= text.length) {
        setTypingText(text);
        typingRafRef.current = null;
        inputRef.current?.focus();
        return;
      }

      typingRafRef.current = requestAnimationFrame(frame);
    };

    typingRafRef.current = requestAnimationFrame(frame);
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

  // Cleanup typing timers
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingRafRef.current) cancelAnimationFrame(typingRafRef.current);
    };
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
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: `linear-gradient(135deg, ${c.accent} 0%, ${c.accentDark} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
          }}>K</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: c.accent, letterSpacing: '0.06em' }}>
              KLEO
            </span>
            <span style={{ fontSize: 9, color: c.muted, letterSpacing: '0.05em' }}>
              {identity.voice === 'mentor' ? 'MENTOR' : 'BUDDY'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            ref={settingsButtonRef}
            onClick={() => setSettingsOpen(s => !s)}
            title="Voice"
            style={{
              background: settingsOpen ? `${c.accent}15` : 'none', border: 'none',
              color: settingsOpen ? c.accent : c.muted,
              cursor: 'pointer', padding: '4px 6px', borderRadius: 4, lineHeight: 1,
              transition: 'all 0.15s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="8" cy="8" r="2"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/>
            </svg>
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: c.muted,
              cursor: 'pointer', fontSize: 16, padding: '2px 4px', lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Settings popover */}
        {settingsOpen && (
          <div ref={settingsPopoverRef} style={{
            position: 'absolute', top: '100%', right: 12, marginTop: 6, zIndex: 50,
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 10, padding: 14, width: 270,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 9, color: c.muted, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>
              VOICE
            </div>
            {([
              { id: 'buddy' as KleoVoice, label: 'Buddy', desc: 'Warm. Conversational. The friend in the room.' },
              { id: 'mentor' as KleoVoice, label: 'Mentor', desc: 'Sharp. Structural. The note that points at the page.' },
            ]).map(v => {
              const isActive = identity.voice === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onIdentityChange({ ...identity, voice: v.id })}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', marginBottom: 4,
                    background: isActive ? `${c.accent}15` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? `${c.accent}33` : c.border}`,
                    borderRadius: 6, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? c.accent : c.ink, marginBottom: 2 }}>
                    {v.label}
                  </div>
                  <div style={{ fontSize: 10, color: c.faint, lineHeight: 1.4 }}>
                    {v.desc}
                  </div>
                </button>
              );
            })}

            {/* Grain slider — language texture */}
            <div style={{ marginTop: 14, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 9, color: c.muted, letterSpacing: '0.1em', fontWeight: 600 }}>
                GRAIN
              </div>
              <div style={{ fontSize: 9, color: c.faint, fontStyle: 'italic' }}>
                {(identity.grain ?? 30) <= 33 ? 'Plain' : (identity.grain ?? 30) <= 66 ? 'Natural' : 'Crafted'}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={identity.grain ?? 30}
              onChange={e => onIdentityChange({ ...identity, grain: Number(e.target.value) })}
              style={{
                width: '100%', accentColor: c.accent, cursor: 'pointer',
                height: 4, marginBottom: 4,
              }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 8, color: c.muted, letterSpacing: '0.05em',
            }}>
              <span>SPOKEN</span>
              <span>LITERARY</span>
            </div>
            <div style={{ fontSize: 10, color: c.faint, lineHeight: 1.4, marginTop: 8 }}>
              {identity.voice === 'mentor'
                ? ((identity.grain ?? 30) <= 33
                  ? 'Plain, direct notes. The kind a director gives between takes.'
                  : (identity.grain ?? 30) <= 66
                  ? 'Clear notes with the occasional sharp image when it earns its place.'
                  : 'Notes with weight. Picks the precise word, not the easy one.')
                : ((identity.grain ?? 30) <= 33
                  ? 'Short words. Like texting a friend who gets it.'
                  : (identity.grain ?? 30) <= 66
                  ? 'Plain talk, with a sharp image when something hits.'
                  : 'Lets the language breathe. Picks the right word, not the easy one.')}
            </div>
          </div>
        )}
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
              fontSize: msg.role === 'kleo' ? 14 : 12,
              lineHeight: msg.role === 'kleo' ? 1.65 : 1.6,
              color: msg.role === 'kleo' ? c.ink : c.faint,
              background: msg.role === 'writer' ? 'rgba(255,255,255,0.04)' : 'transparent',
              padding: msg.role === 'writer' ? '6px 10px' : '0',
              borderRadius: msg.role === 'writer' ? 6 : 0,
              fontFamily: msg.role === 'kleo' ? 'Georgia, "Iowan Old Style", serif' : 'inherit',
              wordSpacing: msg.role === 'kleo' ? '0.02em' : 'normal',
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
            <div style={{
              fontSize: 14, lineHeight: 1.65, color: c.ink,
              fontFamily: 'Georgia, "Iowan Old Style", serif',
              wordSpacing: '0.02em',
            }}>
              {renderMessageContent(typingText, true)}
            </div>
          </div>
        )}

        {/* Loading reaction — voice-aware, in character */}
        {loading && !typingText && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 12, color: c.faint, fontStyle: 'italic',
              fontFamily: 'Georgia, serif', letterSpacing: '0.01em',
              animation: 'kleoBreathe 1.8s ease-in-out infinite',
            }}>
              {loadingReaction}
            </span>
            <span style={{
              display: 'inline-flex', gap: 2,
            }}>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: c.accent, animation: 'kleoDot 1.4s ease-in-out infinite', animationDelay: '0s' }} />
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: c.accent, animation: 'kleoDot 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: c.accent, animation: 'kleoDot 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
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
        @keyframes kleoBreathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.95; } }
        @keyframes kleoDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
