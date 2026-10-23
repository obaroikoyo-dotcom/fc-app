// Lists every distinct colour written in the app's code (hex and rgb/rgba), with how
// often and where. Used while moving the app from a colour filter to named colours.
const fs = require("fs"), path = require("path");

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f)) out.push(p);
  }
  return out;
}

const hex = {}, rgba = {};
for (const f of walk("src")) {
  if (f.replace(/\\/g, "/").includes("src/lib/demo")) continue;
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/(["'`(\s:,])(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})(?![0-9a-zA-Z_-])/g)) {
    let h = m[2].toLowerCase();
    if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    (hex[h] ??= { n: 0, files: new Set() }).n++;
    hex[h].files.add(path.basename(f));
  }
  for (const m of t.matchAll(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g)) {
    const k = m[0].replace(/\s+/g, "");
    (rgba[k] ??= { n: 0, files: new Set() }).n++;
    rgba[k].files.add(path.basename(f));
  }
}
console.log("HEX (" + Object.keys(hex).length + ")");
for (const [h, v] of Object.entries(hex).sort((a, b) => b[1].n - a[1].n)) console.log(h, v.n, [...v.files].slice(0, 4).join(","));
console.log("\nRGBA (" + Object.keys(rgba).length + ")");
for (const [h, v] of Object.entries(rgba).sort((a, b) => b[1].n - a[1].n)) console.log(h, v.n, [...v.files].slice(0, 4).join(","));
