// Turns the grey/white/black colours written all over the app's code into named
// colours, so the light look can be built from real colours instead of a filter.
//
//   node scripts/tokenize-colours.cjs --dry     report what would change
//   node scripts/tokenize-colours.cjs           rewrite the files and the token block in src/index.css
//
// "#999" becomes "var(--c-999)" and, where it is a text colour (a `color` property),
// "var(--t-999)". Text colours have their own names because text had a readability
// floor (nothing fainter than #999); that floor now lives in the definition of the
// text names instead of in a stylesheet rule that matched colour values.
//
// What it leaves alone on purpose: brand art (Google, TikTok, Instagram, YouTube,
// the verified badge), the campaign banner tile and default avatar tones, the public
// landing page, black (#000, used behind video), anything with colour (reds, orange,
// gold: these are done by hand), and the few colours that are already chosen per
// theme (the bottom bar, the page background, the error screen).

const fs = require("fs"), path = require("path");
const ts = require("typescript");

const DRY = process.argv.includes("--dry");

const SKIP_FILES = new Set([
  "CampaignTile.tsx", "avatar.ts", "theme.ts", "LandingPage.tsx",
  "TikTokIcon.tsx", "InstagramIcon.tsx", "YouTubeIcon.tsx", "VerifiedBadge.tsx",
]);
// Lines (by file) that are already native, per-theme colours.
const SKIP_LINES = [
  { file: "App.tsx", re: /const (activeColor|inactiveColor|bgColor|borderColor) =|document\.(body|documentElement)\.style\.background|setAttribute\("content"/ },
  { file: "ErrorFallback.tsx", re: /const (bg|fg|muted) =/ },
  { file: "ThemeScope.tsx", re: /style\.background/ },
  // Colours handed to Stripe's own pages, which cannot read our variables.
  { file: "*", re: /\b(color[A-Z]\w*|buttonPrimaryColor\w*)\s*:|CARD_ELEMENT_OPTIONS|"::placeholder"|invalid: \{ color|fillStyle/ },
];

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f)) out.push(p);
  }
  return out;
}

const HEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const RGBA = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/g;

const tokens = { c: new Map(), t: new Map(), s: new Map(), a: new Map() }; // name -> dark value
const report = {};

function shortHex(h6) {
  return h6[0] === h6[1] && h6[2] === h6[3] && h6[4] === h6[5] ? h6[0] + h6[2] + h6[4] : h6;
}

function enclosingKey(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isPropertyAssignment(n)) {
      const nm = n.name;
      if (ts.isIdentifier(nm) || ts.isStringLiteral(nm)) return nm.text;
      if (ts.isComputedPropertyName(nm)) return "[computed]";
    }
    if (ts.isJsxAttribute(n)) return n.name.getText();
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left)) return n.left.name.text;
    if (ts.isVariableDeclaration(n) || ts.isFunctionLike(n)) break;
  }
  return null;
}

let totalEdits = 0;
for (const file of walk("src")) {
  const norm = file.replace(/\\/g, "/");
  if (norm.includes("src/lib/demo")) continue;
  const base = path.basename(file);
  if (SKIP_FILES.has(base)) continue;
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lineStarts = sf.getLineStarts();
  const lineOf = pos => ts.getLineAndCharacterOfPosition(sf, pos).line;
  const lineText = ln => text.slice(lineStarts[ln], lineStarts[ln + 1] ?? text.length);
  const edits = [];

  const visit = node => {
    const isLit = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
    if (isLit) {
      const start = node.getStart(sf), end = node.end;
      const raw = text.slice(start, end);
      const key = enclosingKey(node);
      const isTemplate = !ts.isStringLiteral(node);
      const found = [];
      for (const m of raw.matchAll(HEX)) found.push({ i: m.index, len: m[0].length, kind: "hex", h6: m[1].length === 3 ? m[1].split("").map(x => x + x).join("").toLowerCase() : m[1].toLowerCase() });
      for (const m of raw.matchAll(RGBA)) found.push({ i: m.index, len: m[0].length, kind: "rgba", r: +m[1], g: +m[2], b: +m[3], a: m[4] });
      for (const f of found) {
        const abs = start + f.i;
        const ln = lineOf(abs);
        const lt = lineText(ln);
        if (SKIP_LINES.some(s => (s.file === "*" || s.file === base) && s.re.test(lt))) continue;
        let name, dark;
        if (f.kind === "hex") {
          const r = parseInt(f.h6.slice(0, 2), 16), g = parseInt(f.h6.slice(2, 4), 16), b = parseInt(f.h6.slice(4, 6), 16);
          if (!(r === g && g === b)) continue; // only greys, white and black
          if (f.h6 === "000000") continue; // black stays: it is used behind video
          const before = text.slice(Math.max(start, abs - 30), abs);
          const cssText = isTemplate && /(^|[;{\s])color\s*:\s*[^;{}]*$/.test(before); // CSS written inside a template
          const isText = key === "color" && !isTemplate || (key === null && false) || (!isTemplate && key === "color");
          const isIcon = !isTemplate && (key === "stroke" || key === "fill");
          const kind = isText && !cssText ? "t" : isIcon ? "s" : "c";
          name = `--${kind}-${shortHex(f.h6)}`;
          // The readability floors the old stylesheet rules applied to dim greys.
          let floor = null;
          if (kind === "t") floor = ["333333", "444444"].includes(f.h6) ? "#919191" : ["555555", "666666", "777777", "888888"].includes(f.h6) ? "#999999" : null;
          if (kind === "s") floor = ["333333", "444444", "555555", "666666", "777777", "888888"].includes(f.h6) ? "#919191" : null;
          dark = floor ?? `#${f.h6}`;
          (tokens[kind]).set(name, dark);
        } else {
          if (!(f.r === f.g && f.g === f.b)) continue; // coloured overlays are done by hand
          if (f.r !== 0 && f.r !== 255) continue; // only black and white scrims, shadows and glints
          const alpha = f.a === undefined ? "1" : f.a;
          name = `--a-${f.r}-${f.g}-${f.b}-${String(alpha).replace(".", "_")}`;
          dark = `rgba(${f.r}, ${f.g}, ${f.b}, ${alpha})`;
          tokens.a.set(name, dark);
        }
        edits.push({ start: abs, end: abs + f.len, text: `var(${name})` });
        const label = `${base} ${key ?? "(css text)"}`;
        report[label] = (report[label] ?? 0) + 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (edits.length && !DRY) {
    edits.sort((a, b) => b.start - a.start);
    let out = text;
    for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    fs.writeFileSync(file, out);
  }
  totalEdits += edits.length;
}

const keys = Object.entries(report).sort((a, b) => b[1] - a[1]);
const byKey = {};
for (const [label, n] of keys) { const k = label.split(" ").slice(1).join(" "); byKey[k] = (byKey[k] ?? 0) + n; }
console.log(`${DRY ? "would change" : "changed"} ${totalEdits} colours in ${new Set(keys.map(k => k[0].split(" ")[0])).size} files`);
console.log("by property:", Object.entries(byKey).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join("  "));

const block = [];
for (const kind of ["c", "t", "s", "a"]) {
  for (const [name, dark] of [...tokens[kind].entries()].sort()) block.push(`  ${name}: ${dark};`);
}
console.log(`tokens: ${tokens.c.size} general, ${tokens.t.size} text, ${tokens.s.size} icon, ${tokens.a.size} see-through`);
if (!DRY) {
  const cssPath = path.join("src", "index.css");
  let css = fs.readFileSync(cssPath, "utf8");
  const crlf = css.includes("\r\n");
  css = css.replace(/\r\n/g, "\n");
  const start = "/* colours:start */", end = "/* colours:end */";
  const body = [
    start,
    "/* Named colours, written by scripts/tokenize-colours.cjs. The values here are the dark look.",
    "   --c-*: any colour, --t-*: text colours and --s-*: icon strokes and fills (both with the readability",
    "   floors the old stylesheet rules applied), --a-*: see-through black and white. */",
    ":root {",
    ...block,
    "}",
    end,
  ].join("\n");
  const a = css.indexOf(start), b = css.indexOf(end);
  if (a >= 0 && b > a) css = css.slice(0, a) + body + css.slice(b + end.length);
  else css = css.replace(/\n*$/, "\n\n") + body + "\n";
  if (crlf) css = css.replace(/\n/g, "\r\n");
  fs.writeFileSync(cssPath, css);
}
