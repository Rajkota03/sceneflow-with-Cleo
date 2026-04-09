'use client';

import { motion } from 'framer-motion';
import type { Dimension, DimensionId } from '@/lib/types';

// Each dimension maps to a body region with SVG paths forming a stylized human silhouette
// viewBox: 0 0 200 420
const BODY_REGIONS: Record<DimensionId, { paths: string[]; label: string }> = {
  // Heart/chest — the deepest, most central wound
  wound: {
    paths: [
      // Upper chest / heart region
      'M70 150 L95 150 L105 150 L130 150 C135 150 138 155 138 160 L138 200 C138 205 135 208 132 208 L68 208 C65 208 62 205 62 200 L62 160 C62 155 65 150 70 150 Z',
    ],
    label: 'Wound',
  },

  // Head/brain — beliefs live in the mind
  lie: {
    paths: [
      // Head: rounded shape with slight jaw
      'M100 30 C120 30 135 45 135 65 C135 80 130 95 120 105 C115 110 105 115 100 115 C95 115 85 110 80 105 C70 95 65 80 65 65 C65 45 80 30 100 30 Z',
    ],
    label: 'Lie',
  },

  // Core/stomach — gut drive, primal hunger
  drive: {
    paths: [
      // Belly / core area
      'M68 208 L132 208 C135 208 136 212 136 215 L136 260 C136 264 133 268 130 268 L70 268 C67 268 64 264 64 260 L64 215 C64 212 65 208 68 208 Z',
    ],
    label: 'Drive',
  },

  // Face overlay — a mask/visor over the head
  mask: {
    paths: [
      // Simple face-mask shape overlaying the head
      'M80 50 C80 45 88 40 100 40 C112 40 120 45 120 50 L120 85 C120 92 112 98 100 98 C88 98 80 92 80 85 Z',
    ],
    label: 'Mask',
  },

  // Throat/neck — voice
  voice: {
    paths: [
      // Neck connecting head to torso
      'M88 115 C88 115 90 118 90 125 L90 145 C90 148 92 150 95 150 L105 150 C108 150 110 148 110 145 L110 125 C110 118 112 115 112 115 Z',
    ],
    label: 'Voice',
  },

  // Legs/feet — how they move through space
  body: {
    paths: [
      // Left leg
      'M70 268 L96 268 L93 310 C92 325 88 350 85 365 C83 375 78 390 75 395 C72 398 66 398 65 392 C64 385 68 370 70 355 C72 340 70 320 68 305 L64 268 Z',
      // Right leg
      'M104 268 L130 268 L136 268 L132 305 C130 320 128 340 130 355 C132 370 136 385 135 392 C134 398 128 398 125 395 C122 390 117 375 115 365 C112 350 108 325 107 310 L104 268 Z',
    ],
    label: 'Body',
  },

  // Arms/hands — how they reach for or push away others
  relationships: {
    paths: [
      // Left arm — shoulder to hand, slightly curved outward
      'M62 158 L50 165 C42 170 30 195 25 220 C22 232 20 248 24 255 C28 260 34 258 36 252 C40 238 44 220 50 205 C53 198 56 192 58 188 L62 180 Z',
      // Right arm — mirror
      'M138 158 L150 165 C158 170 170 195 175 220 C178 232 180 248 176 255 C172 260 166 258 164 252 C160 238 156 220 150 205 C147 198 144 192 142 188 L138 180 Z',
    ],
    label: 'Relationships',
  },

  // Spine/backbone — the through-line of change
  arc: {
    paths: [
      // Spine running down the center of the back
      'M96 150 L104 150 L104 268 L96 268 Z',
    ],
    label: 'Arc',
  },
};

// Render order: spine first (behind), then body parts on top in logical layer order
const RENDER_ORDER: DimensionId[] = [
  'arc',
  'body',
  'drive',
  'wound',
  'voice',
  'lie',
  'mask',
  'relationships',
];

interface CharacterFigureProps {
  characterColor: string;
  answeredDimensions: Set<DimensionId>;
  allDimensions: Dimension[];
}

export function CharacterFigure({
  characterColor,
  answeredDimensions,
  allDimensions,
}: CharacterFigureProps) {
  return (
    <div className="w-full bg-surface border border-border rounded-xl p-5">
      <div className="text-xs text-text-3 uppercase tracking-wider mb-3 font-medium">
        Character taking shape
      </div>
      <svg
        viewBox="0 0 200 420"
        className="w-full max-w-[160px] mx-auto"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {RENDER_ORDER.map((dimId) => {
          const isAnswered = answeredDimensions.has(dimId);
          const region = BODY_REGIONS[dimId];

          return (
            <motion.g key={dimId}>
              {region.paths.map((d, i) => (
                <motion.path
                  key={i}
                  d={d}
                  fill={isAnswered ? characterColor : 'transparent'}
                  stroke={isAnswered ? characterColor : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isAnswered ? 0 : 1}
                  initial={false}
                  animate={{
                    fillOpacity: isAnswered ? 0.5 : 0,
                    strokeOpacity: isAnswered ? 0 : 1,
                    filter: isAnswered
                      ? `drop-shadow(0 0 8px ${characterColor}40)`
                      : 'none',
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              ))}
            </motion.g>
          );
        })}
      </svg>

      <div className="text-center mt-3">
        <span className="text-xs text-text-3">
          {answeredDimensions.size} of {allDimensions.length} dimensions
        </span>
      </div>
    </div>
  );
}
