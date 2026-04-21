'use client';
// Kleo margin — ambient notes pinned next to the scene they're about.
// Lives inside the editor's scroll container as an absolute-positioned
// overlay. Each note is anchored to a scene heading's y-coordinate.
//
// Philosophy: notes are observations, not interruptions. They don't
// animate in. They don't demand attention. They're margins, not alerts.

import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import type { Doc } from '@/lib/doc';
import { detectSignals, type Signal } from '@/lib/kleo-signals';
import type { EditorPalette } from './theme-picker';

interface KleoMarginProps {
  doc: Doc;
  palette: EditorPalette | null;
  visible: boolean;         // hide when KleoPanel is open or viewport is narrow
  onAskKleo?: (signal: Signal) => void;
}

const DISMISS_KEY = 'sceneflow_kleo_margin_dismissed';

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function KleoMargin({ doc, palette, visible, onAskKleo }: KleoMarginProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadDismissed());

  // Debounce doc changes — don't run detection on every keystroke
  const deferredDoc = useDeferredValue(doc);

  // Detect signals (memoized — scene-hash cached inside detector)
  const signals = useMemo(() => detectSignals(deferredDoc), [deferredDoc]);

  // Find the scroll container once
  useEffect(() => {
    const find = () => {
      const el = document.querySelector<HTMLElement>('.sceneflow-editor-scroll');
      if (el && el !== container) setContainer(el);
    };
    find();
    // In case the editor mounts after us
    const t = setTimeout(find, 200);
    return () => clearTimeout(t);
  }, [container]);

  // Measure scene heading y-positions relative to the scroll container
  useEffect(() => {
    if (!container) return;

    let frame = 0;
    const measure = () => {
      // Map each on-page scene-heading to its offsetTop inside the scroll container
      const headings = container.querySelectorAll<HTMLElement>('.sp-scene-heading');
      const next = new Map<string, number>();
      // Scene headings appear in DOM order. Match by index against signals' scene numbers.
      // But signals reference sceneHeadingBlockId — which corresponds to TipTap node ids.
      // The cleanest join: iterate DOM scenes in order and assign positions by scene index.
      headings.forEach((el, i) => {
        // Compute y inside the scroll container
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const y = elRect.top - containerRect.top + container.scrollTop;
        next.set(`scene:${i + 1}`, y); // keyed by scene number
      });
      setPositions(next);
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();

    // Remeasure on mutations (blocks added/removed/edited) and resize
    const mo = new MutationObserver(scheduleMeasure);
    mo.observe(container, { subtree: true, childList: true, characterData: true });

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(container);

    // Remeasure on scroll (cheap — just recomputes map, doesn't force layout per note)
    container.addEventListener('scroll', scheduleMeasure, { passive: true });

    return () => {
      mo.disconnect();
      ro.disconnect();
      container.removeEventListener('scroll', scheduleMeasure);
      cancelAnimationFrame(frame);
    };
  }, [container, deferredDoc]);

  // Derive page horizontal extent to know where "right of the page" is.
  // The editor-page is centered in the scroll container. We want notes to
  // hug the right edge of the page + a gap.
  const [pageRight, setPageRight] = useState<number | null>(null);
  useEffect(() => {
    if (!container) return;
    const measure = () => {
      const page = container.querySelector<HTMLElement>('.ProseMirror');
      if (!page) return;
      const pageRect = page.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setPageRight(pageRect.right - containerRect.left);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [container]);

  const dismiss = (id: string) => {
    const next = new Set(dismissedIds);
    next.add(id);
    setDismissedIds(next);
    saveDismissed(next);
  };

  if (!visible || !container) return null;

  const c = {
    bg: palette?.headerBg ?? '#17160f',
    surface: 'rgba(30,28,23,0.96)',
    border: palette?.border ?? 'rgba(200,189,160,0.10)',
    ink: palette?.ink ?? '#c8bda0',
    muted: palette?.muted ?? '#7a7060',
    accent: palette?.cursor ?? '#c45c4a',
  };

  return createPortal(
    <div
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      {(() => {
        // Group signals by scene so we can stack multiple notes for the same scene vertically
        const visible = signals.filter(s => !dismissedIds.has(s.id));
        const bySceneNumber = new Map<number, Signal[]>();
        for (const s of visible) {
          const arr = bySceneNumber.get(s.sceneNumber) ?? [];
          arr.push(s);
          bySceneNumber.set(s.sceneNumber, arr);
        }
        const NOTE_HEIGHT_ESTIMATE = 84; // enough to clear a collapsed note
        const cards: React.ReactNode[] = [];
        for (const [sceneNumber, group] of bySceneNumber) {
          const baseY = positions.get(`scene:${sceneNumber}`);
          if (baseY === undefined) continue;
          group.forEach((signal, i) => {
            const left = pageRight !== null ? pageRight + 24 : 'auto';
            const right = pageRight !== null ? 'auto' : 24;
            cards.push(
              <KleoNote
                key={signal.id}
                signal={signal}
                top={baseY + i * NOTE_HEIGHT_ESTIMATE}
                left={left}
                right={right}
                colors={c}
                onDismiss={() => dismiss(signal.id)}
                onAsk={() => onAskKleo?.(signal)}
              />,
            );
          });
        }
        return cards;
      })()}
    </div>,
    container,
  );
}

// ── Individual note card ──

interface KleoNoteProps {
  signal: Signal;
  top: number;
  left: number | string;
  right: number | string;
  colors: { bg: string; surface: string; border: string; ink: string; muted: string; accent: string; };
  onDismiss: () => void;
  onAsk: () => void;
}

function KleoNote({ signal, top, left, right, colors, onDismiss, onAsk }: KleoNoteProps) {
  const [hover, setHover] = useState(false);
  const tierDotColor = signal.tier === 'A' ? colors.accent : colors.muted;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        top: top,
        left: typeof left === 'number' ? `${left}px` : left,
        right: typeof right === 'number' ? `${right}px` : right,
        width: 200,
        maxWidth: 200,
        pointerEvents: 'auto',
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderLeft: `2px solid ${tierDotColor}`,
        borderRadius: '2px 4px 4px 2px',
        padding: '10px 12px 10px 11px',
        fontFamily: 'var(--font-sans)',
        opacity: hover ? 1 : 0.58,
        filter: hover ? 'none' : 'saturate(0.75)',
        transition: 'opacity 160ms ease, filter 160ms ease, box-shadow 160ms ease',
        boxShadow: hover ? '-6px 8px 24px rgba(0,0,0,0.35)' : 'none',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
        marginBottom: 6,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-mono)', fontSize: 8.5,
          color: tierDotColor, letterSpacing: '0.15em', fontWeight: 600,
        }}>
          <span style={{
            width: 11, height: 11, borderRadius: '50%',
            background: `linear-gradient(135deg, ${colors.accent}, #8a3a2a)`,
            display: 'grid', placeItems: 'center',
            fontSize: 7, color: '#fff', fontFamily: 'Georgia, serif', fontWeight: 700,
          }}>K</span>
          {signal.label}
        </div>
        <button
          onClick={onDismiss}
          title="Dismiss"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.muted, fontSize: 14, lineHeight: 1,
            padding: '0 2px', opacity: hover ? 0.8 : 0,
            transition: 'opacity 160ms',
          }}
        >×</button>
      </div>
      <div style={{
        fontSize: 11.5, lineHeight: 1.45, color: colors.ink,
      }}>
        {signal.message}
      </div>
      {hover && (
        <div style={{
          marginTop: 8, paddingTop: 7, borderTop: `1px solid ${colors.border}`,
          display: 'flex', gap: 6,
        }}>
          <button
            onClick={onAsk}
            style={{
              flex: 1,
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.accent,
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '3px 0', textAlign: 'left',
            }}
          >
            Ask Kleo ↗
          </button>
        </div>
      )}
    </div>
  );
}
