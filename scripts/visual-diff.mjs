// Compares two folders of screenshots taken by e2e/visual.spec.ts and says how
// much of each screen changed. Usage:
//   node scripts/visual-diff.mjs <before-dir> <after-dir> [threshold] [out-dir]
// threshold: the biggest per-channel difference still counted as "the same"
// (default 6, enough to ignore rounding). out-dir: where to write a picture of
// each changed screen with the changed pixels in magenta.
// Add --flat as a last argument to look only at flat areas (backgrounds, borders,
// fills) and ignore pixels next to an edge: the same text drawn by a different route
// has slightly different edge pixels, which is not a colour change.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { PNG } = require("playwright-core/lib/utilsBundle");

const FLAT = process.argv.includes("--flat");
const [before, after, thresholdArg, outDir] = process.argv.slice(2).filter(a => a !== "--flat");
if (!before || !after) {
  console.error("usage: node scripts/visual-diff.mjs <before-dir> <after-dir> [threshold] [out-dir]");
  process.exit(2);
}
const threshold = Number(thresholdArg ?? 6);
if (outDir) mkdirSync(outDir, { recursive: true });

// pixels with an edge within 3 pixels in either picture
function edges(a, b) {
  const w = a.width, h = a.height;
  const hard = new Uint8Array(w * h);
  for (const P of [a, b]) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (w * y + x) * 4;
      let strong = false;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= w || ny >= h) continue;
        const j = (w * ny + nx) * 4;
        if (Math.max(Math.abs(P.data[i] - P.data[j]), Math.abs(P.data[i + 1] - P.data[j + 1]), Math.abs(P.data[i + 2] - P.data[j + 2])) > 24) { strong = true; break; }
      }
      if (strong) hard[w * y + x] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!hard[w * y + x]) continue;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[w * ny + nx] = 1;
    }
  }
  return out;
}

const names = readdirSync(before).filter(f => f.endsWith(".png")).sort();
let worst = 0;
let failures = 0;
for (const name of names) {
  if (!existsSync(join(after, name))) { console.log(`MISSING  ${name}`); failures++; continue; }
  const a = PNG.sync.read(readFileSync(join(before, name)));
  const b = PNG.sync.read(readFileSync(join(after, name)));
  if (a.width !== b.width || a.height !== b.height) { console.log(`SIZE     ${name}  ${a.width}x${a.height} -> ${b.width}x${b.height}`); failures++; continue; }
  let changed = 0, maxDiff = 0, minX = a.width, minY = a.height, maxX = 0, maxY = 0;
  const marked = outDir ? new PNG({ width: a.width, height: a.height }) : null;
  const edgeMask = FLAT ? edges(a, b) : null;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (a.width * y + x) * 4;
      if (edgeMask && edgeMask[a.width * y + x]) { if (marked) { marked.data[i] = marked.data[i + 1] = marked.data[i + 2] = 235; marked.data[i + 3] = 255; } continue; }
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
      if (d > maxDiff) maxDiff = d;
      const isChange = d > threshold;
      if (isChange) {
        changed++;
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      if (marked) {
        marked.data[i] = isChange ? 255 : b.data[i] * 0.35 + 165;
        marked.data[i + 1] = isChange ? 0 : b.data[i + 1] * 0.35 + 165;
        marked.data[i + 2] = isChange ? 255 : b.data[i + 2] * 0.35 + 165;
        marked.data[i + 3] = 255;
      }
    }
  }
  const pct = (changed / (a.width * a.height)) * 100;
  if (pct > worst) worst = pct;
  if (changed > 0) {
    failures++;
    console.log(`CHANGED  ${name}  ${pct.toFixed(2)}% of pixels, biggest step ${maxDiff}, area x${minX}-${maxX} y${minY}-${maxY}`);
    if (marked && outDir) writeFileSync(join(outDir, name), PNG.sync.write(marked));
  } else {
    console.log(`same     ${name}  (biggest step ${maxDiff})`);
  }
}
console.log(`\n${names.length} screens, ${failures} differ, worst ${worst.toFixed(2)}%`);
process.exit(failures ? 1 : 0);
