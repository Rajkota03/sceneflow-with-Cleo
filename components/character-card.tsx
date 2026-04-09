'use client';
import { motion } from 'framer-motion';

interface CharacterCardProps {
  name: string;
  essence: string;
  spark: string;
  role: string;
  color: string;
  index: number;
  onExplore: () => void;
  isExplored?: boolean;
}

export function CharacterCard({ name, essence, spark, role, color, index, onExplore, isExplored }: CharacterCardProps) {
  return (
    <motion.div
      className="relative bg-surface border border-border rounded-xl p-5 cursor-pointer group overflow-hidden"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, borderColor: 'rgba(255,255,255,0.1)' }}
      onClick={onExplore}
      style={{ borderLeftColor: color, borderLeftWidth: '2px' }}
    >
      {/* Explored indicator */}
      {isExplored && (
        <motion.div
          className="absolute top-3 right-3 text-green text-sm"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          ✓
        </motion.div>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: color + '20', color }}
        >
          {name[0]}
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color }}>{name}</div>
          <div className="text-xs text-text-3 uppercase tracking-wide">{role}</div>
        </div>
      </div>

      {/* Essence */}
      <p className="text-sm text-text-2 leading-relaxed mb-3 italic">&ldquo;{essence}&rdquo;</p>

      {/* Spark */}
      <p className="text-xs text-text-3 leading-relaxed">{spark}</p>

      {/* Explore prompt */}
      <motion.div
        className="mt-4 pt-3 border-t border-border flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.15 + 0.3 }}
      >
        <span className="text-xs text-text-4 uppercase tracking-wider font-medium">
          {isExplored ? 'Explored' : 'Click to explore'}
        </span>
        <motion.span
          className="text-text-4 text-xs"
          animate={{ x: [0, 4, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          →
        </motion.span>
      </motion.div>

      {/* Subtle glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
        style={{ background: `radial-gradient(ellipse at 50% 100%, ${color}08 0%, transparent 70%)` }}
      />
    </motion.div>
  );
}
