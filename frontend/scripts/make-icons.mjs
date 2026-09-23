// Generates favicon.svg + PWA/apple-touch PNG icons from one SVG template.
// Run: npm run icons   (writes into public/)
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(FRONTEND, "public");
const ICONS = join(PUB, "icons");

// rx: corner radius of the background (0 = full-bleed square for apple/maskable,
//     which apply their own mask). scale: shrink content into the safe zone.
function svgIcon({ rx, scale }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="die" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f59e0b"/>
      <stop offset="1" stop-color="#b45309"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.85">
      <stop offset="0" stop-color="#2b2418"/>
      <stop offset="1" stop-color="#12100b"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#glow)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <circle cx="256" cy="256" r="196" fill="none" stroke="#d97706" stroke-opacity="0.32"
      stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round"/>
    <g stroke="#d97706" stroke-width="14" stroke-linecap="round" stroke-opacity="0.85">
      <line x1="256" y1="38" x2="256" y2="76"/>
      <line x1="256" y1="436" x2="256" y2="474"/>
      <line x1="38" y1="256" x2="76" y2="256"/>
      <line x1="436" y1="256" x2="474" y2="256"/>
    </g>
    <g transform="rotate(45 256 256)">
      <rect x="146" y="146" width="220" height="220" rx="44" fill="url(#die)"/>
      <g fill="#1a1208">
        <circle cx="196" cy="196" r="24"/>
        <circle cx="316" cy="196" r="24"/>
        <circle cx="256" cy="256" r="24"/>
        <circle cx="196" cy="316" r="24"/>
        <circle cx="316" cy="316" r="24"/>
      </g>
    </g>
  </g>
</svg>
`;
}

mkdirSync(ICONS, { recursive: true });
writeFileSync(join(PUB, "favicon.svg"), svgIcon({ rx: 96, scale: 1 }));

const jobs = [
  // iOS applies its own rounded mask to a full-bleed square.
  ["icons/apple-touch-icon.png", { rx: 0, scale: 1 }, 180],
  ["icons/icon-192.png", { rx: 96, scale: 1 }, 192],
  ["icons/icon-512.png", { rx: 96, scale: 1 }, 512],
  // Maskable safe zone is the inner 80% — shrink content to survive the crop.
  ["icons/icon-maskable-512.png", { rx: 0, scale: 0.8 }, 512],
];

for (const [out, opts, size] of jobs) {
  await sharp(Buffer.from(svgIcon(opts)), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(join(PUB, out));
  console.log(`wrote public/${out} (${size}x${size})`);
}
console.log("wrote public/favicon.svg");
