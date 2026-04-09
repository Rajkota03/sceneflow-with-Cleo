'use client';
import { useState, useEffect, useRef } from 'react';
import type { Screenplay } from '@/lib/types';
import { getSnapshots, saveSnapshot, restoreSnapshot, deleteSnapshot } from '@/lib/screenplay-store';
import type { DraftSnapshot } from '@/lib/screenplay-store';

interface DraftSnapshotsProps {
  screenplay: Screenplay;
  palette?: { ink: string; inkFaint: string; muted?: string; cursor?: string; headerBg?: string; border?: string } | null;
  onRestore: (sp: Screenplay) => void;
}

export function DraftSnapshots({ screenplay, palette, onRestore }: DraftSnapshotsProps) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<DraftSnapshot[]>([]);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ink = palette?.ink ?? '#c8bda0';
  const faint = palette?.inkFaint ?? '#4a4535';
  const muted = palette?.muted ?? '#7a7060';
  const accent = palette?.cursor ?? '#c45c4a';
  const bg = palette?.headerBg ?? '#17160f';
  const border = palette?.border ?? 'rgba(200,189,160,0.06)';

  useEffect(() => {
    if (open) setSnapshots(getSnapshots(screenplay.sessionId));
  }, [open, screenplay.sessionId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowSaveInput(false);
        setConfirmRestore(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (showSaveInput) inputRef.current?.focus();
  }, [showSaveInput]);

  const handleSave = () => {
    const label = labelInput.trim() || `Draft ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    saveSnapshot(screenplay.sessionId, label, screenplay);
    setSnapshots(getSnapshots(screenplay.sessionId));
    setLabelInput('');
    setShowSaveInput(false);
  };

  const handleRestore = (snap: DraftSnapshot) => {
    if (confirmRestore === snap.id) {
      const sp = restoreSnapshot(snap);
      onRestore(sp);
      setConfirmRestore(null);
      setOpen(false);
    } else {
      setConfirmRestore(snap.id);
      setTimeout(() => setConfirmRestore(null), 3000);
    }
  };

  const handleDelete = (e: React.MouseEvent, snapId: string) => {
    e.stopPropagation();
    deleteSnapshot(screenplay.sessionId, snapId);
    setSnapshots(getSnapshots(screenplay.sessionId));
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div ref={panelRef} className="relative" style={{ lineHeight: 'normal' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 9, color: muted, letterSpacing: '0.08em',
          textTransform: 'uppercase', padding: '2px 6px',
          opacity: open ? 1 : 0.6, transition: 'opacity 0.2s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = accent; e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.color = muted; e.currentTarget.style.opacity = open ? '1' : '0.6'; }}
        title="Draft snapshots"
      >
        drafts
      </button>

      {open && (
        <div style={{
          position: 'fixed', top: 44, right: 80, zIndex: 50,
          background: bg, border: `1px solid ${border}`,
          borderRadius: 10, width: 260,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden', backdropFilter: 'blur(20px)',
        }}>
          <div style={{
            padding: '10px 14px 6px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 8, color: faint, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Snapshots
            </span>
            <button
              onClick={() => setShowSaveInput(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 10, color: accent, padding: '2px 6px',
                fontWeight: 600, transition: 'opacity 0.15s',
              }}
            >
              + Save
            </button>
          </div>

          {showSaveInput && (
            <div style={{ padding: '4px 14px 8px', display: 'flex', gap: 6 }}>
              <input
                ref={inputRef}
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveInput(false); }}
                placeholder="Label (optional)"
                style={{
                  flex: 1, padding: '4px 8px', fontSize: 11, color: ink,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}`,
                  borderRadius: 4, outline: 'none', fontFamily: 'var(--font-sans)',
                }}
              />
              <button
                onClick={handleSave}
                style={{
                  fontSize: 10, color: accent, background: 'rgba(196,92,74,0.08)',
                  border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                Save
              </button>
            </div>
          )}

          <div style={{ maxHeight: 300, overflowY: 'auto', padding: '2px 0 6px' }}>
            {snapshots.length === 0 && (
              <div style={{ padding: '20px 14px', fontSize: 11, color: faint, textAlign: 'center' }}>
                No snapshots yet
              </div>
            )}
            {snapshots.map(snap => (
              <div
                key={snap.id}
                onClick={() => handleRestore(snap)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 14px', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,92,74,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{
                    fontSize: 11, color: confirmRestore === snap.id ? accent : ink,
                    fontWeight: confirmRestore === snap.id ? 600 : 400,
                  }}>
                    {confirmRestore === snap.id ? 'Click again to restore' : snap.label}
                  </span>
                  <span style={{ fontSize: 9, color: faint }}>
                    {formatDate(snap.createdAt)} &middot; {snap.screenplay.scenes.length} scenes
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, snap.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: faint, padding: '2px 4px',
                    opacity: 0.4, transition: 'opacity 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = accent; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = faint; }}
                  title="Delete snapshot"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
