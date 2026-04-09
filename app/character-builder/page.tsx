'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  PHASES,
  TOTAL_QUESTIONS,
  getPhaseCompletionCount,
  getPhaseContextHints,
  type Phase,
  type Question,
} from '@/lib/character-phases';
import {
  getCharacter,
  getCharacters,
  createCharacter,
  saveCharacter,
  deleteCharacter,
  exportCharacterMarkdown,
  type StoredCharacter,
} from '@/lib/character-store';

// ─── Mobile detection ───
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

// ─── Colors ───
const C = {
  bg: '#0f0f0f',
  surface: '#1a1a1a',
  surfaceHover: '#242424',
  surfaceActive: '#2a2a2a',
  text: '#e8e4df',
  dim: '#8a8580',
  muted: '#5a5550',
  copper: '#c4956a',
  copperDim: 'rgba(196, 149, 106, 0.12)',
  copperGlow: 'rgba(196, 149, 106, 0.25)',
  red: '#c46a6a',
  redDim: 'rgba(196, 106, 106, 0.12)',
  green: '#6ac48a',
  greenDim: 'rgba(106, 196, 138, 0.12)',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.1)',
};

export default function CharacterBuilderPage() {
  return (
    <Suspense fallback={<div style={{ background: C.bg, minHeight: '100vh' }} />}>
      <CharacterBuilderInner />
    </Suspense>
  );
}

function CharacterBuilderInner() {
  const searchParams = useSearchParams();
  const charIdParam = searchParams.get('id');
  const isMobile = useIsMobile();

  const [character, setCharacter] = useState<StoredCharacter | null>(null);
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [activePhaseId, setActivePhaseId] = useState('identity');
  const [aiLoading, setAiLoading] = useState(false);
  const [ptLoading, setPtLoading] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [showCharList, setShowCharList] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load character on mount
  useEffect(() => {
    const allChars = getCharacters();
    setCharacters(allChars);

    if (charIdParam) {
      const found = getCharacter(charIdParam);
      if (found) { setCharacter(found); return; }
    }
    if (allChars.length > 0) {
      setCharacter(allChars[0]);
    } else {
      setShowCharList(true);
    }
  }, [charIdParam]);

  // Autosave (debounced 500ms)
  const persist = useCallback((char: StoredCharacter) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveCharacter(char);
      setCharacters(getCharacters());
    }, 500);
  }, []);

  const updateAnswer = useCallback((questionId: string, value: string | string[]) => {
    setCharacter(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        answers: { ...prev.answers, [questionId]: value },
        name: questionId === 'name' && typeof value === 'string' ? value : prev.name,
      };
      persist(next);
      return next;
    });
  }, [persist]);

  const handleNewCharacter = useCallback(() => {
    const c = createCharacter();
    setCharacter(c);
    setCharacters(getCharacters());
    setActivePhaseId('identity');
    setShowCharList(false);
  }, []);

  const handleSelectCharacter = useCallback((id: string) => {
    const c = getCharacter(id);
    if (c) { setCharacter(c); setShowCharList(false); }
  }, []);

  const handleDeleteCharacter = useCallback((id: string) => {
    deleteCharacter(id);
    const remaining = getCharacters();
    setCharacters(remaining);
    if (character?.id === id) {
      setCharacter(remaining.length > 0 ? remaining[0] : null);
      if (remaining.length === 0) setShowCharList(true);
    }
  }, [character]);

  // AI Challenge
  const handleChallenge = useCallback(async (phaseId: string) => {
    if (!character) return;
    setAiLoading(true);
    const phase = PHASES.find(p => p.id === phaseId);
    const phaseAnswers: Record<string, string | string[]> = {};
    phase?.questions.forEach(q => {
      if (character.answers[q.id]) phaseAnswers[q.id] = character.answers[q.id];
    });

    try {
      const res = await fetch('/api/character/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: phaseAnswers,
          phaseId,
          phaseTitle: phase?.title || '',
          allAnswers: character.answers,
        }),
      });
      const data = await res.json();
      setCharacter(prev => {
        if (!prev) return prev;
        const next = { ...prev, aiFeedback: { ...prev.aiFeedback, [phaseId]: data.feedback } };
        saveCharacter(next);
        setCharacters(getCharacters());
        return next;
      });
    } catch { /* silently fail */ }
    setAiLoading(false);
  }, [character]);

  // Pressure Test
  const handlePressureTest = useCallback(async () => {
    if (!character) return;
    setPtLoading(true);
    try {
      const res = await fetch('/api/character/pressure-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: character.answers, characterName: character.name }),
      });
      const data = await res.json();
      setCharacter(prev => {
        if (!prev) return prev;
        const next = {
          ...prev,
          pressureTest: { scenarios: data.scenarios, responses: prev.pressureTest?.responses || ['', '', ''] as [string, string, string] },
        };
        saveCharacter(next);
        setCharacters(getCharacters());
        return next;
      });
    } catch { /* silently fail */ }
    setPtLoading(false);
  }, [character]);

  const updatePressureResponse = useCallback((idx: number, text: string) => {
    setCharacter(prev => {
      if (!prev || !prev.pressureTest) return prev;
      const responses = [...prev.pressureTest.responses] as [string, string, string];
      responses[idx] = text;
      const next = { ...prev, pressureTest: { ...prev.pressureTest, responses } };
      persist(next);
      return next;
    });
  }, [persist]);

  // Cross-Validation
  const handleCrossValidate = useCallback(async () => {
    if (!character) return;
    setCvLoading(true);
    try {
      const res = await fetch('/api/character/cross-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: character.answers, characterName: character.name }),
      });
      const data = await res.json();
      setCharacter(prev => {
        if (!prev) return prev;
        const next = { ...prev, crossValidation: data.validation };
        saveCharacter(next);
        setCharacters(getCharacters());
        return next;
      });
    } catch { /* silently fail */ }
    setCvLoading(false);
  }, [character]);

  // Export
  const handleExport = useCallback(() => {
    if (!character) return;
    const md = exportCharacterMarkdown(character, PHASES);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'character'}-bible.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [character]);

  // Completion stats
  const totalAnswered = useMemo(() => {
    if (!character) return 0;
    return PHASES.reduce((sum, p) => sum + getPhaseCompletionCount(p.id, character.answers), 0);
  }, [character]);

  const activePhase = PHASES.find(p => p.id === activePhaseId) || PHASES[0];

  // Close sidebar on phase select (mobile)
  const handlePhaseSelect = useCallback((id: string) => {
    setActivePhaseId(id);
    setSidebarOpen(false);
  }, []);

  // Scroll to top when phase changes
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [activePhaseId]);

  // Keyboard: Cmd+Left/Right for phase navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!e.metaKey && !e.ctrlKey) return;
      const idx = PHASES.findIndex(p => p.id === activePhaseId);
      if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        setActivePhaseId(PHASES[idx - 1].id);
      }
      if (e.key === 'ArrowRight' && idx < PHASES.length - 1) {
        e.preventDefault();
        setActivePhaseId(PHASES[idx + 1].id);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activePhaseId]);

  // ─── Character List (no character selected) ───
  if (showCharList || !character) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
        <NavBar />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{
            fontFamily: 'var(--font-courier)', fontSize: 11, color: C.copper,
            letterSpacing: '0.15em', marginBottom: 16,
          }}>
            CHARACTER BUILDER
          </div>
          <h1 style={{ fontFamily: 'var(--font-lora)', fontSize: 32, fontWeight: 400, marginBottom: 12, lineHeight: 1.3 }}>
            Excavate a character.
          </h1>
          <p style={{ color: C.dim, fontSize: 14, marginBottom: 40, lineHeight: 1.7 }}>
            Eight phases. Fifty-three questions drawn from Egri, Weiland, Chubbuck, Jung, and McKee.
            AI challenges every answer. No templates. No shortcuts. You do the work.
          </p>

          <button
            onClick={handleNewCharacter}
            style={{
              width: '100%', padding: '16px', marginBottom: 32,
              background: C.copperDim, border: `1px solid ${C.copper}`,
              borderRadius: 8, color: C.copper, fontSize: 14, fontWeight: 600,
              letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            + New Character
          </button>

          {characters.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {characters.map(c => {
                const answered = PHASES.reduce((s, p) => s + getPhaseCompletionCount(p.id, c.answers), 0);
                const pct = Math.round((answered / TOTAL_QUESTIONS) * 100);
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCharacter(c.id)}
                    style={{
                      padding: '16px 20px', background: C.surface, border: `1px solid ${C.border}`,
                      borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.surface)}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 500 }}>
                        {c.name || 'Unnamed Character'}
                      </div>
                      <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
                        {answered}/{TOTAL_QUESTIONS} questions &middot; {pct}% complete
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 40, height: 4, borderRadius: 2, background: C.surfaceHover, overflow: 'hidden',
                      }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: C.copper, borderRadius: 2 }} />
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteCharacter(c.id); }}
                        style={{
                          background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
                          fontSize: 14, padding: '4px 8px',
                        }}
                        title="Delete"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Builder Layout ───
  return (
    <div style={{ background: C.bg, height: '100vh', color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <NavBar
        characterName={character.name}
        onBack={() => setShowCharList(true)}
        onToggleSidebar={isMobile ? () => setSidebarOpen(!sidebarOpen) : undefined}
        phaseLabel={`${activePhase.num}. ${activePhase.title}`}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        {/* Mobile sidebar overlay */}
        {isMobile && sidebarOpen && (
          <>
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'absolute', inset: 0, zIndex: 15,
                background: 'rgba(0,0,0,0.5)',
              }}
            />
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 20,
            }}>
              <Sidebar
                character={character}
                activePhaseId={activePhaseId}
                onSelectPhase={handlePhaseSelect}
                onValidate={handleCrossValidate}
                cvLoading={cvLoading}
                onExport={handleExport}
                totalAnswered={totalAnswered}
              />
            </div>
          </>
        )}
        {/* Desktop sidebar (always visible) */}
        {!isMobile && (
          <Sidebar
            character={character}
            activePhaseId={activePhaseId}
            onSelectPhase={setActivePhaseId}
            onValidate={handleCrossValidate}
            cvLoading={cvLoading}
            onExport={handleExport}
            totalAnswered={totalAnswered}
          />
        )}

        {/* Main Content */}
        <div
          ref={contentRef}
          style={{ flex: 1, overflow: 'auto', padding: '40px 24px 80px' }}
        >
          <div
            key={activePhaseId}
            className="animate-fade-in"
          >
              <PhaseHeader
                phase={activePhase}
                answers={character.answers}
                isComplete={getPhaseCompletionCount(activePhaseId, character.answers) === activePhase.questions.length}
              />

              <div style={{ maxWidth: 640, margin: '0 auto' }}>
                {activePhase.questions.map(q => (
                  <QuestionInput
                    key={q.id}
                    question={q}
                    value={character.answers[q.id]}
                    onChange={val => updateAnswer(q.id, val)}
                    characterName={character.name}
                  />
                ))}

                {/* Challenge Button */}
                <div style={{ marginTop: 48, marginBottom: 24 }}>
                  {getPhaseCompletionCount(activePhaseId, character.answers) >= 2 && !character.aiFeedback[activePhaseId] && (
                    <p style={{ fontSize: 12, color: C.dim, marginBottom: 12, textAlign: 'center', lineHeight: 1.6 }}>
                      Ready to test your answers? The AI collaborator will find the gaps you didn&apos;t see.
                    </p>
                  )}
                  <button
                    onClick={() => handleChallenge(activePhaseId)}
                    disabled={aiLoading || getPhaseCompletionCount(activePhaseId, character.answers) < 2}
                    style={{
                      width: '100%', padding: '14px 24px',
                      background: aiLoading ? C.surfaceHover : C.copperDim,
                      border: `1px solid ${aiLoading ? C.muted : 'rgba(196, 149, 106, 0.4)'}`,
                      borderRadius: 8, color: aiLoading ? C.muted : C.copper,
                      fontSize: 13, fontWeight: 600, letterSpacing: '0.08em',
                      textTransform: 'uppercase', cursor: aiLoading ? 'wait' : 'pointer',
                      opacity: getPhaseCompletionCount(activePhaseId, character.answers) < 2 ? 0.3 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {aiLoading ? 'Thinking...' : character.aiFeedback[activePhaseId] ? 'Challenge Again' : 'Challenge This Phase'}
                  </button>
                </div>

                {/* AI Feedback */}
                {character.aiFeedback[activePhaseId] && (
                  <AIFeedbackPanel feedback={character.aiFeedback[activePhaseId]} />
                )}

                {/* Pressure Test (only on Phase 08) */}
                {activePhaseId === 'pressure' && (
                  <PressureTestPanel
                    character={character}
                    loading={ptLoading}
                    onGenerate={handlePressureTest}
                    onUpdateResponse={updatePressureResponse}
                  />
                )}

                {/* Cross Validation */}
                {character.crossValidation && (
                  <CrossValidationPanel validation={character.crossValidation} />
                )}

                {/* Phase Navigation */}
                <PhaseNav
                  currentPhaseId={activePhaseId}
                  onNavigate={setActivePhaseId}
                />
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NavBar ───
function NavBar({ characterName, onBack, onToggleSidebar, phaseLabel }: {
  characterName?: string; onBack?: () => void; onToggleSidebar?: () => void; phaseLabel?: string;
}) {
  return (
    <header
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Mobile menu toggle */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              background: 'none', border: 'none', color: C.dim, cursor: 'pointer',
              fontSize: 18, padding: '2px 6px', display: 'flex', alignItems: 'center',
            }}
          >
            {'\u2630'}
          </button>
        )}
        <Link
          href="/"
          style={{ color: C.muted, fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textDecoration: 'none', textTransform: 'uppercase' }}
        >
          SceneFlow
        </Link>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', color: C.dim, cursor: 'pointer',
              fontSize: 12, letterSpacing: '0.05em',
            }}
          >
            {'\u2190'} Characters
          </button>
        )}
      </div>

      <nav style={{ display: 'flex', gap: 4 }}>
        <Link href="/" style={{
          padding: '6px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em',
          color: C.muted, textDecoration: 'none', borderRadius: 6,
        }}>Ideation</Link>
        <Link href="/editor" style={{
          padding: '6px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em',
          color: C.muted, textDecoration: 'none', borderRadius: 6,
        }}>Editor</Link>
        <div style={{
          padding: '6px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em',
          color: C.copper, background: C.copperDim, borderRadius: 6,
        }}>Characters</div>
      </nav>

      {characterName ? (
        <span style={{ color: C.dim, fontSize: 12, fontStyle: 'italic' }}>
          {characterName}
        </span>
      ) : <div style={{ width: 80 }} />}
    </header>
  );
}

// ─── Sidebar ───
function Sidebar({
  character, activePhaseId, onSelectPhase, onValidate, cvLoading, onExport, totalAnswered,
}: {
  character: StoredCharacter;
  activePhaseId: string;
  onSelectPhase: (id: string) => void;
  onValidate: () => void;
  cvLoading: boolean;
  onExport: () => void;
  totalAnswered: number;
}) {
  const pct = Math.round((totalAnswered / TOTAL_QUESTIONS) * 100);

  return (
    <aside style={{
      width: 260, flexShrink: 0, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'auto',
      padding: '24px 0', background: C.bg,
    }}>
      {/* Character Name + Essence */}
      <div style={{ padding: '0 20px', marginBottom: 24 }}>
        <div style={{
          fontFamily: 'var(--font-lora)', fontSize: 18, fontWeight: 400,
          color: character.name ? C.text : C.muted,
          minHeight: 24,
        }}>
          {character.name || 'Unnamed'}
        </div>

        {/* Live essence: key answers condensed */}
        <CharacterEssence answers={character.answers} />

        <div style={{ fontSize: 11, color: C.dim, marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{totalAnswered}/{TOTAL_QUESTIONS}</span>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: C.surfaceHover }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: C.copper, transition: 'width 0.3s' }} />
          </div>
          <span style={{ color: C.copper }}>{pct}%</span>
        </div>
      </div>

      {/* Phase List */}
      <div style={{ flex: 1 }}>
        {PHASES.map(phase => {
          const count = getPhaseCompletionCount(phase.id, character.answers);
          const total = phase.questions.length;
          const isActive = phase.id === activePhaseId;
          const hasAny = count > 0;
          const isComplete = count === total;

          return (
            <button
              key={phase.id}
              onClick={() => onSelectPhase(phase.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 20px',
                background: isActive ? C.copperDim : 'transparent',
                border: 'none', borderLeft: isActive ? `2px solid ${C.copper}` : '2px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.surfaceHover; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                fontFamily: 'var(--font-courier)', fontSize: 11, color: isActive ? C.copper : C.muted,
                width: 20,
              }}>
                {phase.num}
              </span>
              <span style={{
                flex: 1, fontSize: 13, color: isActive ? C.text : hasAny ? C.dim : C.muted,
                fontWeight: isActive ? 500 : 400,
              }}>
                {phase.title}
              </span>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-courier)',
                color: isComplete ? C.green : hasAny ? C.copper : C.muted,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {isComplete ? (
                  <span style={{ color: C.green, fontWeight: 700 }}>{'\u2713'}</span>
                ) : hasAny ? (
                  `${count}/${total}`
                ) : (
                  <span style={{ fontSize: 9, opacity: 0.4 }}>{total}q</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={onValidate}
          disabled={cvLoading || totalAnswered < 5}
          style={{
            width: '100%', padding: '10px', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 6, color: cvLoading ? C.muted : C.copper,
            cursor: totalAnswered < 5 ? 'not-allowed' : 'pointer',
            opacity: totalAnswered < 5 ? 0.4 : 1,
          }}
        >
          {cvLoading ? 'Validating...' : 'Validate Character'}
        </button>
        <button
          onClick={onExport}
          disabled={totalAnswered === 0}
          style={{
            width: '100%', padding: '10px', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.dim, cursor: totalAnswered === 0 ? 'not-allowed' : 'pointer',
            opacity: totalAnswered === 0 ? 0.4 : 1,
          }}
        >
          Export Bible
        </button>
      </div>
    </aside>
  );
}

// ─── Phase Header ───
function PhaseHeader({ phase, answers, isComplete }: { phase: Phase; answers: Record<string, string | string[]>; isComplete: boolean }) {
  const contextHints = getPhaseContextHints(phase.id, answers);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: contextHints.length > 0 ? 32 : 0 }}>
        <div style={{
          fontFamily: 'var(--font-courier)', fontSize: 12,
          color: isComplete ? C.green : C.copper,
          letterSpacing: '0.15em', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {isComplete && <span style={{ fontSize: 14 }}>{'\u2713'}</span>}
          PHASE {phase.num}
          {isComplete && <span style={{ fontSize: 10, opacity: 0.7 }}>COMPLETE</span>}
        </div>
        <h2 style={{
          fontFamily: 'var(--font-lora)', fontSize: 28, fontWeight: 400,
          marginBottom: 12, lineHeight: 1.3,
        }}>
          {phase.title}
        </h2>
        <p style={{
          fontSize: 13, color: C.dim, margin: '0 0 16px', lineHeight: 1.7, maxWidth: 480,
          marginLeft: 'auto', marginRight: 'auto',
        }}>
          {phase.description}
        </p>
        <blockquote style={{
          fontFamily: 'var(--font-lora)', fontStyle: 'italic', fontSize: 14,
          color: C.muted, margin: 0, lineHeight: 1.6,
        }}>
          &ldquo;{phase.quote}&rdquo;
          <span style={{
            display: 'block', fontSize: 11, fontStyle: 'normal', color: C.muted,
            marginTop: 4, fontFamily: 'var(--font-geist-sans)', opacity: 0.7,
          }}>
            &mdash; {phase.source}
          </span>
        </blockquote>
      </div>

      {/* Context Hints from other phases */}
      {contextHints.length > 0 && (
        <div style={{
          padding: '16px 20px', background: 'rgba(196, 149, 106, 0.04)',
          border: `1px solid rgba(196, 149, 106, 0.1)`, borderRadius: 8,
          marginTop: 24,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: C.copper, marginBottom: 10, opacity: 0.8,
          }}>
            From earlier phases — keep these in mind
          </div>
          {contextHints.map(hint => (
            <div key={hint.questionId} style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.muted }}>{hint.label}: </span>
              <span style={{
                fontSize: 12, color: C.dim, fontStyle: 'italic',
              }}>
                &ldquo;{hint.value.length > 120 ? hint.value.slice(0, 120) + '...' : hint.value}&rdquo;
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dependency guidance — when context hints SHOULD exist but don't */}
      {contextHints.length === 0 && phase.dependsOn && phase.dependsOn.length > 0 && (
        <div style={{
          padding: '12px 16px', background: 'rgba(255,255,255,0.02)',
          border: `1px dashed rgba(255,255,255,0.06)`, borderRadius: 8,
          marginTop: 24, textAlign: 'center',
        }}>
          <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.6 }}>
            This phase builds on{' '}
            {phase.dependsOn.map((depId, i) => {
              const dep = PHASES.find(p => p.id === depId);
              return dep ? (
                <span key={depId}>
                  {i > 0 && ' and '}
                  <span style={{ color: C.dim }}>Phase {dep.num}: {dep.title}</span>
                </span>
              ) : null;
            })}
            . Fill those first for the deepest connections.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Question Input (all 5 types) ───
function QuestionInput({
  question, value, onChange, characterName,
}: {
  question: Question;
  value: string | string[] | undefined;
  onChange: (val: string | string[]) => void;
  characterName?: string;
}) {
  const textVal = typeof value === 'string' ? value : '';
  const arrVal = Array.isArray(value) ? value : [];
  const hasAnswer = (typeof value === 'string' && value.trim().length > 0) || (Array.isArray(value) && value.length > 0);

  // Dynamic name interpolation for labels like "[Name] starts believing..."
  const label = characterName
    ? question.label.replace(/\[Name\]/g, characterName)
    : question.label;

  return (
    <div style={{
      marginBottom: 32, paddingLeft: 16,
      borderLeft: hasAnswer ? `2px solid ${C.copper}` : '2px solid transparent',
      transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <label style={{
          display: 'block', fontSize: 14, fontWeight: 500, color: C.text,
          marginBottom: 6, lineHeight: 1.5, flex: 1,
        }}>
          {label}
        </label>
        {hasAnswer && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.copper, flexShrink: 0, marginTop: 4 }} />
        )}
      </div>
      {question.hint && (
        <p style={{ fontSize: 12, color: C.dim, margin: '0 0 10px', lineHeight: 1.5 }}>
          {question.hint}
        </p>
      )}

      {/* SHORT */}
      {question.type === 'short' && (
        <input
          type="text"
          value={textVal}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder || ''}
          style={{
            width: '100%', padding: '12px 16px', fontSize: 15,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.text, outline: 'none',
            fontFamily: question.id === 'verbal_tell' ? 'var(--font-courier)' : 'inherit',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = C.copper}
          onBlur={e => e.target.style.borderColor = C.border}
        />
      )}

      {/* LONG */}
      {question.type === 'long' && (
        <AutoTextarea
          value={textVal}
          onChange={val => onChange(val)}
          placeholder={question.placeholder || ''}
          style={{
            width: '100%', padding: '12px 16px', fontSize: 15, lineHeight: 1.7,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.text, outline: 'none', resize: 'none',
            minHeight: 100, fontFamily: 'inherit',
            transition: 'border-color 0.2s',
          }}
        />
      )}

      {/* SCENE (monospaced textarea for dialogue) */}
      {question.type === 'scene' && (
        <AutoTextarea
          value={textVal}
          onChange={val => onChange(val)}
          placeholder={question.placeholder || ''}
          style={{
            width: '100%', padding: '16px 20px', fontSize: 14, lineHeight: 1.8,
            background: '#141414', border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.text, outline: 'none', resize: 'none',
            minHeight: 140, fontFamily: 'var(--font-courier)',
            transition: 'border-color 0.2s',
          }}
        />
      )}

      {/* CHOICE (single-select) */}
      {question.type === 'choice' && question.options && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {question.options.map(opt => {
            const selected = textVal === opt;
            return (
              <button
                key={opt}
                onClick={() => onChange(selected ? '' : opt)}
                style={{
                  padding: '8px 16px', fontSize: 13, lineHeight: 1.4,
                  background: selected ? C.copperDim : C.surface,
                  border: `1px solid ${selected ? C.copper : C.border}`,
                  borderRadius: 20, color: selected ? C.copper : C.dim,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* MULTI (multi-select) */}
      {question.type === 'multi' && question.options && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {question.options.map(opt => {
            const selected = arrVal.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => {
                  const next = selected ? arrVal.filter(v => v !== opt) : [...arrVal, opt];
                  onChange(next);
                }}
                style={{
                  padding: '8px 16px', fontSize: 13, lineHeight: 1.4,
                  background: selected ? C.copperDim : C.surface,
                  border: `1px solid ${selected ? C.copper : C.border}`,
                  borderRadius: 20, color: selected ? C.copper : C.dim,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {selected ? '\u2713 ' : ''}{opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Auto-growing textarea ───
function AutoTextarea({
  value, onChange, style, placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  style: React.CSSProperties;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.max(ref.current.scrollHeight, parseInt(String(style.minHeight) || '80')) + 'px';
    }
  }, [value, style.minHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={style}
      onFocus={e => e.target.style.borderColor = C.copper}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  );
}

// ─── AI Feedback Panel ───
function AIFeedbackPanel({ feedback }: { feedback: string }) {
  return (
    <div style={{
      padding: '24px 24px 20px', background: 'rgba(196, 149, 106, 0.04)',
      border: `1px solid rgba(196, 149, 106, 0.12)`,
      borderRadius: 10, marginBottom: 32, borderLeft: `3px solid ${C.copper}`,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: C.copper, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>{'\u2736'}</span>
        Collaborator Notes
      </div>
      <div style={{
        fontSize: 14, lineHeight: 1.85, color: C.text, whiteSpace: 'pre-wrap',
        fontFamily: 'var(--font-lora)',
      }}>
        {feedback}
      </div>
    </div>
  );
}

// ─── Pressure Test Panel ───
function PressureTestPanel({
  character, loading, onGenerate, onUpdateResponse,
}: {
  character: StoredCharacter;
  loading: boolean;
  onGenerate: () => void;
  onUpdateResponse: (idx: number, text: string) => void;
}) {
  const pt = character.pressureTest;
  const totalAnswered = PHASES.reduce((s, p) => s + getPhaseCompletionCount(p.id, character.answers), 0);

  return (
    <div style={{ marginTop: 48, borderTop: `1px solid ${C.border}`, paddingTop: 40 }}>
      <div style={{
        fontFamily: 'var(--font-courier)', fontSize: 11, color: C.red,
        letterSpacing: '0.15em', marginBottom: 8,
      }}>
        PRESSURE TEST
      </div>
      <p style={{ fontSize: 14, color: C.dim, marginBottom: 20, lineHeight: 1.6 }}>
        AI generates three custom scenarios based on everything you&apos;ve written.
        Each tests a different dimension of your character.
      </p>

      {!pt?.scenarios && (
        <button
          onClick={onGenerate}
          disabled={loading || totalAnswered < 10}
          style={{
            width: '100%', padding: '14px', fontSize: 13, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: loading ? C.surfaceHover : C.redDim,
            border: `1px solid ${loading ? C.muted : C.red}`,
            borderRadius: 8, color: loading ? C.muted : C.red,
            cursor: loading || totalAnswered < 10 ? 'wait' : 'pointer',
            opacity: totalAnswered < 10 ? 0.4 : 1,
          }}
        >
          {loading ? 'Generating Scenarios...' : 'Generate Pressure Test'}
        </button>
      )}

      {pt?.scenarios && (
        <div>
          <div style={{
            padding: '24px', background: '#1a1414', border: `1px solid rgba(196,106,106,0.15)`,
            borderRadius: 10, marginBottom: 24, whiteSpace: 'pre-wrap',
            fontSize: 14, lineHeight: 1.8, color: C.text,
          }}>
            {pt.scenarios}
          </div>

          {[0, 1, 2].map(i => (
            <div key={i} style={{ marginBottom: 24 }}>
              <label style={{
                fontSize: 12, fontWeight: 600, color: C.red, letterSpacing: '0.05em',
                textTransform: 'uppercase', marginBottom: 8, display: 'block',
              }}>
                Your Response to Scenario {i + 1}
              </label>
              <AutoTextarea
                value={pt.responses[i] || ''}
                onChange={val => onUpdateResponse(i, val)}
                placeholder="How does your character respond? What do they do, say, feel?"
                style={{
                  width: '100%', padding: '12px 16px', fontSize: 14, lineHeight: 1.7,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.text, outline: 'none', resize: 'none',
                  minHeight: 80, fontFamily: 'inherit', transition: 'border-color 0.2s',
                }}
              />
            </div>
          ))}

          <button
            onClick={onGenerate}
            disabled={loading}
            style={{
              padding: '10px 20px', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 6, color: C.dim, cursor: 'pointer',
            }}
          >
            {loading ? 'Regenerating...' : 'Regenerate Scenarios'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Cross Validation Panel ───
function CrossValidationPanel({ validation }: { validation: string }) {
  return (
    <div style={{
      marginTop: 32, padding: '24px',
      background: 'rgba(106,196,138,0.06)', border: `1px solid rgba(106,196,138,0.15)`,
      borderRadius: 10,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: C.green, marginBottom: 12,
      }}>
        Cross-Phase Validation
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.8, color: C.text, whiteSpace: 'pre-wrap' }}>
        {validation}
      </div>
    </div>
  );
}

// ─── Character Essence (sidebar summary — builds narrative from all phases) ───
function CharacterEssence({ answers }: { answers: Record<string, string | string[]> }) {
  const a = answers;
  const lines: Array<{ label: string; value: string; color: string }> = [];

  // Phase 01 — Identity
  if (a.intelligence && typeof a.intelligence === 'string')
    lines.push({ label: 'Type', value: a.intelligence, color: C.dim });
  if (a.insecurity && typeof a.insecurity === 'string')
    lines.push({ label: 'Core fear', value: a.insecurity.slice(0, 60), color: C.dim });

  // Phase 02 — Wound
  if (a.lie && typeof a.lie === 'string')
    lines.push({ label: 'Lie', value: a.lie.slice(0, 60), color: C.red });

  // Phase 03 — Drive
  if (a.want && typeof a.want === 'string')
    lines.push({ label: 'Want', value: a.want.slice(0, 50), color: C.copper });
  if (a.need && typeof a.need === 'string')
    lines.push({ label: 'Need', value: a.need.slice(0, 50), color: C.green });

  // Phase 05 — Contradiction
  if (a.paradox && typeof a.paradox === 'string')
    lines.push({ label: 'Paradox', value: a.paradox.slice(0, 60), color: C.dim });

  // Phase 08 — Arc
  if (a.change_verdict && typeof a.change_verdict === 'string')
    lines.push({ label: 'Arc', value: a.change_verdict.split('(')[0].trim(), color: C.dim });

  if (lines.length === 0) return null;

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, i) => (
        <div key={i} style={{ fontSize: 10, lineHeight: 1.5, display: 'flex', gap: 6 }}>
          <span style={{ color: C.muted, fontWeight: 600, letterSpacing: '0.03em', flexShrink: 0, width: 52, textAlign: 'right' }}>
            {line.label}
          </span>
          <span style={{ color: line.color, fontStyle: 'italic', fontFamily: 'var(--font-lora)' }}>
            {line.value}{line.value.length >= 50 ? '...' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Phase Navigation (prev/next) ───
function PhaseNav({ currentPhaseId, onNavigate }: { currentPhaseId: string; onNavigate: (id: string) => void }) {
  const idx = PHASES.findIndex(p => p.id === currentPhaseId);
  const prev = idx > 0 ? PHASES[idx - 1] : null;
  const next = idx < PHASES.length - 1 ? PHASES[idx + 1] : null;

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', marginTop: 56,
      paddingTop: 24, borderTop: `1px solid ${C.border}`,
    }}>
      {prev ? (
        <button
          onClick={() => onNavigate(prev.id)}
          style={{
            background: 'none', border: 'none', color: C.dim, cursor: 'pointer',
            fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span>&larr;</span>
          <span><span style={{ fontSize: 11, color: C.muted }}>{prev.num}</span> {prev.title}</span>
        </button>
      ) : <div />}
      {next ? (
        <button
          onClick={() => onNavigate(next.id)}
          style={{
            background: 'none', border: 'none', color: C.copper, cursor: 'pointer',
            fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span><span style={{ fontSize: 11, color: C.dim }}>{next.num}</span> {next.title}</span>
          <span>&rarr;</span>
        </button>
      ) : <div />}
    </div>
  );
}
