'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { Dimension, DimensionAnswer } from '@/lib/types';

interface CharacterSketchProps {
  characterName: string;
  characterColor: string;
  answers: DimensionAnswer[];
  allDimensions: Dimension[];
}

export function CharacterSketch({
  characterName,
  characterColor,
  answers,
  allDimensions,
}: CharacterSketchProps) {
  // Group answers by dimension — multiple answers per dimension possible
  const answersByDimension = new Map<string, DimensionAnswer[]>();
  for (const a of answers) {
    const existing = answersByDimension.get(a.dimension) ?? [];
    existing.push(a);
    answersByDimension.set(a.dimension, existing);
  }

  const answeredDimCount = answersByDimension.size;

  return (
    <motion.div
      className="w-full bg-surface border border-border rounded-xl p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="mb-5">
        <h3
          className="text-lg font-light tracking-wide"
          style={{ color: characterColor }}
        >
          {characterName}
        </h3>
        <p className="text-xs text-text-3 uppercase tracking-wider mt-1">
          Character sketch
        </p>
      </div>

      {/* Dimension lines */}
      <div className="flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {allDimensions.map((dim, i) => {
            const dimAnswers = answersByDimension.get(dim.id);
            const isAnswered = !!dimAnswers && dimAnswers.length > 0;

            return (
              <motion.div
                key={dim.id}
                className="relative"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
                layout
              >
                {/* Sketch label */}
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-1 h-1 rounded-full shrink-0"
                    style={{
                      backgroundColor: isAnswered
                        ? characterColor
                        : 'var(--color-text-3)',
                    }}
                  />
                  <span
                    className="text-xs uppercase tracking-wider font-medium"
                    style={{
                      color: isAnswered
                        ? 'var(--color-text-2)'
                        : 'var(--color-text-3)',
                    }}
                  >
                    {dim.sketchLabel}
                  </span>
                </div>

                {/* Content — show all sketch lines for this dimension */}
                <AnimatePresence mode="wait">
                  {isAnswered && dimAnswers ? (
                    <motion.div
                      key={`filled-${dim.id}-${dimAnswers.length}`}
                      className="pl-3 border-l flex flex-col gap-1.5"
                      style={{ borderColor: characterColor + '30' }}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                      {dimAnswers.map((a, j) => (
                        <p
                          key={`${dim.id}-${j}`}
                          className="text-sm text-text leading-relaxed"
                          style={j > 0 ? { opacity: 0.75 } : undefined}
                        >
                          {a.sketchLine}
                        </p>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.p
                      key={`empty-${dim.id}`}
                      className="text-sm text-text-3 pl-3 border-l border-border"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                    >
                      ...
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Progress footer */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-3">
            {answeredDimCount} of {allDimensions.length} dimensions
          </span>
          <div className="flex gap-1">
            {allDimensions.map((dim) => (
              <div
                key={dim.id}
                className="w-4 h-0.5 rounded-full transition-colors duration-500"
                style={{
                  backgroundColor: answersByDimension.has(dim.id)
                    ? characterColor
                    : 'var(--color-border-2)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
