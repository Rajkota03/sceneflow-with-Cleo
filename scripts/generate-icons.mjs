// Generate PWA icons using built-in node + sharp-free approach
// Creates simple terracotta "SF" icon PNGs via SVG → data URL → puppeteer-free

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');

function createSVG(size, maskable = false) {
  const padding = maskable ? size * 0.2 : 0;
  const innerSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = innerSize * 0.38;
  const radius = maskable ? 0 : size * 0.18;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#13120f"/>
  <text x="${cx}" y="${cy + fontSize * 0.35}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="#c45c4a">SF</text>
  <rect x="${padding + innerSize * 0.15}" y="${cy + fontSize * 0.55}" width="${innerSize * 0.7}" height="${innerSize * 0.025}" rx="1" fill="#c45c4a" opacity="0.5"/>
</svg>`;
}

// Write SVGs (fallback — also used directly)
writeFileSync(join(iconsDir, 'icon-192.svg'), createSVG(192));
writeFileSync(join(iconsDir, 'icon-512.svg'), createSVG(512));
writeFileSync(join(iconsDir, 'icon-maskable-512.svg'), createSVG(512, true));

console.log('SVG icons written to public/icons/');
console.log('To convert to PNG, run in browser or use: npx svg2png-many');
