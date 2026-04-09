'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

export interface EditorPalette {
  paper: string;
  ink: string;
  inkFaint: string;
  desk: string;
  pageShadow: string;
  pageBreak: string;
  cursor: string;
  headerBg: string;
  border: string;
  muted: string;
}

export type ToneMode = 'dark' | 'dim' | 'light';

/** Generate a full editor palette from hue (0-360) and tone mode */
export function paletteFromHue(hue: number, tone: ToneMode = 'dark'): EditorPalette {
  const h = Math.round(hue) % 360;
  const ah = (h + 160) % 360;

  if (tone === 'light') {
    return {
      paper:      `hsl(${h}, 15%, 96%)`,
      ink:        `hsl(${h}, 20%, 15%)`,
      inkFaint:   `hsl(${h}, 10%, 65%)`,
      desk:       `hsl(${h}, 12%, 90%)`,
      pageShadow: `hsla(${h}, 10%, 30%, 0.08)`,
      pageBreak:  `hsla(${h}, 12%, 30%, 0.08)`,
      cursor:     `hsl(${ah}, 55%, 45%)`,
      headerBg:   `hsl(${h}, 12%, 94%)`,
      border:     `hsla(${h}, 10%, 30%, 0.1)`,
      muted:      `hsl(${h}, 8%, 55%)`,
    };
  }

  if (tone === 'dim') {
    return {
      paper:      `hsl(${h}, 8%, 18%)`,
      ink:        `hsl(${h}, 16%, 76%)`,
      inkFaint:   `hsl(${h}, 8%, 38%)`,
      desk:       `hsl(${h}, 8%, 14%)`,
      pageShadow: `hsla(${h}, 10%, 8%, 0.2)`,
      pageBreak:  `hsla(${h}, 12%, 60%, 0.08)`,
      cursor:     `hsl(${ah}, 50%, 55%)`,
      headerBg:   `hsl(${h}, 8%, 16%)`,
      border:     `hsla(${h}, 12%, 60%, 0.08)`,
      muted:      `hsl(${h}, 6%, 42%)`,
    };
  }

  // dark (default)
  return {
    paper:      `hsl(${h}, 14%, 8%)`,
    ink:        `hsl(${h}, 22%, 72%)`,
    inkFaint:   `hsl(${h}, 12%, 25%)`,
    desk:       `hsl(${h}, 12%, 6%)`,
    pageShadow: `hsla(${h}, 15%, 4%, 0.25)`,
    pageBreak:  `hsla(${h}, 18%, 72%, 0.06)`,
    cursor:     `hsl(${ah}, 52%, 53%)`,
    headerBg:   `hsl(${h}, 14%, 7%)`,
    border:     `hsla(${h}, 18%, 72%, 0.06)`,
    muted:      `hsl(${h}, 10%, 30%)`,
  };
}

const WHEEL_SIZE = 120;
const RING_WIDTH = 14;

interface ThemePickerProps {
  hue: number;
  tone: ToneMode;
  onChange: (hue: number, tone: ToneMode) => void;
  onReset: () => void;
}

export function ThemePicker({ hue, tone, onChange, onReset }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open) return;
    const ctx = canvas.getContext('2d')!;
    const size = WHEEL_SIZE;
    const center = size / 2;
    const outerR = center - 2;
    const innerR = outerR - RING_WIDTH;

    ctx.clearRect(0, 0, size, size);

    for (let angle = 0; angle < 360; angle++) {
      const startRad = (angle - 1) * Math.PI / 180;
      const endRad = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(center, center, outerR, startRad, endRad);
      ctx.arc(center, center, innerR, endRad, startRad, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 60%, 50%)`;
      ctx.fill();
    }

    const rad = (hue - 90) * Math.PI / 180;
    const dotR = (outerR + innerR) / 2;
    const dx = center + dotR * Math.cos(rad);
    const dy = center + dotR * Math.sin(rad);
    ctx.beginPath();
    ctx.arc(dx, dy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [hue, open]);

  const hueFromEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - WHEEL_SIZE / 2;
    const y = e.clientY - rect.top - WHEEL_SIZE / 2;
    let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;
    onChange(Math.round(angle) % 360, tone);
  }, [onChange, tone]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - WHEEL_SIZE / 2;
    const y = e.clientY - rect.top - WHEEL_SIZE / 2;
    const dist = Math.sqrt(x * x + y * y);
    const outerR = WHEEL_SIZE / 2 - 2;
    const innerR = outerR - RING_WIDTH;
    if (dist >= innerR - 4 && dist <= outerR + 4) {
      setDragging(true);
      hueFromEvent(e);
    }
  }, [hueFromEvent]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => hueFromEvent(e);
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, hueFromEvent]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const palette = paletteFromHue(hue, tone);
  const tones: { key: ToneMode; label: string; bg: string; fg: string }[] = [
    { key: 'dark', label: 'Dark', bg: `hsl(${hue}, 14%, 8%)`, fg: `hsl(${hue}, 22%, 72%)` },
    { key: 'dim', label: 'Dim', bg: `hsl(${hue}, 8%, 18%)`, fg: `hsl(${hue}, 16%, 76%)` },
    { key: 'light', label: 'Light', bg: `hsl(${hue}, 15%, 96%)`, fg: `hsl(${hue}, 20%, 15%)` },
  ];

  return (
    <div ref={containerRef} className="relative" style={{ lineHeight: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        className="cursor-pointer transition-opacity hover:opacity-100"
        style={{
          width: 10, height: 10, borderRadius: '50%',
          background: palette.cursor, border: 'none', padding: 0,
          opacity: open ? 1 : 0.5,
        }}
        title="Editor palette"
      />

      {open && (
        <div
          className="absolute z-50"
          style={{
            top: 24, right: 0,
            background: palette.headerBg,
            border: `1px solid ${palette.border}`,
            borderRadius: 8,
            padding: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            minWidth: WHEEL_SIZE + 32,
          }}
        >
          <canvas
            ref={canvasRef}
            width={WHEEL_SIZE}
            height={WHEEL_SIZE}
            onMouseDown={handleMouseDown}
            style={{ cursor: 'crosshair', display: 'block', margin: '0 auto' }}
          />

          {/* Tone selector: dark / dim / light */}
          <div className="flex gap-2 mt-3 justify-center">
            {tones.map(t => (
              <button
                key={t.key}
                onClick={() => onChange(hue, t.key)}
                className="cursor-pointer transition-all"
                style={{
                  width: 28, height: 20, borderRadius: 4,
                  background: t.bg, border: tone === t.key ? `2px solid ${palette.cursor}` : '1px solid rgba(128,128,128,0.2)',
                  padding: 0,
                }}
                title={t.label}
              >
                <span style={{ fontSize: 7, color: t.fg, fontWeight: 600, letterSpacing: '0.05em' }}>
                  {t.label[0]}
                </span>
              </button>
            ))}
          </div>

          {/* Preview swatches */}
          <div className="flex gap-2 mt-2 justify-center">
            <div style={{ width: 14, height: 14, borderRadius: 3, background: palette.paper, border: '1px solid rgba(128,128,128,0.15)' }} title="Paper" />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: palette.ink }} title="Ink" />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: palette.inkFaint }} title="Faint" />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: palette.cursor }} title="Accent" />
          </div>

          {/* Reset to default */}
          <button
            onClick={() => { onReset(); setOpen(false); }}
            className="cursor-pointer transition-opacity hover:opacity-100"
            style={{
              display: 'block', width: '100%', marginTop: 8,
              fontSize: 8, color: palette.muted, background: 'none',
              border: 'none', padding: '4px 0', letterSpacing: '0.1em',
              textTransform: 'uppercase', opacity: 0.6, textAlign: 'center',
            }}
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
