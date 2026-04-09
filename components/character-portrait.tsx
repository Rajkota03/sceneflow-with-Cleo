'use client';
import { motion } from 'framer-motion';
import { DIMENSIONS } from '@/lib/types';
import type { CharacterPortrait as CharacterPortraitType } from '@/lib/types';

interface PortraitProps {
  name: string;
  color: string;
  portrait: CharacterPortraitType;
  onBack: () => void;
}

export function CharacterPortrait({ name, color, portrait, onBack }: PortraitProps) {
  return (
    <motion.div
      className="w-full max-w-2xl mx-auto px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold"
          style={{ backgroundColor: color + '20', color }}
        >
          {name[0]}
        </div>
        <h2 className="text-2xl font-light" style={{ color }}>
          {name}
        </h2>
        <p className="text-sm text-text-2 mt-2 italic">{portrait.essence}</p>
      </motion.div>

      {/* Prose portrait */}
      <motion.div
        className="mb-10 p-6 bg-surface border border-border rounded-xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="text-xs text-text-3 uppercase tracking-wider font-semibold mb-3">
          Portrait
        </div>
        {portrait.prose
          .split('\n')
          .filter(Boolean)
          .map((para, i) => (
            <p
              key={i}
              className="text-sm text-text-2 leading-relaxed mb-3 last:mb-0"
            >
              {para}
            </p>
          ))}
      </motion.div>

      {/* Dimension cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        {DIMENSIONS.map((dim, i) => {
          const content = portrait.dimensions[dim.id];
          if (!content) return null;

          return (
            <motion.div
              key={dim.id}
              className="p-4 bg-surface border border-border rounded-lg"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-text-3 uppercase tracking-wider font-semibold">
                  {dim.label}
                </span>
              </div>
              <p className="text-xs text-text-2 leading-relaxed">{content}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Unanswered question */}
      {portrait.unansweredQuestion && (
        <motion.div
          className="mb-10 p-5 rounded-lg border"
          style={{
            backgroundColor: 'rgba(196, 92, 74, 0.05)',
            borderColor: 'rgba(196, 92, 74, 0.18)',
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-gold" />
            <span className="text-xs text-gold uppercase tracking-wider font-medium">
              The unanswered question
            </span>
          </div>
          <p className="text-sm text-text italic leading-relaxed">
            {portrait.unansweredQuestion}
          </p>
        </motion.div>
      )}

      {/* Back button */}
      <motion.div
        className="flex justify-center pb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-surface border border-border-2 rounded-lg text-xs font-medium tracking-wide uppercase text-text-2 hover:bg-surface-2 hover:text-text transition-all cursor-pointer"
        >
          &larr; Back to Characters
        </button>
      </motion.div>
    </motion.div>
  );
}
