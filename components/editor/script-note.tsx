'use client';
import { useState, useRef, useEffect } from 'react';

interface ScriptNoteIconProps {
  note: string;
  color: string;
  onChange: (note: string) => void;
}

export function ScriptNoteIcon({ note, color, onChange }: ScriptNoteIconProps) {
  const isNew = note.trim() === '';
  const [open, setOpen] = useState(isNew);
  const [editing, setEditing] = useState(isNew);
  const [draft, setDraft] = useState(isNew ? '' : note);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => { setDraft(note); }, [note]);

  return (
    <div ref={ref} className="absolute" style={{ right: '-32px', top: '2px', zIndex: 5 }}>
      <button
        onClick={() => setOpen(!open)}
        className="cursor-pointer"
        style={{ fontSize: '12px', color, background: 'none', border: 'none', padding: 0, opacity: 0.7 }}
        title="Script note"
      >
        ✎
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4,
            width: 240, padding: '8px 10px',
            background: 'var(--color-surface-2, #1a1a1a)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {editing ? (
            <div>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={3}
                autoFocus
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  color: 'var(--color-text)', fontSize: 12, resize: 'none',
                  outline: 'none', fontFamily: 'var(--font-sans)',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button
                  onClick={() => { onChange(draft); setEditing(false); setOpen(false); }}
                  style={{
                    fontSize: 10, color, background: `${color}15`,
                    border: 'none', borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => { onChange(''); setEditing(false); setOpen(false); }}
                  style={{
                    fontSize: 10, color: '#cc5f5f', background: 'rgba(204,95,95,0.1)',
                    border: 'none', borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditing(true)}
              style={{
                fontSize: 12, color: 'var(--color-text)', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', lineHeight: 1.5,
              }}
            >
              {note}
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 4 }}>
                Click to edit
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
