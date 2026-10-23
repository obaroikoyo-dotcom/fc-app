// Turns the colours written all over the app's code into named colours, and writes
// the colour block at the end of src/index.css (the dark values on :root and the
// light values on html.theme-light).
//
//   node scripts/tokenize-colours.cjs --dry     report what would change
//   node scripts/tokenize-colours.cjs           rewrite the files and the colour block
//
// "#999" becomes "var(--c-999)" and, where it is a text colour (a `color` property),
// "var(--t-999)"; icon strokes and fills are "--s-", backgrounds of the status
// colours "--b-", see-through black and white "--a-". Text and icon names have their
// own so the readability floors (nothing fainter than #999) live in their values.
//
// Light values: for greys and the colours without an override below, the light
// value is what the old light look produced for that colour, worked out here the
// same way the browser's filter did (invert, turn the hues back, lift to white, each
// step clamped). That is what makes the switch invisible apart from the pictures.
//
// Left alone on purpose: brand art (Google, TikTok, Instagram, YouTube, the verified
// badge), the campaign banner tile and default avatar tones, the public landing
// page, black behind video, and the colours that are already chosen per theme (the
// bottom bar, the page background, the error screen, Stripe's own settings).

const fs = require("fs"), path = require("path");
const ts = require("typescript");

const DRY = process.argv.includes("--dry");

const SKIP_FILES = new Set([
  "CampaignTile.tsx", "avatar.ts", "theme.ts", "LandingPage.tsx", "stripeTheme.ts",
  "TikTokIcon.tsx", "InstagramIcon.tsx", "YouTubeIcon.tsx", "VerifiedBadge.tsx",
]);
const SKIP_LINES = [
  { file: "App.tsx", re: /const (activeColor|inactiveColor|bgColor|borderColor) =|document\.(body|documentElement)\.style\.background|setAttribute\("content"/ },
  { file: "ErrorFallback.tsx", re: /const (bg|fg|muted) =/ },
  { file: "ThemeScope.tsx", re: /style\.background/ },
  // Colours handed to Stripe's own pages, which cannot read our variables.
  { file: "*", re: /\b(color[A-Z]\w*|buttonPrimaryColor\w*)\s*:|CARD_ELEMENT_OPTIONS|"::placeholder"|invalid: \{ color|fillStyle/ },
];

// Colours with a colour in them. [text, background, anything else] in the light look.
// Reds: text #e5322d, backgrounds stay the true red, borders and the rest #e5322d.
// Gold text #be6e00. Anything not listed here is worked out from the old filter.
const RED = h => ({ t: "#e5322d", b: `#${h}`, c: "#e5322d" });
const COLOURED = {
  ff3b30: RED("ff3b30"), ff4444: RED("ff4444"), ff4d4d: RED("ff4d4d"),
  ff6b60: { t: "#c4251f", b: "#ff6b60", c: "#c4251f" },
  ff7a70: { t: "#c4251f", b: "#ff7a70", c: "#c4251f" },
  ffb800: { t: "#be6e00", b: "#ffb800", c: "#be6e00" },
  ff9500: { b: "#ff9500" }, "6366f1": {}, "3a1414": {}, "3a1a1a": {},
};
const RGBA_RED = new Set(["255,59,48", "255,68,68", "255,77,77"]);

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f)) out.push(p);
  }
  return out;
}

// --- what the old light look did to a colour -------------------------------------
const clamp = x => Math.min(1, Math.max(0, x));
function lightOf([r, g, b]) {
  let v = [1 - r / 255, 1 - g / 255, 1 - b / 255]; // invert
  v = [-0.574 * v[0] + 1.43 * v[1] + 0.144 * v[2], 0.426 * v[0] + 0.43 * v[1] + 0.144 * v[2], 0.426 * v[0] + 1.43 * v[1] - 0.856 * v[2]].map(clamp); // hue-rotate(180deg)
  v = v.map(x => clamp(x * 1.045)); // brightness
  return v.map(x => Math.round(x * 255));
}
const toHex = rgb => "#" + rgb.map(x => x.toString(16).padStart(2, "0")).join("");
const parseHex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const HEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const RGBA = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/g;

// name -> { dark, light }. Starts from what is already in the stylesheet.
const cssPath = path.join("src", "index.css");
const tokens = new Map();
{
  const css = fs.readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
  const a = css.indexOf("/* colours:start */"), b = css.indexOf("/* colours:end */");
  if (a >= 0 && b > a) {
    const block = css.slice(a, b);
    const root = block.split("html.theme-light")[0];
    for (const m of root.matchAll(/^\s+(--[a-z]-[0-9a-z_-]+):\s*([^;]+);/gm)) tokens.set(m[1], { dark: m[2].trim(), light: null });
  }
}
const lightOverrides = new Map();
function add(name, dark, light) {
  if (!tokens.has(name)) tokens.set(name, { dark, light: null });
  if (light) lightOverrides.set(name, light);
}

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
const report = {};
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
        const lt = lineText(lineOf(abs));
        if (SKIP_LINES.some(s => (s.file === "*" || s.file === base) && s.re.test(lt))) continue;
        let name = null;
        if (f.kind === "hex") {
          const r = parseInt(f.h6.slice(0, 2), 16), g = parseInt(f.h6.slice(2, 4), 16), b = parseInt(f.h6.slice(4, 6), 16);
          const before = text.slice(Math.max(start, abs - 30), abs);
          const cssText = isTemplate && /(^|[;{\s])color\s*:\s*[^;{}]*$/.test(before);
          const isText = !isTemplate && key === "color";
          const isBackground = !isTemplate && typeof key === "string" && key.startsWith("background");
          const isIcon = !isTemplate && (key === "stroke" || key === "fill");
          if (f.h6 === "000000") {
            if (!isText) continue; // black behind video stays black
            name = "--t-000"; add(name, "#000000", "#ffffff");
          } else if (r === g && g === b) {
            const kind = isText && !cssText ? "t" : isIcon ? "s" : "c";
            name = `--${kind}-${shortHex(f.h6)}`;
            let floor = null;
            if (kind === "t") floor = ["333333", "444444"].includes(f.h6) ? "#919191" : ["555555", "666666", "777777", "888888"].includes(f.h6) ? "#999999" : null;
            if (kind === "s") floor = ["333333", "444444", "555555", "666666", "777777", "888888"].includes(f.h6) ? "#919191" : null;
            add(name, floor ?? `#${f.h6}`);
          } else if (COLOURED[f.h6]) {
            const kind = isText && !cssText ? "t" : isBackground ? "b" : isIcon ? "s" : "c";
            name = `--${kind}-${f.h6}`;
            add(name, `#${f.h6}`, COLOURED[f.h6][kind === "s" ? "c" : kind]);
          } else continue;
        } else {
          const alpha = f.a === undefined ? "1" : f.a;
          const rgbKey = `${f.r},${f.g},${f.b}`;
          const nm = `--a-${f.r}-${f.g}-${f.b}-${String(alpha).replace(".", "_")}`;
          if (f.r === f.g && f.g === f.b && (f.r === 0 || f.r === 255)) {
            name = nm; const inv = f.r === 0 ? 255 : 0;
            add(name, `rgba(${f.r}, ${f.g}, ${f.b}, ${alpha})`, `rgba(${inv}, ${inv}, ${inv}, ${alpha})`);
          } else if (RGBA_RED.has(rgbKey)) {
            name = nm; add(name, `rgba(${f.r}, ${f.g}, ${f.b}, ${alpha})`, `rgba(229, 50, 45, ${alpha})`);
          } else if (rgbKey === "255,149,0" || rgbKey === "99,102,241") {
            name = nm; const l = lightOf([f.r, f.g, f.b]);
            add(name, `rgba(${f.r}, ${f.g}, ${f.b}, ${alpha})`, `rgba(${l.join(", ")}, ${alpha})`);
          } else continue;
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

const byKey = {};
for (const [label, n] of Object.entries(report)) { const k = label.split(" ").slice(1).join(" "); byKey[k] = (byKey[k] ?? 0) + n; }
console.log(`${DRY ? "would change" : "changed"} ${totalEdits} colours in ${new Set(Object.keys(report).map(k => k.split(" ")[0])).size} files`);
console.log("by property:", Object.entries(byKey).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join("  "));

// --- the colour block ----------------------------------------------------------------
// The light value a name was given on purpose (everything else is worked out from the old filter).
function overrideFor(name, dark) {
  let m = /^--([tbc])-([0-9a-f]{6})$/.exec(name);
  if (m && COLOURED[m[2]] && COLOURED[m[2]][m[1]]) return COLOURED[m[2]][m[1]];
  if (name === "--t-000") return "#ffffff";
  m = /^--a-(\d+)-(\d+)-(\d+)-([0-9_]+)$/.exec(name);
  if (m) {
    const alpha = m[4].replace("_", ".");
    if (m[1] === m[2] && m[2] === m[3] && (m[1] === "0" || m[1] === "255")) { const inv = m[1] === "0" ? 255 : 0; return `rgba(${inv}, ${inv}, ${inv}, ${alpha})`; }
    if (RGBA_RED.has(`${m[1]},${m[2]},${m[3]}`)) return `rgba(229, 50, 45, ${alpha})`;
  }
  return null;
}
function light(name, dark) {
  const o = overrideFor(name, dark);
  if (o) return o;
  if (dark.startsWith("rgba")) {
    const m = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(dark);
    return `rgba(${lightOf([+m[1], +m[2], +m[3]]).join(", ")}, ${m[4]})`;
  }
  return toHex(lightOf(parseHex(dark)));
}
const order = ["c", "t", "s", "b", "a"];
const names = [...tokens.keys()].sort((x, y) => order.indexOf(x[2]) - order.indexOf(y[2]) || x.localeCompare(y));
console.log(`tokens: ${names.length}`);
if (!DRY) {
  let css = fs.readFileSync(cssPath, "utf8");
  const crlf = css.includes("\r\n");
  css = css.replace(/\r\n/g, "\n");
  const start = "/* colours:start */", end = "/* colours:end */";
  const body = [
    start,
    "/* Named colours, written by scripts/tokenize-colours.cjs.",
    "   --c-*: any colour, --t-*: text, --s-*: icon strokes and fills, --b-*: status backgrounds,",
    "   --a-*: see-through black and white. Text and icon names carry the readability floors. */",
    ":root {",
    "  color-scheme: dark;",
    ...names.map(n => `  ${n}: ${tokens.get(n).dark};`),
    "}",
    "html.theme-light {",
    "  color-scheme: light;",
    ...names.map(n => `  ${n}: ${light(n, tokens.get(n).dark)};`),
    "}",
    end,
  ].join("\n");
  const a = css.indexOf(start), b = css.indexOf(end);
  if (a >= 0 && b > a) css = css.slice(0, a) + body + css.slice(b + end.length);
  else css = css.replace(/\n*$/, "\n\n") + body + "\n";
  if (crlf) css = css.replace(/\n/g, "\r\n");
  fs.writeFileSync(cssPath, css);
}
