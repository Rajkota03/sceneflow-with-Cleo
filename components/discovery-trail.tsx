'use client';
import { motion } from 'framer-motion';
import type { DimensionAnswer } from '@/lib/types';

interface DiscoveryTrailProps {
  answers: DimensionAnswer[];
  characterColor: string;
}

export function DiscoveryTrail({ answers, characterColor }: DiscoveryTrailProps) {
  if (answers.length === 0) return null;

  return (
    <div className="relative pl-4">
      {/* Vertical line */}
      <div
        className="absolute left-0 top-2 bottom-2 w-px"
        style={{ backgroundColor: characterColor + '30' }}
      />

      <div className="flex flex-col gap-4">
        {answers.map((a, i) => (
          <motion.div
            key={`${a.dimension}-${i}`}
            className="relative"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            {/* Dot on the line */}
            <div
              className="absolute -left-4 top-1 w-2 h-2 rounded-full -translate-x-1/2"
              style={{ backgroundColor: characterColor }}
            />

            {/* Dimension label */}
            <div className="text-[10px] text-text-3 uppercase tracking-wider font-medium mb-0.5">
              {a.dimensionLabel}
            </div>

            {/* Question (truncated) */}
            <div className="text-xs text-text-3 mb-1 italic">
              {a.questionText.length > 60
                ? a.questionText.slice(0, 60) + '...'
                : a.questionText}
            </div>

            {/* Answer (truncated) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-2">
                {a.chosenText.length > 80
                  ? a.chosenText.slice(0, 80) + '...'
                  : a.chosenText}
              </span>
              {a.wasKleoAssisted && (
                <span
                  className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider"
                  style={{
                    backgroundColor: 'rgba(196, 92, 74, 0.1)',
                    color: 'var(--color-gold)',
                  }}
                >
                  Kleo
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
