'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SparkInput } from '@/components/spark-input';
import { LoadingState } from '@/components/loading-state';
import { ModuleNav } from '@/components/module-nav';
import type { Character, DimensionAnswer, DimensionQuestion, ContradictionInsight, CharacterPortrait as PortraitType } from '@/lib/types';
import { DIMENSIONS } from '@/lib/types';
import { getSessions, getSession, saveSession, deleteSession, createSessionId, type StoredSession } from '@/lib/session-store';

// Lazy-load framer-motion components (only needed after first interaction)
const CharacterCard = dynamic(() => import('@/components/character-card').then(m => ({ default: m.CharacterCard })), { ssr: false });
const QuestionCard = dynamic(() => import('@/components/question-card').then(m => ({ default: m.QuestionCard })), { ssr: false });
const DiscoveryTrail = dynamic(() => import('@/components/discovery-trail').then(m => ({ default: m.DiscoveryTrail })), { ssr: false });
const CharacterPortrait = dynamic(() => import('@/components/character-portrait').then(m => ({ default: m.CharacterPortrait })), { ssr: false });
const CharacterSketch = dynamic(() => import('@/components/character-sketch').then(m => ({ default: m.CharacterSketch })), { ssr: false });
const CharacterFigure = dynamic(() => import('@/components/character-figure').then(m => ({ default: m.CharacterFigure })), { ssr: false });

type Phase = 'projects' | 'spark' | 'characters' | 'explore' | 'portrait';

interface ExploreResponse extends DimensionQuestion {
  sketchLines: Record<string, string>;
}

const TOTAL_DIMENSIONS = DIMENSIONS.length;

export default function Home() {
  const [phase, setPhase] = useState<Phase>('projects');
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logline, setLogline] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [exploredIds, setExploredIds] = useState<Set<string>>(new Set());
  const [savedPortraits, setSavedPortraits] = useState<Record<string, PortraitType>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, DimensionAnswer[]>>({});

  // Explore state
  const [exploreCharacter, setExploreCharacter] = useState<Character | null>(null);
  const [answers, setAnswers] = useState<DimensionAnswer[]>([]);
  const [currentDimensionIndex, setCurrentDimensionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<ExploreResponse | null>(null);
  const [contradictionInsight, setContradictionInsight] = useState<ContradictionInsight | null>(null);

  // Portrait state
  const [portrait, setPortrait] = useState<{ character: Character; data: PortraitType } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ref to avoid stale closures in persist
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;

  // --- Load saved sessions on mount ---
  useEffect(() => {
    setMounted(true);
    const saved = getSessions();
    setSessions(saved);
    // If no saved sessions, go straight to spark
    if (saved.length === 0) {
      setPhase('spark');
    }
  }, []);

  // --- Persist session to localStorage ---
  const persistSession = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid || !logline || characters.length === 0) return;
    const session: StoredSession = {
      id: sid,
      logline,
      characters,
      exploredIds: [...exploredIds],
      portraits: savedPortraits,
      answers: savedAnswers,
      createdAt: getSession(sid)?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    saveSession(session);
    setSessions(getSessions());
  }, [logline, characters, exploredIds, savedPortraits, savedAnswers]);

  // Auto-persist when key state changes
  useEffect(() => {
    if (sessionId && characters.length > 0) {
      persistSession();
    }
  }, [sessionId, characters, exploredIds, savedPortraits, savedAnswers, persistSession]);

  // --- Spark Phase ---
  const handleSpark = useCallback(async (text: string) => {
    setLogline(text);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/spark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logline: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to spark');
      const withIds = data.map((c: Omit<Character, 'id'>, i: number) => ({
        ...c,
        id: `char-${i}`,
      }));
      // Create a new session
      const newId = createSessionId();
      setSessionId(newId);
      setCharacters(withIds);
      setSavedPortraits({});
      setSavedAnswers({});
      setExploredIds(new Set());
      setPhase('characters');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Resume a saved session ---
  const handleResumeSession = useCallback((session: StoredSession) => {
    setSessionId(session.id);
    setLogline(session.logline);
    setCharacters(session.characters);
    setExploredIds(new Set(session.exploredIds));
    setSavedPortraits(session.portraits);
    setSavedAnswers(session.answers ?? {});
    setPhase('characters');
  }, []);

  // --- Delete a saved session ---
  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id);
    const updated = getSessions();
    setSessions(updated);
    if (updated.length === 0) {
      setPhase('spark');
    }
  }, []);

  // --- Fetch a question for a given dimension index and question index ---
  const fetchQuestion = useCallback(async (character: Character, dimIndex: number, qIndex: number, prevAnswers: DimensionAnswer[]) => {
    setLoading(true);
    setError(null);
    try {
      // If we're at the contradiction dimension (index 6) and first question, fetch the insight
      if (dimIndex === 6 && qIndex === 0) {
        const insightRes = await fetch('/api/explore/contradiction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterName: character.name }),
        });
        if (insightRes.ok) {
          const insight = await insightRes.json();
          setContradictionInsight(insight);
        }
      }

      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: character.name,
          essence: character.essence,
          previousAnswers: prevAnswers.map(a => ({
            dimension: a.dimension,
            dimensionLabel: a.dimensionLabel,
            questionText: a.questionText,
            chosenText: a.chosenText,
          })),
          dimensionIndex: dimIndex,
          questionIndex: qIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get question');
      setCurrentQuestion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPhase('characters');
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Generate portrait from answers ---
  const generatePortrait = useCallback(async (character: Character, finalAnswers: DimensionAnswer[]) => {
    setLoading(true);
    setCurrentQuestion(null);
    try {
      const res = await fetch('/api/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: character.name,
          essence: character.essence,
          answers: finalAnswers.map(a => ({
            dimension: a.dimension,
            dimensionLabel: a.dimensionLabel,
            questionText: a.questionText,
            chosenText: a.chosenText,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate portrait');
      setPortrait({ character, data });
      setExploredIds(prev => new Set([...prev, character.id]));
      // Save portrait and answers to session
      setSavedPortraits(prev => ({ ...prev, [character.name]: data }));
      setSavedAnswers(prev => ({ ...prev, [character.name]: finalAnswers }));
      setPhase('portrait');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPhase('characters');
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Begin exploring a character ---
  const handleExploreCharacter = useCallback(async (character: Character) => {
    setExploreCharacter(character);
    setAnswers([]);
    setCurrentDimensionIndex(0);
    setCurrentQuestionIndex(0);
    setCurrentQuestion(null);
    setContradictionInsight(null);
    setPhase('explore');
    await fetchQuestion(character, 0, 0, []);
  }, [fetchQuestion]);

  // --- View a saved portrait ---
  const handleViewPortrait = useCallback((character: Character, data: PortraitType) => {
    setPortrait({ character, data });
    setPhase('portrait');
  }, []);

  // --- Advance after answering: next question in dimension, or next dimension, or portrait ---
  const advanceAfterAnswer = useCallback(async (
    character: Character,
    dimIndex: number,
    qIndex: number,
    totalQsInDim: number,
    updatedAnswers: DimensionAnswer[],
  ) => {
    const nextQIndex = qIndex + 1;

    if (nextQIndex < totalQsInDim) {
      setCurrentQuestionIndex(nextQIndex);
      setCurrentQuestion(null);
      await fetchQuestion(character, dimIndex, nextQIndex, updatedAnswers);
    } else {
      const nextDimIndex = dimIndex + 1;
      if (nextDimIndex >= TOTAL_DIMENSIONS) {
        await generatePortrait(character, updatedAnswers);
      } else {
        setCurrentDimensionIndex(nextDimIndex);
        setCurrentQuestionIndex(0);
        setCurrentQuestion(null);
        await fetchQuestion(character, nextDimIndex, 0, updatedAnswers);
      }
    }
  }, [fetchQuestion, generatePortrait]);

  // --- Handle a chosen option answer ---
  const handleAnswer = useCallback(async (optionText: string, optionId: string) => {
    if (!exploreCharacter || !currentQuestion) return;

    const sketchLine = currentQuestion.sketchLines?.[optionId] ?? optionText.slice(0, 80);

    const newAnswer: DimensionAnswer = {
      dimension: currentQuestion.dimension,
      dimensionLabel: currentQuestion.dimensionLabel,
      questionText: currentQuestion.question,
      chosenText: optionText,
      sketchLine,
      wasKleoAssisted: false,
      questionIndex: currentQuestionIndex,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    await advanceAfterAnswer(
      exploreCharacter,
      currentDimensionIndex,
      currentQuestionIndex,
      currentQuestion.totalQuestionsInDimension,
      updatedAnswers,
    );
  }, [exploreCharacter, currentQuestion, answers, currentDimensionIndex, currentQuestionIndex, advanceAfterAnswer]);

  // --- Handle a custom "write your own" answer ---
  const handleCustomAnswer = useCallback(async (text: string) => {
    if (!exploreCharacter || !currentQuestion) return;

    const sketchLine = text.slice(0, 80);

    const newAnswer: DimensionAnswer = {
      dimension: currentQuestion.dimension,
      dimensionLabel: currentQuestion.dimensionLabel,
      questionText: currentQuestion.question,
      chosenText: text,
      sketchLine,
      wasKleoAssisted: false,
      questionIndex: currentQuestionIndex,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    await advanceAfterAnswer(
      exploreCharacter,
      currentDimensionIndex,
      currentQuestionIndex,
      currentQuestion.totalQuestionsInDimension,
      updatedAnswers,
    );
  }, [exploreCharacter, currentQuestion, answers, currentDimensionIndex, currentQuestionIndex, advanceAfterAnswer]);

  // --- Skip current question, advance to next question or dimension ---
  const handleSkipQuestion = useCallback(async () => {
    if (!exploreCharacter) return;

    const totalQsInDim = currentQuestion?.totalQuestionsInDimension ?? 2;
    const nextQIndex = currentQuestionIndex + 1;

    if (nextQIndex < totalQsInDim) {
      setCurrentQuestionIndex(nextQIndex);
      setCurrentQuestion(null);
      await fetchQuestion(exploreCharacter, currentDimensionIndex, nextQIndex, answers);
    } else {
      const nextDimIndex = currentDimensionIndex + 1;
      if (nextDimIndex >= TOTAL_DIMENSIONS) {
        await generatePortrait(exploreCharacter, answers);
      } else {
        setCurrentDimensionIndex(nextDimIndex);
        setCurrentQuestionIndex(0);
        setCurrentQuestion(null);
        await fetchQuestion(exploreCharacter, nextDimIndex, 0, answers);
      }
    }
  }, [exploreCharacter, currentQuestion, currentQuestionIndex, currentDimensionIndex, answers, fetchQuestion, generatePortrait]);

  // --- Jump to next dimension regardless of questions answered ---
  const handleNextDimension = useCallback(async () => {
    if (!exploreCharacter) return;

    const nextDimIndex = currentDimensionIndex + 1;
    if (nextDimIndex >= TOTAL_DIMENSIONS) {
      await generatePortrait(exploreCharacter, answers);
    } else {
      setCurrentDimensionIndex(nextDimIndex);
      setCurrentQuestionIndex(0);
      setCurrentQuestion(null);

      if (nextDimIndex === 6) {
        try {
          const insightRes = await fetch('/api/explore/contradiction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterName: exploreCharacter.name }),
          });
          if (insightRes.ok) {
            const insight = await insightRes.json();
            setContradictionInsight(insight);
          }
        } catch {
          // Non-critical
        }
      }

      await fetchQuestion(exploreCharacter, nextDimIndex, 0, answers);
    }
  }, [exploreCharacter, currentDimensionIndex, answers, fetchQuestion, generatePortrait]);

  // --- Navigation ---
  const handleBackToCharacters = useCallback(() => {
    setPhase('characters');
    setExploreCharacter(null);
    setAnswers([]);
    setCurrentQuestion(null);
    setContradictionInsight(null);
    setPortrait(null);
  }, []);

  const handleBackToProjects = useCallback(() => {
    setSessions(getSessions());
    setPhase('projects');
    setExploreCharacter(null);
    setAnswers([]);
    setCurrentQuestion(null);
    setContradictionInsight(null);
    setPortrait(null);
    setSessionId(null);
    setLogline('');
    setCharacters([]);
    setExploredIds(new Set());
    setSavedPortraits({});
    setSavedAnswers({});
    setError(null);
  }, []);

  const handleNewProject = useCallback(() => {
    setSessionId(null);
    setLogline('');
    setCharacters([]);
    setExploredIds(new Set());
    setSavedPortraits({});
    setSavedAnswers({});
    setExploreCharacter(null);
    setAnswers([]);
    setCurrentQuestion(null);
    setContradictionInsight(null);
    setPortrait(null);
    setError(null);
    setPhase('spark');
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <ModuleNav
        sessionId={sessionId}
        subtitle={logline && phase !== 'spark' && phase !== 'projects' ? logline : undefined}
      />

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">

        {/* PROJECTS PHASE — saved sessions */}
        {phase === 'projects' && (
          <div
            className="w-full max-w-3xl mx-auto transition-opacity duration-500"
            style={{ opacity: mounted ? 1 : 0 }}
          >
            <div className="text-center mb-12">
              <h2
                className="text-xs uppercase tracking-[0.3em] mb-2"
                style={{ color: '#2c2f38' }}
              >
                Your Projects
              </h2>
              <div className="w-8 h-px mx-auto mb-6" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <button
                onClick={handleNewProject}
                className="px-5 py-2.5 text-xs font-medium uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                style={{
                  backgroundColor: 'rgba(196, 92, 74, 0.1)',
                  color: '#c45c4a',
                  border: '1px solid rgba(196, 92, 74, 0.2)',
                }}
              >
                + New Project
              </button>
            </div>

            <div className="flex flex-col gap-3 px-4">
              {sessions.map((s) => {
                const exploredCount = s.exploredIds.length;
                const totalChars = s.characters.length;
                const portraitCount = Object.keys(s.portraits).length;
                return (
                  <div
                    key={s.id}
                    className="group p-5 bg-surface border border-border rounded-xl hover:border-border-2 transition-all cursor-pointer"
                    onClick={() => handleResumeSession(s)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text leading-relaxed mb-2 italic">
                          &ldquo;{s.logline}&rdquo;
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-text-3">
                            {totalChars} characters
                          </span>
                          {exploredCount > 0 && (
                            <span className="text-xs text-text-3">
                              {exploredCount} explored
                            </span>
                          )}
                          {portraitCount > 0 && (
                            <span className="text-xs" style={{ color: '#c45c4a' }}>
                              {portraitCount} portrait{portraitCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {/* Character color dots */}
                        <div className="flex gap-1.5 mt-3">
                          {s.characters.map((c) => (
                            <div
                              key={c.id}
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor: c.color,
                                opacity: s.exploredIds.includes(c.id) ? 1 : 0.3,
                              }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-text-3 uppercase tracking-wider">
                          {new Date(s.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(s.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-xs text-text-3 hover:text-red-400 transition-all cursor-pointer px-2 py-1"
                          title="Delete project"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SPARK PHASE — no framer-motion, pure CSS */}
        {phase === 'spark' && (
          <div
            className="w-full flex flex-col items-center justify-center transition-opacity duration-500"
            style={{ opacity: mounted ? 1 : 0 }}
          >
            <div className="mb-16 text-center">
              <h2
                className="text-xs uppercase tracking-[0.3em] mb-2"
                style={{ color: '#2c2f38' }}
              >
                Character Discovery
              </h2>
              <div className="w-8 h-px mx-auto" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {error && (
              <div
                className="w-full max-w-lg mx-auto mb-8 p-4 rounded-lg border"
                style={{ background: 'rgba(204,95,95,0.12)', borderColor: 'rgba(204,95,95,0.3)' }}
              >
                <p className="text-sm text-center" style={{ color: '#e87c7c' }}>{error}</p>
              </div>
            )}

            {loading ? (
              <LoadingState messages={[
                'Reading between your lines...',
                'Finding the people in your story...',
                'Every sentence hides a character...',
                'Discovering who wants to be written...',
              ]} />
            ) : (
              <SparkInput onSubmit={handleSpark} isLoading={loading} />
            )}
          </div>
        )}

        {/* CHARACTERS PHASE */}
        {phase === 'characters' && (
          <div className="w-full max-w-4xl mx-auto animate-fade-in">
            <div className="text-center mb-10">
              <h2 className="text-xl font-light mb-2" style={{ color: '#8a8578' }}>
                The people hiding in your story
              </h2>
              <p className="text-xs" style={{ color: '#4a4740' }}>Click a character to explore their inner world</p>
            </div>

            {error && (
              <div
                className="w-full max-w-lg mx-auto mb-8 p-4 rounded-lg border"
                style={{ background: 'rgba(204,95,95,0.12)', borderColor: 'rgba(204,95,95,0.3)' }}
              >
                <p className="text-sm text-center" style={{ color: '#e87c7c' }}>{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4">
              {characters.map((char, i) => (
                <CharacterCard
                  key={char.id}
                  name={char.name}
                  essence={char.essence}
                  spark={char.spark}
                  role={char.role}
                  color={char.color}
                  index={i}
                  onExplore={() => {
                    // If portrait exists, view it; otherwise explore
                    const existingPortrait = savedPortraits[char.name];
                    if (existingPortrait) {
                      handleViewPortrait(char, existingPortrait);
                    } else {
                      handleExploreCharacter(char);
                    }
                  }}
                  isExplored={exploredIds.has(char.id)}
                />
              ))}
            </div>

            {exploredIds.size > 0 && (
              <div className="text-center mt-8">
                <p className="text-xs" style={{ color: '#4a4740' }}>
                  {exploredIds.size} of {characters.length} characters explored
                </p>
              </div>
            )}
          </div>
        )}

        {/* EXPLORE PHASE */}
        {phase === 'explore' && exploreCharacter && (
          <div className="w-full max-w-5xl mx-auto animate-fade-in">
            {/* Character header */}
            <div className="flex items-center gap-3 mb-8 px-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ backgroundColor: exploreCharacter.color + '20', color: exploreCharacter.color }}
              >
                {exploreCharacter.name[0]}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: exploreCharacter.color }}>
                  Exploring {exploreCharacter.name}
                </div>
                <div className="text-xs italic" style={{ color: '#4a4740' }}>{exploreCharacter.essence}</div>
              </div>
              <button
                onClick={handleBackToCharacters}
                className="ml-auto text-xs uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer"
                style={{ color: '#2c2f38' }}
              >
                Back
              </button>
            </div>

            {/* Three-column layout: trail | question | sketch */}
            <div className="flex flex-col md:flex-row gap-6 px-4">
              {/* Discovery trail — desktop only */}
              {answers.length > 0 && (
                <div className="hidden md:block w-44 shrink-0">
                  <div className="text-xs uppercase tracking-wider mb-3 font-medium" style={{ color: '#2c2f38' }}>Trail</div>
                  <DiscoveryTrail answers={answers} characterColor={exploreCharacter.color} />
                </div>
              )}

              {/* Question area — center */}
              <div className="flex-1 min-w-0">
                {loading && !currentQuestion ? (
                  <LoadingState messages={[
                    `Getting to know ${exploreCharacter.name}...`,
                    'Crafting the right question...',
                    'Looking for contradictions...',
                    'Finding what hasn\'t been asked yet...',
                  ]} />
                ) : currentQuestion ? (
                  <QuestionCard
                    question={currentQuestion.question}
                    options={currentQuestion.options}
                    mode={currentQuestion.mode}
                    dimension={currentQuestion.dimension}
                    dimensionLabel={currentQuestion.dimensionLabel}
                    dimensionIndex={currentDimensionIndex}
                    totalDimensions={TOTAL_DIMENSIONS}
                    questionIndex={currentQuestionIndex}
                    totalQuestionsInDimension={currentQuestion.totalQuestionsInDimension}
                    characterName={exploreCharacter.name}
                    characterColor={exploreCharacter.color}
                    kleo={currentQuestion.kleo}
                    contradictionInsight={currentDimensionIndex === 6 ? contradictionInsight : null}
                    nextDimensionLabel={currentDimensionIndex < TOTAL_DIMENSIONS - 1 ? DIMENSIONS[currentDimensionIndex + 1].label : undefined}
                    isLastDimension={currentDimensionIndex === TOTAL_DIMENSIONS - 1}
                    onChoose={handleAnswer}
                    onCustomAnswer={handleCustomAnswer}
                    onSkipQuestion={handleSkipQuestion}
                    onNextDimension={handleNextDimension}
                    isLoading={loading}
                  />
                ) : loading ? (
                  <LoadingState messages={[
                    `Synthesizing everything about ${exploreCharacter.name}...`,
                    'Weaving the portrait...',
                    'Finding the thread that ties it all together...',
                    'Making them feel alive...',
                  ]} />
                ) : null}
              </div>

              {/* Character figure + sketch — right on desktop, below on mobile */}
              <div className="w-full md:w-72 shrink-0 flex flex-col gap-4">
                <CharacterFigure
                  characterColor={exploreCharacter.color}
                  answeredDimensions={new Set(answers.map(a => a.dimension))}
                  allDimensions={DIMENSIONS}
                />
                <CharacterSketch
                  characterName={exploreCharacter.name}
                  characterColor={exploreCharacter.color}
                  answers={answers}
                  allDimensions={DIMENSIONS}
                />
              </div>
            </div>
          </div>
        )}

        {/* PORTRAIT PHASE */}
        {phase === 'portrait' && portrait && (
          <div className="w-full py-8 animate-fade-in">
            <CharacterPortrait
              name={portrait.character.name}
              color={portrait.character.color}
              portrait={portrait.data}
              onBack={handleBackToCharacters}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] tracking-wider uppercase" style={{ color: '#2c2f38' }}>
          SceneFlow — Story Intelligence System
        </p>
      </footer>
    </div>
  );
}
