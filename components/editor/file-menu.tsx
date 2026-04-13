'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Screenplay } from '@/lib/types';
import { getScreenplay, saveScreenplay, createEmptyScreenplay, uid } from '@/lib/screenplay-store';
import { saveSfx, saveAsSfx, openSfx, hasFileHandle, clearFileHandle } from '@/lib/sfx';

const KLEO_COLOR = '#c45c4a';
const KLEO_HOVER = 'rgba(196, 92, 74, 0.08)';

interface FileMenuProps {
  currentTitle: string;
  palette?: { ink: string; inkFaint: string; muted: string; headerBg: string; border: string; cursor: string; paper: string } | null;
  onLoadScreenplay: (sp: Screenplay) => void;
  onExport: () => void;
  onRename?: (title: string) => void;
  onDuplicate?: () => void;
  getCurrentScreenplay?: () => Screenplay | null;
}

export function FileMenu({ currentTitle, palette, onLoadScreenplay, onExport, onRename, onDuplicate, getCurrentScreenplay }: FileMenuProps) {
  const [open, setOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [projects, setProjects] = useState<Array<{ id: string; title: string; updatedAt: number; wordCount: number }>>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const ink = palette?.ink ?? '#c8bda0';
  const muted = palette?.muted ?? '#7a7060';
  const faint = palette?.inkFaint ?? '#4a4535';
  const bg = palette?.headerBg ?? '#17160f';
  const border = palette?.border ?? 'rgba(200,189,160,0.06)';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false); setBrowseOpen(false); setRenaming(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setBrowseOpen(false); setRenaming(false); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  const loadProjects = useCallback(() => {
    const raw = localStorage.getItem('sceneflow_screenplays');
    if (!raw) { setProjects([]); return; }
    const all: Record<string, Screenplay> = JSON.parse(raw);
    setProjects(Object.values(all).map(sp => ({
      id: sp.sessionId,
      title: sp.title || 'Untitled',
      updatedAt: sp.updatedAt,
      wordCount: sp.scenes.reduce((sum, s) => sum + s.elements.reduce((ws, e) => ws + (e.text.trim() ? e.text.trim().split(/\s+/).length : 0), 0), 0),
    })).sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  const handleNew = () => {
    const id = `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sp = createEmptyScreenplay(id, 'Untitled Screenplay');
    sp.scenes = [{ id: uid(), heading: 'INT. UNTITLED - DAY', elements: [{ id: uid(), type: 'action', text: '' }] }];
    saveScreenplay(sp);
    onLoadScreenplay(sp);
    setOpen(false);
  };

  const handleOpen = (id: string) => {
    const sp = getScreenplay(id);
    if (sp) { onLoadScreenplay(sp); setOpen(false); setBrowseOpen(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    console.log('[Import] file:', file.name, 'size:', text.length, 'chars');
    if (file.name.endsWith('.sfx')) {
      const { unpackSfx } = await import('@/lib/sfx');
      try {
        const sfx = unpackSfx(text);
        saveScreenplay(sfx.screenplay);
        onLoadScreenplay(sfx.screenplay);
        setOpen(false);
      } catch (err) {
        console.error('[SFX Import] invalid file:', err);
      }
    } else if (file.name.endsWith('.fdx')) {
      const { parseFdx } = await import('@/lib/fdx-import');
      const id = `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const sp = parseFdx(text, id);
      saveScreenplay(sp);
      onLoadScreenplay(sp);
      setOpen(false);
    } else if (file.name.endsWith('.fountain')) {
      const { parseFountain } = await import('@/lib/doc/fountain');
      const { docToScreenplay } = await import('@/lib/doc/bridge');
      const doc = parseFountain(text);
      const id = `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const sp = docToScreenplay(doc, id);
      saveScreenplay(sp);
      onLoadScreenplay(sp);
      setOpen(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSave = async () => {
    const sp = getCurrentScreenplay?.();
    if (!sp) return;
    const name = await saveSfx(sp);
    if (name) {
      setSaveStatus(`Saved ${name}`);
      setTimeout(() => setSaveStatus(null), 2000);
    }
    setOpen(false);
  };

  const handleSaveAs = async () => {
    const sp = getCurrentScreenplay?.();
    if (!sp) return;
    clearFileHandle();
    const name = await saveAsSfx(sp);
    if (name) {
      setSaveStatus(`Saved ${name}`);
      setTimeout(() => setSaveStatus(null), 2000);
    }
    setOpen(false);
  };

  const handleOpenSfx = async () => {
    const sfx = await openSfx();
    if (sfx) {
      saveScreenplay(sfx.screenplay);
      onLoadScreenplay(sfx.screenplay);
    }
    setOpen(false);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && onRename) onRename(trimmed);
    setRenaming(false);
    setOpen(false);
  };

  const handleDuplicate = () => {
    if (onDuplicate) onDuplicate();
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'n' && !e.shiftKey) { e.preventDefault(); handleNew(); }
      if (mod && e.key === 's' && !e.shiftKey) { e.preventDefault(); handleSave(); }
      if (mod && e.shiftKey && e.key === 's') { e.preventDefault(); handleSaveAs(); }
      if (mod && e.key === 'o' && !e.shiftKey) { e.preventDefault(); handleOpenSfx(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleSaveAs, handleOpenSfx]); // eslint-disable-line react-hooks/exhaustive-deps

  const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');
  const mod = isMac ? '\u2318' : 'Ctrl+';

  // Menu item component with Kleo hover
  const Item = ({ onClick, icon, label, kbd, disabled }: { onClick: () => void; icon: React.ReactNode; label: string; kbd?: string; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      padding: '7px 14px', fontSize: 11, color: disabled ? faint : ink, letterSpacing: '0.01em',
      background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
      fontFamily: 'var(--font-sans)', transition: 'background 0.15s, color 0.15s',
      opacity: disabled ? 0.4 : 1,
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = KLEO_HOVER; e.currentTarget.style.color = KLEO_COLOR; } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = disabled ? faint : ink; }}
    >
      <span style={{ width: 16, textAlign: 'center', fontSize: 12, opacity: 0.6, flexShrink: 0 }}>{icon}</span>
      <span>{label}</span>
      {kbd && <span style={{ fontSize: 9, color: faint, fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{kbd}</span>}
    </button>
  );

  const Divider = () => <div style={{ height: 1, background: border, margin: '4px 8px' }} />;

  return (
    <div ref={menuRef} className="relative" style={{ lineHeight: 'normal' }}>
      <button
        onClick={() => { if (!open) { setOpen(true); loadProjects(); } else { setOpen(false); setBrowseOpen(false); setRenaming(false); } }}
        className="file-menu-trigger"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: open ? KLEO_HOVER : 'none',
          border: `1px solid ${open ? 'rgba(196,92,74,0.15)' : border}`,
          cursor: 'pointer', padding: '4px 10px',
          color: open ? KLEO_COLOR : ink, fontSize: 11, lineHeight: 1,
          borderRadius: 5, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = KLEO_COLOR; e.currentTarget.style.borderColor = 'rgba(196,92,74,0.15)'; e.currentTarget.style.background = KLEO_HOVER; }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.color = ink; e.currentTarget.style.borderColor = border; e.currentTarget.style.background = 'none'; } }}
        title="File menu"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="1" y="2" width="10" height="1.2" rx="0.6" fill="currentColor" opacity="0.7" />
          <rect x="1" y="5.4" width="7" height="1.2" rx="0.6" fill="currentColor" opacity="0.5" />
          <rect x="1" y="8.8" width="9" height="1.2" rx="0.6" fill="currentColor" opacity="0.4" />
        </svg>
        <span style={{ fontWeight: 500, letterSpacing: '0.03em' }}>File</span>
      </button>

      <input ref={fileInputRef} type="file" accept=".sfx,.fdx,.fountain" onChange={handleImport} style={{ display: 'none' }} />

      {open && (
        <div style={{
          position: 'fixed', top: 44, left: 16, zIndex: 50,
          background: bg, border: `1px solid ${border}`,
          borderRadius: 10, minWidth: browseOpen ? 260 : 220,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden', backdropFilter: 'blur(20px)',
        }}>
          {browseOpen ? (
            <>
              <div style={{
                padding: '8px 14px 4px', fontSize: 8, color: faint, textTransform: 'uppercase', letterSpacing: '0.15em',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>Your Scripts</span>
                <button onClick={() => setBrowseOpen(false)}
                  style={{ background: 'none', border: 'none', color: faint, cursor: 'pointer', fontSize: 10, padding: 0, transition: 'color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = KLEO_COLOR; }}
                  onMouseLeave={e => { e.currentTarget.style.color = faint; }}
                >&larr;</button>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
                {projects.length === 0 && (
                  <div style={{ padding: '20px 14px', fontSize: 11, color: faint, textAlign: 'center' }}>
                    No scripts yet
                  </div>
                )}
                {projects.map(p => (
                  <button key={p.id} onClick={() => handleOpen(p.id)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
                    width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 11, color: ink,
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = KLEO_HOVER; (e.currentTarget.firstChild as HTMLElement).style.color = KLEO_COLOR; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; (e.currentTarget.firstChild as HTMLElement).style.color = ink; }}
                  >
                    <span style={{ fontSize: 11, color: ink, fontWeight: 500, transition: 'color 0.15s' }}>{p.title}</span>
                    <span style={{ fontSize: 9, color: faint }}>
                      {p.wordCount} words &middot; {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : renaming ? (
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 8, color: faint, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Rename</div>
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') { setRenaming(false); setOpen(false); } }}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, color: ink,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}`,
                  borderRadius: 6, outline: 'none', fontFamily: 'var(--font-sans)',
                }}
                placeholder="Screenplay title..."
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setRenaming(false)} style={{
                  fontSize: 10, color: faint, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                }}>Cancel</button>
                <button onClick={handleRenameSubmit} style={{
                  fontSize: 10, color: KLEO_COLOR, background: KLEO_HOVER, border: 'none',
                  cursor: 'pointer', padding: '4px 10px', borderRadius: 4, fontWeight: 600,
                }}>Save</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: '8px 14px 4px', fontSize: 8, color: faint, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                File
              </div>
              <Item onClick={handleNew} icon="+" label="New Screenplay" kbd={`${mod}N`} />
              <Item onClick={handleOpenSfx} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M1 2h4l1.5 1.5H11v7H1V2z"/></svg>} label="Open .sfx..." kbd={`${mod}O`} />
              <Item onClick={() => { setBrowseOpen(true); loadProjects(); }} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.6"><path d="M2 3h3l1 1h4v5H2V3z"/></svg>} label="Browse Recent..." />
              <Divider />
              <Item onClick={handleSave} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1h6.5L11 3.5V10a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1zm1 0v3h5V1H3zm1 6h4v4H4V7z"/></svg>} label={hasFileHandle() ? 'Save' : 'Save .sfx'} kbd={`${mod}S`} disabled={!getCurrentScreenplay} />
              <Item onClick={handleSaveAs} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1h6.5L11 3.5V10a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1zm1 0v3h5V1H3zm1 6h4v4H4V7z" opacity="0.6"/><path d="M8 8l2.5 2.5M10.5 8L8 10.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>} label="Save As..." kbd={`${mod}⇧S`} disabled={!getCurrentScreenplay} />
              <Divider />
              <Item onClick={() => { setRenaming(true); setRenameValue(currentTitle); }} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z"/></svg>} label="Rename..." />
              <Item onClick={handleDuplicate} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="2" width="8" height="8" rx="1" opacity="0.4"/><rect x="2" y="0" width="8" height="8" rx="1"/></svg>} label="Duplicate" disabled={!onDuplicate} />
              <Divider />
              <Item onClick={() => fileInputRef.current?.click()} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v6M3 5l3 3 3-3"/><path d="M2 10h8"/></svg>} label="Import FDX / Fountain" />
              <Item onClick={() => { onExport(); setOpen(false); }} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 8V2"/><path d="M3 4l3-3 3 3"/><path d="M2 10h8"/></svg>} label="Export PDF" />
              <div style={{ height: 4 }} />
            </>
          )}
        </div>
      )}

      {/* Save status toast */}
      {saveStatus && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1914', border: `1px solid rgba(196,92,74,0.2)`,
          borderRadius: 8, padding: '8px 16px', fontSize: 11, color: KLEO_COLOR,
          fontWeight: 500, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          {saveStatus}
        </div>
      )}
    </div>
  );
}
