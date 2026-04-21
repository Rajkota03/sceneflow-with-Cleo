'use client';
import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ModuleNav } from '@/components/module-nav';
import { SceneSidebarV2 as SceneSidebar } from '@/components/editor/scene-sidebar-v2';
import { WritingArea } from '@/components/editor/writing-area-tiptap';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import type { ScriptView, PanelView, ViewMode, EditorTheme } from '@/components/editor/editor-toolbar';
import type { Screenplay, ScreenplayScene, ScreenplayElementType } from '@/lib/types';
import { getScreenplay, saveScreenplay, createEmptyScreenplay, uid } from '@/lib/screenplay-store';
import type { Doc, BlockType } from '@/lib/doc';
import { screenplayToDoc, docToScreenplay, createBlock, createDoc, docToPdf, deriveScenes, computeStats } from '@/lib/doc';
import { autoSave as autoSaveDoc } from '@/lib/doc';
import { getSession, getSessions } from '@/lib/session-store';
import { BeatSheet } from '@/components/editor/beat-sheet';
import { ScriptStats } from '@/components/editor/script-stats';
import { CharacterReport } from '@/components/editor/character-report';
import { SceneCards } from '@/components/editor/scene-cards';
import { TitlePageEditor } from '@/components/editor/title-page';
import { StatusBar } from '@/components/editor/status-bar';
import { ThemePicker, paletteFromHue } from '@/components/editor/theme-picker';
import { FileMenu } from '@/components/editor/file-menu';
import type { EditorPalette, ToneMode } from '@/components/editor/theme-picker';
import { GoToPageDialog } from '@/components/editor/go-to-page';
import { ExportDialog } from '@/components/editor/export-dialog';
import type { ExportOptions } from '@/components/editor/export-dialog';
import { DraftSnapshots } from '@/components/editor/draft-snapshots';
import { CharacterFilter } from '@/components/editor/character-filter';
import { KleoOnboarding } from '@/components/editor/kleo-onboarding';
import { KleoRecap } from '@/components/editor/kleo-recap';
import { KleoPanel } from '@/components/editor/kleo-panel';
import type { ScreenplayBlock } from '@/components/editor/kleo-panel';
import {
  getKleoMemory, saveKleoTaste, saveKleoStyle, isKleoOnboarded, saveKleoIdentity,
  startKleoSession, endKleoSession, addKleoMessage, analyzeWritingStyle,
  incrementStuckCount,
} from '@/lib/kleo-store';
import type { KleoMessage, KleoTasteProfile, KleoWritingStyle, KleoSessionSnapshot, KleoIdentity } from '@/lib/kleo-store';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col">
        <ModuleNav />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-text-3">Loading editor...</p>
        </div>
      </div>
    }>
      <EditorInner />
    </Suspense>
  );
}

function EditorInner() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const isMobile = useIsMobile();

  const [screenplay, setScreenplay] = useState<Screenplay | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<string[]>([]);
  const [subtitle, setSubtitle] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Editor state
  const [scriptView, setScriptView] = useState<ScriptView>('page');
  const [panelView, setPanelView] = useState<PanelView>('none');
  const [theme, setTheme] = useState<EditorTheme>('parchment');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorHue, setEditorHue] = useState<number | null>(null); // null = default parchment
  const [editorTone, setEditorTone] = useState<ToneMode>('dark');
  const palette: EditorPalette | null = editorHue !== null ? paletteFromHue(editorHue, editorTone) : null;

  // Map ScriptView to ViewMode for WritingArea
  const viewMode: ViewMode = scriptView === 'focus' ? 'focus' : scriptView === 'speed' ? 'read' : 'write';

  // Sprint timer
  const [sprintMinutes, setSprintMinutes] = useState<number | null>(null);
  const [sprintSecondsLeft, setSprintSecondsLeft] = useState<number | null>(null);
  const sprintRef = useRef<ReturnType<typeof setInterval>>(null);

  // Save state
  const [isSaved, setIsSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Typewriter mode
  const [typewriterMode, setTypewriterMode] = useState(false);

  // Go To Page dialog
  const [showGoToPage, setShowGoToPage] = useState(false);

  // Export PDF dialog
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Character filter panel
  const [showCharFilter, setShowCharFilter] = useState(false);

  // Kleo state
  const [kleoOnboarded, setKleoOnboarded] = useState(true); // assume true until checked
  const [showKleoOnboarding, setShowKleoOnboarding] = useState(false);
  const [showKleoPanel, setShowKleoPanel] = useState(false);
  const [kleoRecapMessage, setKleoRecapMessage] = useState<string | null>(null);
  const [kleoTaste, setKleoTaste] = useState<KleoTasteProfile | null>(null);
  const [kleoStyle, setKleoStyle] = useState<KleoWritingStyle | null>(null);
  const [kleoConversations, setKleoConversations] = useState<KleoMessage[]>([]);
  const [kleoSelectedText, setKleoSelectedText] = useState('');
  const [kleoIdentity, setKleoIdentity] = useState<KleoIdentity>({ voice: 'buddy', grain: 30 });
  const tiptapEditorRef = useRef<any>(null);

  // Load screenplay on mount
  useEffect(() => {
    let sessionId = projectId;
    if (!sessionId) {
      const sessions = getSessions();
      if (sessions.length > 0) sessionId = sessions[0].id;
    }

    // Check for last active screenplay (survives refresh)
    if (!sessionId) {
      const lastActive = typeof window !== 'undefined' ? localStorage.getItem('sceneflow_active_screenplay') : null;
      if (lastActive && getScreenplay(lastActive)) sessionId = lastActive;
    }

    if (!sessionId) {
      sessionId = 'standalone';
      let sp = getScreenplay('standalone');
      if (!sp) {
        sp = createEmptyScreenplay('standalone', 'Untitled Screenplay');
        saveScreenplay(sp);
      }
      setScreenplay(sp);
      const d = screenplayToDoc(sp);
      setDoc(d);
      if (d.blocks.length > 0) {
        const scenes = deriveScenes(d.blocks);
        if (scenes.length > 0) setActiveSceneId(scenes[0].headingBlockId);
      }
      return;
    }

    const session = getSession(sessionId);
    if (session) {
      setCharacters(session.characters.map(c => c.name));
      setSubtitle(session.logline);
    }

    let sp = getScreenplay(sessionId);
    if (!sp) {
      sp = createEmptyScreenplay(sessionId, session?.logline ?? 'Untitled Screenplay');
      saveScreenplay(sp);
    }
    setScreenplay(sp);
    const d = screenplayToDoc(sp);
    setDoc(d);

    if (d.blocks.length > 0) {
      const scenes = deriveScenes(d.blocks);
      if (scenes.length > 0) setActiveSceneId(scenes[0].headingBlockId);
    }
  }, [projectId]);

  // First-time welcome — show once if editor is empty
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem('sceneflow_welcome_seen');
    if (seen) return;
    // Only show if screenplay is effectively empty (0-1 scenes with no real content)
    if (screenplay && screenplay.scenes.length <= 1) {
      const totalText = screenplay.scenes.reduce((acc, s) =>
        acc + s.elements.reduce((a, e) => a + e.text.trim().length, 0), 0);
      if (totalText < 20) setShowWelcome(true);
    }
  }, [screenplay]);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem('sceneflow_welcome_seen', '1');
  }, []);

  // Dismiss welcome on first keypress
  useEffect(() => {
    if (!showWelcome) return;
    const handler = () => dismissWelcome();
    window.addEventListener('keydown', handler, { once: true });
    return () => window.removeEventListener('keydown', handler);
  }, [showWelcome, dismissWelcome]);

  // Auto-save with debounce
  const persistScreenplay = useCallback((sp: Screenplay) => {
    setIsSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveScreenplay(sp);
      setIsSaved(true);
    }, 800);
  }, []);

  const updateScreenplay = useCallback((updater: (prev: Screenplay) => Screenplay) => {
    setScreenplay(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      persistScreenplay(next);
      return next;
    });
  }, [persistScreenplay]);

  // Doc change handler — syncs back to Screenplay for persistence & other panels
  const handleDocChange = useCallback((newDoc: Doc) => {
    setDoc(newDoc);
    const sp = docToScreenplay(newDoc, screenplay?.sessionId);
    if (sp) {
      sp.createdAt = screenplay?.createdAt ?? Date.now();
      sp.updatedAt = Date.now();
      sp.titlePage = screenplay?.titlePage;
      setScreenplay(sp);
      persistScreenplay(sp);
    }
  }, [screenplay?.sessionId, screenplay?.createdAt, screenplay?.titlePage, persistScreenplay]);

  // Character rename — updates character cues and action line mentions in one pass
  const handleRenameCharacter = useCallback((oldName: string, newName: string) => {
    if (!doc) return;
    const oldUpper = oldName.toUpperCase();
    const newUpper = newName.toUpperCase();
    if (oldUpper === newUpper) return;

    // Word-boundary regex for action line replacements (case-insensitive)
    const actionRegex = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');

    const updatedBlocks = doc.blocks.map(block => {
      if (block.type === 'character') {
        // Character cue: "JOHN" or "JOHN (V.O.)" — replace the name part, keep extension
        const trimmed = block.text.trim();
        const extMatch = trimmed.match(/^(.+?)(\s*\([^)]+\)\s*)$/);
        if (extMatch) {
          const namePart = extMatch[1].trim().toUpperCase();
          const ext = extMatch[2];
          if (namePart === oldUpper) {
            return { ...block, text: newUpper + ext };
          }
        } else {
          if (trimmed.toUpperCase() === oldUpper) {
            return { ...block, text: newUpper };
          }
        }
      } else if (block.type === 'action') {
        // Action lines: case-insensitive word-boundary replace
        const replaced = block.text.replace(actionRegex, (match) => {
          // Preserve the casing pattern: if original was all-caps, use all-caps new name
          if (match === match.toUpperCase()) return newUpper;
          // Title case
          if (match[0] === match[0].toUpperCase()) {
            return newName.charAt(0).toUpperCase() + newName.slice(1).toLowerCase();
          }
          return newName.toLowerCase();
        });
        if (replaced !== block.text) {
          return { ...block, text: replaced };
        }
      }
      // dialogue and parenthetical: untouched
      return block;
    });

    const newDoc: Doc = {
      ...doc,
      blocks: updatedBlocks,
      version: doc.version + 1,
    };
    handleDocChange(newDoc);
  }, [doc, handleDocChange]);

  // Scene operations
  const handleAddScene = useCallback(() => {
    if (!doc) return;
    const heading = createBlock('scene-heading', '');
    const action = createBlock('action', '');
    const newDoc: Doc = {
      ...doc,
      blocks: [...doc.blocks, heading, action],
      version: doc.version + 1,
    };
    handleDocChange(newDoc);
    setActiveSceneId(heading.id);
  }, [doc, handleDocChange]);

  const handleDeleteScene = useCallback((sceneId: string) => {
    updateScreenplay(sp => {
      const scenes = sp.scenes.filter(s => s.id !== sceneId);
      return { ...sp, scenes };
    });
    setActiveSceneId(prev => {
      if (prev === sceneId && screenplay) {
        const remaining = screenplay.scenes.filter(s => s.id !== sceneId);
        return remaining.length > 0 ? remaining[0].id : null;
      }
      return prev;
    });
  }, [updateScreenplay, screenplay]);

  const handleScenesChange = useCallback((scenes: ScreenplayScene[]) => {
    updateScreenplay(sp => ({ ...sp, scenes }));
  }, [updateScreenplay]);

  const handleSceneColorChange = useCallback((sceneId: string, color: string | undefined) => {
    updateScreenplay(sp => ({
      ...sp,
      scenes: sp.scenes.map(s => s.id === sceneId ? { ...s, color } : s),
    }));
  }, [updateScreenplay]);

  const handleSelectScene = useCallback((id: string) => {
    setActiveSceneId(id);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Sprint timer logic
  const handleStartSprint = useCallback((minutes: number) => {
    setSprintMinutes(minutes);
    setSprintSecondsLeft(minutes * 60);
    if (sprintRef.current) clearInterval(sprintRef.current);
    sprintRef.current = setInterval(() => {
      setSprintSecondsLeft(prev => {
        if (prev === null || prev <= 1) {
          if (sprintRef.current) clearInterval(sprintRef.current);
          setSprintMinutes(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleStopSprint = useCallback(() => {
    if (sprintRef.current) clearInterval(sprintRef.current);
    setSprintMinutes(null);
    setSprintSecondsLeft(null);
  }, []);

  // Cleanup sprint on unmount
  useEffect(() => {
    return () => {
      if (sprintRef.current) clearInterval(sprintRef.current);
    };
  }, []);

  // Fullscreen toggle
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen exit via Escape
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      if (e.key === 'g' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowGoToPage(prev => !prev);
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenKleo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Escape exits Zen mode
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  // Kleo initialization — check onboarding, start session, fetch recap
  useEffect(() => {
    if (!screenplay) return;
    const mem = getKleoMemory();
    const onboarded = isKleoOnboarded();
    setKleoOnboarded(onboarded);
    setKleoTaste(mem.taste);
    setKleoStyle(mem.style);
    setKleoConversations(mem.conversations);
    if (mem.identity) setKleoIdentity(mem.identity);

    if (!onboarded) {
      setShowKleoOnboarding(true);
      return;
    }

    // Analyze writing style
    if (screenplay.scenes.length > 0) {
      const style = analyzeWritingStyle(screenplay.scenes);
      saveKleoStyle(style);
      setKleoStyle(style);
    }

    // Start session tracking
    const allText = screenplay.scenes.map(s =>
      s.heading + ' ' + s.elements.map(e => e.text).join(' ')
    ).join(' ');
    const wc = allText.trim() ? allText.trim().split(/\s+/).length : 0;
    startKleoSession(wc);

    // Fetch recap if there's a previous session
    if (mem.taste && mem.sessions.length > 0) {
      const lastSession = mem.sessions[0];
      const hoursSince = (Date.now() - lastSession.timestamp) / (1000 * 60 * 60);
      // Only show recap if > 1 hour since last session
      if (hoursSince > 1) {
        fetchRecap(mem.taste, lastSession, mem.style, screenplay.scenes);
      }
    }
  }, [screenplay?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecap = async (taste: KleoTasteProfile, lastSession: KleoSessionSnapshot, style: KleoWritingStyle | null, scenes: ScreenplayScene[]) => {
    try {
      const res = await fetch('/api/kleo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recap', taste, lastSession, style, scenes }),
      });
      const data = await res.json();
      setKleoRecapMessage(data.message);
    } catch {
      // Silent fail — recap is optional
    }
  };

  const handleKleoOnboardingComplete = useCallback((taste: KleoTasteProfile) => {
    saveKleoTaste(taste);
    setKleoTaste(taste);
    setKleoOnboarded(true);
    setShowKleoOnboarding(false);

    // Analyze style now
    if (screenplay && screenplay.scenes.length > 0) {
      const style = analyzeWritingStyle(screenplay.scenes);
      saveKleoStyle(style);
      setKleoStyle(style);
    }

    // Start session
    const allText = screenplay?.scenes.map(s =>
      s.heading + ' ' + s.elements.map(e => e.text).join(' ')
    ).join(' ') ?? '';
    const wc = allText.trim() ? allText.trim().split(/\s+/).length : 0;
    startKleoSession(wc);
  }, [screenplay]);

  const handleKleoMessage = useCallback((msg: KleoMessage) => {
    addKleoMessage(msg);
    setKleoConversations(prev => [...prev, msg].slice(-20));
  }, []);

  const handleOpenKleo = useCallback(() => {
    if (!kleoOnboarded) {
      setShowKleoOnboarding(true);
      return;
    }
    incrementStuckCount();
    setShowKleoPanel(true);
  }, [kleoOnboarded]);

  // Kleo → Editor: convert ScreenplayBlock[] to TipTap JSON nodes
  const kleoBlocksToTiptapContent = useCallback((blocks: ScreenplayBlock[]) => {
    const nodeMap: Record<string, string> = {
      'scene-heading': 'sceneHeading', action: 'action', character: 'characterCue',
      parenthetical: 'parenthetical', dialogue: 'dialogue', transition: 'transition',
    };
    return blocks.map(b => {
      let text = b.text;
      if (b.type === 'parenthetical') {
        text = text.replace(/^\(/, '').replace(/\)$/, '');
      }
      return {
        type: nodeMap[b.type] || 'action',
        attrs: { id: uid() },
        content: text ? [{ type: 'text', text }] : [],
      };
    });
  }, []);

  const handleKleoInsertBlocks = useCallback((blocks: ScreenplayBlock[]) => {
    const editor = tiptapEditorRef.current;
    if (!editor) return;
    const content = kleoBlocksToTiptapContent(blocks);
    editor.chain().focus().insertContent(content).run();
  }, [kleoBlocksToTiptapContent]);

  const handleKleoReplaceSelection = useCallback((blocks: ScreenplayBlock[]) => {
    const editor = tiptapEditorRef.current;
    if (!editor) return;
    const content = kleoBlocksToTiptapContent(blocks);
    const { from, to } = editor.state.selection;
    editor.chain().focus().deleteRange({ from, to }).insertContent(content).run();
  }, [kleoBlocksToTiptapContent]);

  const handleSelectionTextChange = useCallback((text: string) => {
    setKleoSelectedText(text);
  }, []);

  const handleEditorRef = useCallback((editor: any) => {
    tiptapEditorRef.current = editor;
  }, []);

  // Save session snapshot on unmount
  useEffect(() => {
    return () => {
      if (!screenplay) return;
      const mem = getKleoMemory();
      if (!mem.currentSessionStart) return;
      const allText = screenplay.scenes.map(s =>
        s.heading + ' ' + s.elements.map(e => e.text).join(' ')
      ).join(' ');
      const wc = allText.trim() ? allText.trim().split(/\s+/).length : 0;
      const activeScene = screenplay.scenes.find(s => s.id === activeSceneId);
      const lastEl = activeScene?.elements.filter(e => e.text.trim()).pop();

      const snapshot: KleoSessionSnapshot = {
        timestamp: Date.now(),
        sceneCount: screenplay.scenes.length,
        wordCount: wc,
        lastActiveSceneHeading: activeScene?.heading || 'Unknown',
        lastActiveSceneId: activeSceneId || '',
        lastElementText: lastEl?.text || '',
        lastElementType: lastEl?.type || 'action',
        scenesEdited: screenplay.scenes.filter(s => s.elements.some(e => e.text.trim())).map(s => s.heading).slice(0, 5),
        wordsWritten: Math.max(0, wc - mem.currentSessionWordStart),
        durationMinutes: Math.round((Date.now() - mem.currentSessionStart) / 60000),
      };
      endKleoSession(snapshot);
    };
  }, [screenplay, activeSceneId]);

  // Focused element tracking (for toolbar element type display + changes)
  const [focusedElementInfo, setFocusedElementInfo] = useState<{
    type: BlockType; blockId: string;
  } | null>(null);

  const handleFormatCommand = useCallback((command: 'bold' | 'italic' | 'underline') => {
    document.execCommand(command);
  }, []);

  // Word, page count & stats from layout engine (industry-standard line-based estimation)
  const docStats = useMemo(() => doc ? computeStats(doc.blocks) : null, [doc]);
  const wordCount = docStats?.wordCount ?? 0;
  const pageCount = docStats?.pageCount ?? 1;
  const allText = screenplay?.scenes.map(s =>
    s.heading + ' ' + s.elements.map(e => e.text).join(' ')
  ).join(' ') ?? '';

  // Extract characters from screenplay if none from session
  const scriptCharacters = (() => {
    if (characters.length > 0) return characters;
    if (!screenplay) return [];
    const names = new Set<string>();
    for (const scene of screenplay.scenes) {
      for (const el of scene.elements) {
        if (el.type === 'character' && el.text.trim()) {
          names.add(el.text.trim().replace(/\s*\(.*\)$/, '').toUpperCase());
        }
      }
    }
    return Array.from(names);
  })();

  // Current element type from focused element
  const currentElementType = focusedElementInfo?.type ?? null;

  // Current scene number and line number for status bar
  const currentSceneNumber = (() => {
    if (!focusedElementInfo || !doc) return 1;
    const scenes = deriveScenes(doc.blocks);
    const blockIdx = doc.blocks.findIndex(b => b.id === focusedElementInfo.blockId);
    for (let i = 0; i < scenes.length; i++) {
      if (blockIdx >= scenes[i].startIndex && blockIdx <= scenes[i].endIndex) return i + 1;
    }
    return 1;
  })();

  const currentLineNumber = (() => {
    if (!focusedElementInfo || !doc) return 1;
    const idx = doc.blocks.findIndex(b => b.id === focusedElementInfo.blockId);
    return idx >= 0 ? idx + 1 : 1;
  })();

  const charCount = allText.length;

  // Go to page handler — scroll to the Nth page element
  const handleGoToPage = useCallback((page: number) => {
    const pageEls = document.querySelectorAll('[data-page-number]');
    for (const el of pageEls) {
      if (el.getAttribute('data-page-number') === String(page)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    // Fallback: scroll to estimated position
    const scrollContainer = document.querySelector('[data-scroll-container]');
    if (scrollContainer) {
      const ratio = (page - 1) / Math.max(1, pageCount - 1);
      scrollContainer.scrollTo({ top: ratio * scrollContainer.scrollHeight, behavior: 'smooth' });
    }
  }, [pageCount]);

  // Load a screenplay (from file menu: new, open, import)
  const handleLoadScreenplay = useCallback((sp: Screenplay) => {
    setScreenplay(sp);
    const d = screenplayToDoc(sp);
    setDoc(d);
    const scenes = deriveScenes(d.blocks);
    if (scenes.length > 0) setActiveSceneId(scenes[0].headingBlockId);
    // Remember active screenplay so it survives refresh
    localStorage.setItem('sceneflow_active_screenplay', sp.sessionId);
  }, []);

  // Rename screenplay
  const handleRename = useCallback((title: string) => {
    if (!screenplay) return;
    const updated = { ...screenplay, title };
    setScreenplay(updated);
    saveScreenplay(updated);
  }, [screenplay]);

  // Duplicate screenplay
  const handleDuplicate = useCallback(() => {
    if (!screenplay || !doc) return;
    const id = `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dup: Screenplay = {
      ...JSON.parse(JSON.stringify(screenplay)),
      sessionId: id,
      title: `${screenplay.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveScreenplay(dup);
    handleLoadScreenplay(dup);
  }, [screenplay, doc, handleLoadScreenplay]);

  // PDF Export
  const handleExport = useCallback(() => {
    if (!doc) return;
    setShowExportDialog(true);
  }, [doc]);

  const handleExportWithOptions = useCallback((options: ExportOptions) => {
    if (!doc) return;
    // Ensure we use the latest titlePage from screenplay (it's edited separately)
    const exportDoc = screenplay?.titlePage
      ? { ...doc, titlePage: screenplay.titlePage }
      : doc;
    docToPdf(exportDoc, options);
  }, [doc, screenplay]);

  if (!screenplay) {
    return (
      <div className="min-h-screen flex flex-col">
        <ModuleNav />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-text-3">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isFullscreen ? 'bg-void' : ''}`} style={{ background: palette?.desk ?? '#13120f' }}>
      {/* ── Zen mode: floating exit button + Escape key ── */}
      {isFullscreen && (
        <button
          onClick={() => setIsFullscreen(false)}
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 50,
            background: 'rgba(196,92,74,0.1)', border: '1px solid rgba(196,92,74,0.2)',
            color: palette?.cursor ?? '#c45c4a', fontSize: 11,
            padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            opacity: 0.4, transition: 'opacity 0.2s',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
        >
          Exit Zen · Esc
        </button>
      )}
      {/* ── Sticky Header ── */}
      {!isFullscreen && (
        <header style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', height: 48, flexShrink: 0,
          borderBottom: `1px solid ${palette?.border ?? 'rgba(200,189,160,0.10)'}`,
          background: palette?.headerBg ?? '#17160f',
          backdropFilter: 'blur(12px)',
        }}>
          {/* ── Left: brand + file menu ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: palette?.cursor ?? '#c45c4a', textTransform: 'uppercase' }}>SceneFlow</span>
            <FileMenu currentTitle={screenplay?.title ?? ''} palette={palette} onLoadScreenplay={handleLoadScreenplay} onExport={handleExport} onRename={handleRename} onDuplicate={handleDuplicate} getCurrentScreenplay={() => screenplay} />
          </div>

          {/* ── Center: view mode + panels ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* View mode tabs — pill group */}
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'rgba(200,189,160,0.04)', borderRadius: 6,
              padding: 2,
            }}>
              {(['normal', 'page'] as const).map(v => (
                <button key={v} onClick={() => setScriptView(v)} style={{
                  padding: '5px 14px', fontSize: 12, borderRadius: 5,
                  background: scriptView === v ? 'rgba(196,92,74,0.15)' : 'transparent',
                  color: scriptView === v ? (palette?.cursor ?? '#c45c4a') : (palette?.ink ?? '#c8bda0'),
                  border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                  fontWeight: scriptView === v ? 600 : 400, transition: 'all 0.15s',
                  opacity: scriptView === v ? 1 : 0.6,
                }}>{v}</button>
              ))}
              {/* Zen — hides UI for distraction-free writing */}
              <button onClick={() => setIsFullscreen(true)} style={{
                padding: '5px 14px', fontSize: 12, borderRadius: 5,
                background: 'transparent',
                color: palette?.ink ?? '#c8bda0',
                border: 'none', cursor: 'pointer',
                fontWeight: 400, transition: 'all 0.15s',
                opacity: 0.6,
              }}>Zen</button>
            </div>

            <div style={{ width: 1, height: 20, background: palette?.border ?? 'rgba(200,189,160,0.10)', margin: '0 10px' }} />

            {/* Panel buttons */}
            {([
              { id: 'beats' as const, label: 'Beats' },
              { id: 'stats' as const, label: 'Stats' },
              { id: 'characters' as const, label: 'Characters' },
              { id: 'cards' as const, label: 'Cards' },
              { id: 'title-page' as const, label: 'Title' },
            ]).map(p => (
              <button key={p.id} onClick={() => setPanelView(panelView === p.id ? 'none' : p.id)} style={{
                padding: '5px 10px', fontSize: 12, borderRadius: 5,
                background: panelView === p.id ? 'rgba(196,92,74,0.15)' : 'transparent',
                color: panelView === p.id ? (palette?.cursor ?? '#c45c4a') : (palette?.ink ?? '#c8bda0'),
                border: 'none', cursor: 'pointer',
                fontWeight: panelView === p.id ? 600 : 400, transition: 'all 0.15s',
                opacity: panelView === p.id ? 1 : 0.5,
              }}>{p.label}</button>
            ))}
          </div>

          {/* ── Right: stats + tools ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Page/word count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: palette?.ink ?? '#c8bda0', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>
                {pageCount} pg
              </span>
              <span style={{ fontSize: 12, color: palette?.ink ?? '#c8bda0', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', opacity: 0.5 }}>
                {wordCount}w
              </span>
            </div>

            {/* Current element type */}
            {currentElementType && (
              <span style={{
                fontSize: 10, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 4,
                color: palette?.cursor ?? '#c45c4a', background: 'rgba(196,92,74,0.12)',
                textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 600,
              }}>
                {currentElementType === 'scene-heading' ? 'Scene' : currentElementType}
              </span>
            )}

            {/* Save status */}
            <span style={{ fontSize: 11, color: isSaved ? (palette?.ink ?? '#c8bda0') : (palette?.cursor ?? '#c45c4a'), opacity: isSaved ? 0.5 : 1, transition: 'color 0.3s' }}>
              {isSaved ? 'Saved' : 'Saving...'}
            </span>

            <div style={{ width: 1, height: 20, background: palette?.border ?? 'rgba(200,189,160,0.10)' }} />

            {/* Snapshots */}
            <DraftSnapshots screenplay={screenplay} palette={palette} onRestore={handleLoadScreenplay} />

            {/* Theme picker */}
            <ThemePicker hue={editorHue ?? 38} tone={editorTone} onChange={(h, t) => { setEditorHue(h); setEditorTone(t); }} onReset={() => { setEditorHue(null); setEditorTone('dark'); }} />

            {/* Shortcuts help */}
            <div className="relative">
              <button onClick={() => setShowShortcuts(v => !v)} style={{
                background: showShortcuts ? 'rgba(196,92,74,0.12)' : 'none',
                border: `1px solid ${showShortcuts ? 'rgba(196,92,74,0.2)' : (palette?.border ?? 'rgba(200,189,160,0.10)')}`,
                color: showShortcuts ? (palette?.cursor ?? '#c45c4a') : (palette?.ink ?? '#c8bda0'),
                fontSize: 12, width: 24, height: 24,
                borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: showShortcuts ? 1 : 0.5, transition: 'all 0.15s',
              }}>?</button>
              {showShortcuts && (
                <div style={{
                  position: 'absolute', top: 32, right: 0, zIndex: 50,
                  background: palette?.headerBg ?? '#17160f', border: `1px solid ${palette?.border ?? 'rgba(200,189,160,0.10)'}`,
                  borderRadius: 8, padding: '16px 20px', minWidth: 260,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  fontSize: 12, color: palette?.ink ?? '#c8bda0', lineHeight: 2.2,
                }}>
                  <div style={{ fontSize: 10, color: palette?.muted ?? '#7a7060', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Shortcuts</div>
                  {[
                    ['⌃1', 'Scene Heading'], ['⌃2', 'Action'], ['⌃3', 'Character'],
                    ['⌃4', 'Parenthetical'], ['⌃5', 'Dialogue'], ['⌃6', 'Transition'],
                    ['Tab', 'Cycle Type'], ['Enter', 'Next Element'],
                    ['\u21E7Enter', 'Line Break'], ['\u2318Z', 'Undo'], ['\u2318\u21E7Z', 'Redo'],
                    ['\u2318F', 'Find & Replace'], ['\u2318M', 'Script Note'],
                    ['\u2318D', 'Dual Dialogue'], ['\u2318\u2191/\u2193', 'Scene Nav'],
                  ].map(([key, desc]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                      <kbd style={{ fontFamily: 'var(--font-mono)', color: palette?.cursor ?? '#c45c4a', fontSize: 12 }}>{key}</kbd>
                      <span style={{ color: palette?.muted ?? '#7a7060', fontSize: 12 }}>{desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </header>
      )}

      <div className="flex-1 flex overflow-hidden relative" style={{ marginRight: showKleoPanel ? 400 : 0, transition: 'margin-right 0.25s ease-out' }}>
        {/* Mobile sidebar overlay */}
        {isMobile && sidebarOpen && (
          <>
            <div
              onClick={() => setSidebarOpen(false)}
              style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'rgba(0,0,0,0.5)' }}
            />
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 20 }}>
              {doc && <SceneSidebar
                doc={doc}
                activeSceneId={activeSceneId}
                palette={palette}
                onSceneSelect={handleSelectScene}
                onDocChange={handleDocChange}
                onAddScene={handleAddScene}
              />}
            </div>
          </>
        )}

        {/* Desktop sidebar */}
        {!isMobile && doc && (
          <SceneSidebar
            doc={doc}
            activeSceneId={activeSceneId}
            palette={palette}
            onSceneSelect={handleSelectScene}
            onDocChange={handleDocChange}
            onAddScene={handleAddScene}
          />
        )}

        {doc && <WritingArea
          doc={doc}
          onDocChange={handleDocChange}
          viewMode={viewMode}
          scriptView={scriptView}
          theme={theme}
          activeSceneId={activeSceneId}
          typewriterMode={typewriterMode}
          themeOverride={palette}
          onActiveSceneChange={setActiveSceneId}
          onFocusedElementInfo={setFocusedElementInfo}
          onSelectionTextChange={handleSelectionTextChange}
          editorRef={handleEditorRef}
        />}

        {/* Floating Kleo button */}
        {!showKleoPanel && !isFullscreen && (
          <button
            onClick={handleOpenKleo}
            style={{
              position: 'fixed', top: 64, right: 16, zIndex: 30,
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #c45c4a 0%, #8a3a2a 100%)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(196,92,74,0.3), 0 2px 6px rgba(0,0,0,0.2)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              fontSize: 15, fontWeight: 700, color: '#fff',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(196,92,74,0.4), 0 3px 8px rgba(0,0,0,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(196,92,74,0.3), 0 2px 6px rgba(0,0,0,0.2)'; }}
            title="Talk to Kleo (⌘K)"
          >K</button>
        )}

        {/* Character Filter Panel */}
        {showCharFilter && (
          <CharacterFilter
            scenes={screenplay.scenes}
            characters={scriptCharacters}
            palette={palette}
            onClose={() => setShowCharFilter(false)}
          />
        )}

        {/* Kleo Panel (stuck mode + chat) */}
        {showKleoPanel && kleoTaste && (
          <KleoPanel
            taste={kleoTaste}
            style={kleoStyle}
            scenes={screenplay.scenes}
            activeSceneId={activeSceneId}
            conversations={kleoConversations}
            identity={kleoIdentity}
            onIdentityChange={(id) => { setKleoIdentity(id); saveKleoIdentity(id); }}
            onNewMessage={handleKleoMessage}
            onClose={() => setShowKleoPanel(false)}
            onInsertBlocks={handleKleoInsertBlocks}
            onReplaceSelection={handleKleoReplaceSelection}
            selectedText={kleoSelectedText || undefined}
            palette={palette}
          />
        )}
      </div>

      {/* StatusBar hidden — Muji: let the page breathe */}

      <BeatSheet
        scenes={screenplay.scenes}
        sessionId={screenplay.sessionId}
        open={panelView === 'beats'}
        onClose={() => setPanelView('none')}
      />

      {doc && <ScriptStats
        doc={doc}
        isOpen={panelView === 'stats'}
        onClose={() => setPanelView('none')}
      />}

      {doc && <CharacterReport
        doc={doc}
        isOpen={panelView === 'characters'}
        onClose={() => setPanelView('none')}
        onRenameCharacter={handleRenameCharacter}
      />}

      <SceneCards
        scenes={screenplay.scenes}
        onReorder={handleScenesChange}
        onSelectScene={(id) => { setActiveSceneId(id); setPanelView('none'); }}
        onAddScene={() => { handleAddScene(); }}
        isOpen={panelView === 'cards'}
        onClose={() => setPanelView('none')}
      />

      <TitlePageEditor
        titlePage={screenplay.titlePage}
        onChange={(tp) => updateScreenplay(sp => ({ ...sp, titlePage: tp }))}
        theme={theme}
        isOpen={panelView === 'title-page'}
        onClose={() => setPanelView('none')}
      />

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* Go To Page Dialog */}
      {showGoToPage && (
        <GoToPageDialog
          theme={theme}
          totalPages={pageCount}
          onGoToPage={handleGoToPage}
          onClose={() => setShowGoToPage(false)}
        />
      )}

      {/* Export PDF Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExportWithOptions}
        palette={palette}
        defaultTitle={doc?.title || screenplay?.title || 'Untitled Screenplay'}
      />

      {/* Kleo Onboarding */}
      {showKleoOnboarding && (
        <KleoOnboarding onComplete={handleKleoOnboardingComplete} />
      )}

      {/* Kleo Session Recap */}
      {kleoRecapMessage && !showKleoOnboarding && (
        <KleoRecap
          message={kleoRecapMessage}
          onDismiss={() => setKleoRecapMessage(null)}
        />
      )}

      {/* First-time welcome */}
      {showWelcome && (
        <div
          onClick={dismissWelcome}
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            zIndex: 60, background: '#1e1d18', border: '1px solid rgba(200,189,160,0.12)',
            borderRadius: 12, padding: '18px 28px', maxWidth: 420,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            animation: 'fadeInUp 0.4s ease-out',
          }}
        >
          <p style={{ fontSize: 13, color: '#c8bda0', lineHeight: 1.7, margin: 0 }}>
            Type <kbd style={{ color: '#c45c4a', fontFamily: 'var(--font-mono)', fontSize: 12 }}>INT.</kbd> or <kbd style={{ color: '#c45c4a', fontFamily: 'var(--font-mono)', fontSize: 12 }}>EXT.</kbd> to start a scene.{' '}
            <kbd style={{ color: '#c45c4a', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Tab</kbd> cycles element types.{' '}
            <kbd style={{ color: '#c45c4a', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Enter</kbd> advances.{' '}
            The <span style={{ color: '#c45c4a', fontWeight: 600 }}>K</span> button is Kleo — your co-writer.
          </p>
          <p style={{ fontSize: 10, color: '#4a4535', marginTop: 8, marginBottom: 0, textAlign: 'center' }}>
            click or start typing to dismiss
          </p>
          <style>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateX(-50%) translateY(12px); }
              to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </div>
      )}

    </div>
  );
}

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const mod = isMac ? '\u2318' : 'Ctrl';

  const shortcuts = [
    { section: 'Writing' },
    { keys: 'Enter', desc: 'New element (auto-detects type)' },
    { keys: 'Tab', desc: 'Cycle element type (Action \u2192 Character \u2192 Dialogue \u2192 ...)' },
    { keys: 'Backspace', desc: 'Delete empty element' },
    { keys: '\u2191 / \u2193', desc: 'Navigate between elements' },
    { section: 'Editing' },
    { keys: `${mod}+Z`, desc: 'Undo' },
    { keys: `${mod}+Shift+Z`, desc: 'Redo' },
    { keys: `${mod}+F`, desc: 'Find & Replace' },
    { keys: `${mod}+B`, desc: 'Bold' },
    { keys: `${mod}+I`, desc: 'Italic' },
    { keys: `${mod}+U`, desc: 'Underline' },
    { keys: `${mod}+D`, desc: 'Toggle dual dialogue' },
    { section: 'Element Types' },
    { keys: `${mod}+1`, desc: 'Scene Heading' },
    { keys: `${mod}+2`, desc: 'Action' },
    { keys: `${mod}+3`, desc: 'Character' },
    { keys: `${mod}+4`, desc: 'Parenthetical' },
    { keys: `${mod}+5`, desc: 'Dialogue' },
    { keys: `${mod}+6`, desc: 'Transition' },
    { section: 'Navigation' },
    { keys: `${mod}+G`, desc: 'Go to page' },
    { keys: `${mod}+Shift+A`, desc: 'Select current scene' },
    { keys: `${mod}+M`, desc: 'Toggle bookmark' },
    { keys: `${mod}+K`, desc: 'Talk to Kleo (stuck mode)' },
    { section: 'Editor' },
    { keys: `${mod}+?`, desc: 'Toggle this help' },
    { keys: 'Escape', desc: 'Close panels / Find bar' },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface, #111520)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '28px 32px',
          width: '100%',
          maxWidth: 420,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#c45c4a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#4a4740', cursor: 'pointer', fontSize: 18, padding: 4 }}
          >
            &times;
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {shortcuts.map((item, i) => {
            if ('section' in item && !('keys' in item)) {
              return (
                <div key={i} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4a4740', marginTop: i > 0 ? 12 : 0, marginBottom: 4, fontWeight: 600 }}>
                  {item.section}
                </div>
              );
            }
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                <span style={{ fontSize: 12, color: '#8a8578' }}>{item.desc}</span>
                <kbd style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: '#d6ccb0',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap',
                }}>
                  {'keys' in item ? item.keys : ''}
                </kbd>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

