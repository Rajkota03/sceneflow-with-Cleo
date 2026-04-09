'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  DimensionId,
  QuestionOption,
  QuestionMode,
  KleoSuggestion,
  ContradictionInsight,
} from '@/lib/types';
import { getEpigraph } from '@/lib/dimension-themes';

interface QuestionCardProps {
  question: string;
  options: QuestionOption[];
  mode: QuestionMode;
  dimension: DimensionId;
  dimensionLabel: string;
  dimensionIndex: number;
  totalDimensions: number;
  questionIndex: number;
  totalQuestionsInDimension: number;
  characterName: string;
  characterColor: string;
  kleo: KleoSuggestion;
  contradictionInsight?: ContradictionInsight | null;
  nextDimensionLabel?: string;
  isLastDimension: boolean;
  onChoose: (optionText: string, optionId: string) => void;
  onCustomAnswer: (text: string) => void;
  onSkipQuestion: () => void;
  onNextDimension: () => void;
  isLoading: boolean;
}

export function QuestionCard({
  question,
  options,
  mode,
  dimension,
  dimensionLabel,
  dimensionIndex,
  totalDimensions,
  questionIndex,
  totalQuestionsInDimension,
  characterName,
  characterColor,
  kleo,
  contradictionInsight,
  nextDimensionLabel,
  isLastDimension,
  onChoose,
  onCustomAnswer,
  onSkipQuestion,
  onNextDimension,
  isLoading,
}: QuestionCardProps) {
  const [writeOpen, setWriteOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [kleoOpen, setKleoOpen] = useState(false);
  const openTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the open-mode textarea when it mounts
  useEffect(() => {
    if (mode === 'open' && openTextareaRef.current) {
      openTextareaRef.current.focus();
    }
  }, [mode, dimension, questionIndex]);

  // Reset local state when question changes
  useEffect(() => {
    setWriteOpen(false);
    setCustomText('');
    setKleoOpen(false);
  }, [dimension, questionIndex]);

  const handleCustomSubmit = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    onCustomAnswer(trimmed);
    setCustomText('');
    setWriteOpen(false);
  };

  const handleUseKleo = () => {
    onCustomAnswer(kleo.answer);
    setKleoOpen(false);
  };

  const cardTransition = { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const };
  const epigraph = getEpigraph(dimension, questionIndex);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="w-full max-w-xl mx-auto"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={cardTransition}
        key={`${dimension}-${questionIndex}`}
      >
        {/* Dimension epigraph — a quote that sets the mood */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          key={`epigraph-${dimension}-${questionIndex}`}
        >
          <p className="text-sm italic leading-relaxed" style={{ color: characterColor, opacity: 0.5 }}>
            &ldquo;{epigraph.text}&rdquo;
          </p>
          <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: characterColor, opacity: 0.3 }}>
            &mdash; {epigraph.source}
          </p>
        </motion.div>

        {/* Progress: dimension dots + question count */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex gap-2">
            {Array.from({ length: totalDimensions }).map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    i < dimensionIndex
                      ? characterColor
                      : i === dimensionIndex
                        ? characterColor
                        : 'var(--color-border-2)',
                }}
                animate={
                  i === dimensionIndex
                    ? { scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }
                    : {}
                }
                transition={
                  i === dimensionIndex
                    ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }
                    : {}
                }
              />
            ))}
          </div>
          <span className="text-xs text-text-2 uppercase tracking-wider font-medium">
            {dimensionLabel} &middot; Question {questionIndex + 1} of{' '}
            {totalQuestionsInDimension}
          </span>
        </div>

        {/* Contradiction insight */}
        <AnimatePresence>
          {contradictionInsight && (
            <motion.div
              className="mb-6 p-4 rounded-lg border"
              style={{
                backgroundColor: 'rgba(196, 92, 74, 0.06)',
                borderColor: 'rgba(196, 92, 74, 0.2)',
              }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                <span className="text-xs text-gold uppercase tracking-wider font-medium">
                  Kleo noticed something
                </span>
              </div>
              <p className="text-sm text-text italic leading-relaxed">
                {contradictionInsight.observation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question */}
        <motion.h2
          className="text-xl md:text-2xl font-light text-text leading-relaxed mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {question}
        </motion.h2>

        {/* === OPEN MODE: textarea is primary input === */}
        {mode === 'open' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <div className="vintage-editor-wrap border rounded-lg p-5">
              <textarea
                ref={openTextareaRef}
                className="vintage-editor w-full bg-transparent text-base resize-none outline-none min-h-[140px] border-none"
                placeholder="Begin writing..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleCustomSubmit();
                  }
                }}
              />
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--color-parchment-border)' }}>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-faint)' }}>
                  {'\u2318'} + Enter to submit
                </span>
                <button
                  className="px-4 py-2 text-xs font-medium rounded-md transition-all cursor-pointer disabled:opacity-40"
                  style={{
                    backgroundColor: characterColor + '20',
                    color: characterColor,
                  }}
                  onClick={handleCustomSubmit}
                  disabled={isLoading || !customText.trim()}
                >
                  Submit
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* === GUIDED MODE: option buttons + write your own toggle === */}
        {mode === 'guided' && (
          <>
            <div className="flex flex-col gap-3">
              {options.map((opt, i) => (
                <motion.button
                  key={opt.id}
                  className="text-left p-4 bg-surface-2 border border-border rounded-lg text-sm text-text-2 leading-relaxed hover:bg-surface-3 hover:text-text hover:border-border-2 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                  onClick={() => onChoose(opt.text, opt.id)}
                  disabled={isLoading}
                  whileHover={{ x: 4 }}
                >
                  {opt.text}
                </motion.button>
              ))}
            </div>

            {/* Write your own */}
            <motion.div
              className="mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <AnimatePresence mode="wait">
                {!writeOpen ? (
                  <motion.button
                    key="write-trigger"
                    className="text-xs text-text-3 hover:text-text-2 transition-colors cursor-pointer py-2"
                    onClick={() => setWriteOpen(true)}
                    disabled={isLoading}
                    exit={{ opacity: 0 }}
                  >
                    Write your own answer
                  </motion.button>
                ) : (
                  <motion.div
                    key="write-area"
                    className="vintage-editor-wrap border rounded-lg p-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <textarea
                      className="vintage-editor w-full bg-transparent text-base resize-none outline-none min-h-[100px] border-none"
                      placeholder="In your own words..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      autoFocus
                      disabled={isLoading}
                    />
                    <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--color-parchment-border)' }}>
                      <button
                        className="text-xs hover:opacity-80 transition-opacity cursor-pointer"
                        style={{ color: 'var(--color-ink-faint)' }}
                        onClick={() => {
                          setWriteOpen(false);
                          setCustomText('');
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer disabled:opacity-40"
                        style={{
                          backgroundColor: characterColor + '18',
                          color: characterColor,
                        }}
                        onClick={handleCustomSubmit}
                        disabled={isLoading || !customText.trim()}
                      >
                        Submit
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}

        {/* Divider */}
        <div className="my-5 border-t border-border" />

        {/* Ask Kleo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: mode === 'open' ? 0.5 : 0.7 }}
        >
          <AnimatePresence mode="wait">
            {!kleoOpen ? (
              <motion.button
                key="kleo-trigger"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: 'rgba(196, 92, 74, 0.08)',
                  color: 'var(--color-gold)',
                  boxShadow: '0 0 20px rgba(196, 92, 74, 0.06)',
                }}
                onClick={() => setKleoOpen(true)}
                disabled={isLoading}
                whileHover={{
                  boxShadow: '0 0 24px rgba(196, 92, 74, 0.12)',
                }}
                exit={{ opacity: 0 }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-gold)' }}
                />
                Ask Kleo for help
              </motion.button>
            ) : (
              <motion.div
                key="kleo-suggestion"
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: 'rgba(196, 92, 74, 0.05)',
                  borderColor: 'rgba(196, 92, 74, 0.15)',
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                  <span className="text-xs text-gold uppercase tracking-wider font-medium">
                    Kleo suggests
                  </span>
                </div>
                <p className="text-sm text-text leading-relaxed mb-2">
                  {kleo.answer}
                </p>
                <p className="text-xs text-text-2 italic leading-relaxed mb-4">
                  {kleo.reasoning}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer"
                    style={{
                      backgroundColor: 'rgba(196, 92, 74, 0.15)',
                      color: 'var(--color-gold)',
                    }}
                    onClick={handleUseKleo}
                    disabled={isLoading}
                  >
                    Use this answer
                  </button>
                  <button
                    className="text-xs text-text-3 hover:text-text-2 transition-colors cursor-pointer"
                    onClick={() => setKleoOpen(false)}
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            className="mt-6 text-center text-sm text-text-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="flex items-center justify-center gap-2">
              <motion.span
                className="w-1 h-1 bg-gold rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1 }}
              />
              <motion.span
                className="w-1 h-1 bg-gold rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1, delay: 0.15 }}
              />
              <motion.span
                className="w-1 h-1 bg-gold rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1, delay: 0.3 }}
              />
              Going deeper...
            </span>
          </motion.div>
        )}

        {/* Navigation bar */}
        <motion.div
          className="flex items-center justify-between mt-8 pt-5 border-t border-border"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: mode === 'open' ? 0.6 : 0.8 }}
        >
          <button
            className="text-xs text-text-3 hover:text-text-2 transition-colors cursor-pointer py-2"
            onClick={onSkipQuestion}
            disabled={isLoading}
          >
            Skip this question
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: characterColor + '14',
              color: characterColor,
              border: `1px solid ${characterColor}25`,
            }}
            onClick={onNextDimension}
            disabled={isLoading}
          >
            <span>
              {isLastDimension
                ? 'Generate Portrait'
                : `Next: ${nextDimensionLabel}`}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
