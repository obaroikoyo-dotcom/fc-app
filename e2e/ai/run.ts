// AI fake users. Each persona opens the real app in a browser, looks at what is
// on screen, decides what to tap or type, and writes down what confused or
// annoyed them. Run with:  npm run test:ai   (see e2e/ai/README.md)
import { chromium, type Page } from "@playwright/test";
import Anthropic from "@anthropic-ai/sdk";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { personas, type Persona } from "./personas.ts";

try { process.loadEnvFile(".env.e2e.local"); } catch { /* no file, fine */ }

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";
const MODEL = process.env.AI_TESTER_MODEL || "claude-opus-5-5";
const EFFORT = process.env.AI_TESTER_EFFORT || "low";
const MAX_STEPS = Number(process.env.AI_TESTER_MAX_STEPS || 30);
const DRY_RUN = process.env.AI_TESTER_DRY_RUN === "1";
const HEADED = process.argv.includes("--headed");
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));

// Things a fake user must never do, whatever the persona is curious about.
const BLOCKED_TAPS = /delete( my)? account|^delete$|cancel subscription|log ?out|sign ?out|deactivate/i;
// Errors that only appear when the app runs somewhere other than the real website.
const KNOWN_LOCAL_NOISE = /Can only be used on: https:\/\/flipcollab\.com|SDK already initialized/;

interface Element { idx: number; kind: string; label: string }
interface Observation { text: string; elements: Element[] }
interface Issue { severity: string; where: string; what: string; suggestion?: string; step: number }
interface Result {
  persona: Persona;
  steps: { n: number; thought: string; action: string }[];
  issues: Issue[];
  summary: string;
  rating: number | null;
  wouldUseAgain: boolean | null;
  errors: string[];
  usage: { input: number; output: number; cached: number };
  finished: boolean;
}

// ---------------------------------------------------------------- the browser

async function observe(page: Page): Promise<Observation> {
  return page.evaluate(() => {
    document.querySelectorAll("[data-ai-idx]").forEach((e) => e.removeAttribute("data-ai-idx"));
    const elements: { idx: number; kind: string; label: string }[] = [];
    let n = 0;
    const vh = window.innerHeight;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("a,button,input,textarea,select,[role=button],[onclick],div,span,li,label,img,svg"));
    for (const el of nodes) {
      const tag = el.tagName.toLowerCase();
      const control = tag === "input" || tag === "textarea" || tag === "select";
      const native = tag === "a" || tag === "button" || el.getAttribute("role") === "button";
      const style = getComputedStyle(el);
      const parentPointer = el.parentElement ? getComputedStyle(el.parentElement).cursor === "pointer" : false;
      const pointerRoot = style.cursor === "pointer" && !parentPointer;
      if (!control && !native && !pointerRoot) continue;
      if (tag === "input" && (el as HTMLInputElement).type === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh) continue;
      if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") continue;
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
      const top = document.elementFromPoint(cx, cy);
      if (!top || !el.contains(top)) continue; // covered by something else
      let kind = "tappable";
      let label = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 90);
      if (control) {
        const inp = el as HTMLInputElement;
        kind = tag === "select" ? "dropdown" : `input(${inp.type || "text"})`;
        if (inp.type === "file") { kind = "file upload (cannot be used)"; }
        const shown = inp.type === "password" ? (inp.value ? "(filled)" : "") : inp.value;
        label = [inp.placeholder ? `placeholder "${inp.placeholder}"` : "", shown ? `value "${shown.slice(0, 40)}"` : "empty"].filter(Boolean).join(", ");
      } else if (!label) {
        if (el.querySelector("svg") || tag === "svg") label = "(icon only)";
        else continue;
      }
      el.setAttribute("data-ai-idx", String(n));
      const where = `${Math.round(cx)},${Math.round(cy)}`;
      elements.push({ idx: n, kind, label: `${label}  @${where}` });
      n++;
      if (n >= 70) break;
    }
    return { text: (document.body.innerText || "").slice(0, 3500), elements };
  });
}

function describe(obs: Observation, url: string): string {
  const list = obs.elements.map((e) => `[${e.idx}] ${e.kind}: ${e.label}`).join("\n") || "(nothing tappable is visible)";
  return `URL: ${url}\n\nText on the page:\n${obs.text || "(empty)"}\n\nThings you can tap or type into right now:\n${list}`;
}

async function shot(page: Page): Promise<Anthropic.ImageBlockParam> {
  const buf = await page.screenshot({ type: "jpeg", quality: 60 });
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } };
}

async function loginAs(page: Page, who: "brand" | "creator") {
  const email = process.env[`E2E_${who.toUpperCase()}_EMAIL`];
  const password = process.env[`E2E_${who.toUpperCase()}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing E2E_${who.toUpperCase()}_EMAIL / PASSWORD in .env.e2e.local`);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Launch FlipCollab" }).first().click();
  await page.getByText("Log in", { exact: true }).click();
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByText("Log In", { exact: true }).click();
  await page.getByText("Welcome back").waitFor({ state: "hidden", timeout: 30_000 });
  await page.waitForTimeout(2000);
}

// ------------------------------------------------------------------ the tools

const thought = { type: "string", description: "One sentence: what you, as this person, are thinking right now." };
const tools: Anthropic.Tool[] = [
  { name: "click", description: "Tap something on the screen, by its number in the list.",
    input_schema: { type: "object", properties: { thought, index: { type: "integer" } }, required: ["thought", "index"] } },
  { name: "type", description: "Type into a text field, by its number in the list. Replaces what was there.",
    input_schema: { type: "object", properties: { thought, index: { type: "integer" }, text: { type: "string" }, press_enter: { type: "boolean" } }, required: ["thought", "index", "text"] } },
  { name: "scroll", description: "Scroll the page to see more.",
    input_schema: { type: "object", properties: { thought, direction: { type: "string", enum: ["down", "up"] } }, required: ["thought", "direction"] } },
  { name: "look", description: "Get a picture of the screen, to judge how it looks (layout, spacing, readability).",
    input_schema: { type: "object", properties: { thought }, required: ["thought"] } },
  { name: "wait", description: "Wait a few seconds, for example while something is loading.",
    input_schema: { type: "object", properties: { thought, seconds: { type: "integer", description: "1 to 5" } }, required: ["thought"] } },
  { name: "go_back", description: "Press the browser's back button.",
    input_schema: { type: "object", properties: { thought }, required: ["thought"] } },
  { name: "note_issue", description: "Write down something that confused you, felt broken, looked wrong, or made you trust the app less. Only things you actually saw.",
    input_schema: { type: "object", properties: {
      thought,
      severity: { type: "string", enum: ["blocker", "confusing", "polish"], description: "blocker = you could not continue; confusing = you hesitated or misunderstood; polish = small thing" },
      where: { type: "string", description: "Which screen." },
      what: { type: "string", description: "What happened or what was unclear, in plain words." },
      suggestion: { type: "string", description: "What would have helped. Optional." },
    }, required: ["thought", "severity", "where", "what"] } },
  { name: "finish", description: "Stop. Call this when you have reached your goal, are stuck, or have seen enough.",
    input_schema: { type: "object", properties: {
      thought,
      summary: { type: "string", description: "In your own words: what you understood, what you couldn't work out, and how you felt about the app." },
      rating: { type: "integer", description: "1 to 10: how much would you trust this app with your money and time?" },
      would_use_again: { type: "boolean" },
    }, required: ["thought", "summary", "rating", "would_use_again"] } },
];

function systemPrompt(p: Persona): string {
  return [
    "You are role-playing one real person using a web app called FlipCollab, so its owner can learn what a real user would think.",
    "FlipCollab is a marketplace: brands pay creators for short videos, and the app holds the money until the brand is happy with the video.",
    "",
    `Who you are: ${p.name}.`,
    p.brief,
    "",
    "How to behave:",
    "- Stay in character. You are not a developer and know nothing about how the app works inside. React to what is on screen.",
    "- You only see the app as a list of numbered things you can tap, the text on the page, and a picture when you ask for one. Use `look` when how something looks matters.",
    "- Be honest and specific. Note an issue when you hesitate, misread something, hit a dead end, or see something that looks broken or unfinished. Do not invent problems, and do not praise things just to be nice.",
    "- Do one thing at a time. Every turn, call exactly one tool.",
    `- You have about ${MAX_STEPS} steps. Call \`finish\` when you have reached your goal, are stuck, or have seen enough.`,
    "",
    "Safety rules for this test:",
    "- This is a test version. Payments use fake money. If a card is ever needed, use 4242 4242 4242 4242, any future date, any 3 digits.",
    "- Never create a real account, enter a real email address or real personal details, or try to delete anything.",
    "- Some actions (like deleting an account) are blocked. If a tap is refused, move on.",
  ].join("\n");
}

// ------------------------------------------------------------------- the loop

async function ensureServer(): Promise<ChildProcess | null> {
  if (process.env.E2E_BASE_URL) return null;
  const up = async () => { try { return (await fetch(BASE_URL)).ok; } catch { return false; } };
  if (await up()) return null;
  const child = spawn("npm", ["run", "dev", "--", "--port", "5173"], { shell: true, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    if (await up()) return child;
    await new Promise((r) => setTimeout(r, 1000));
  }
  child.kill();
  throw new Error("The app didn't start on " + BASE_URL);
}

// A stand-in "model" used by --dry-run (AI_TESTER_DRY_RUN=1) to check the
// browser side works without spending anything.
function dryRunDecision(step: number, obs: Observation): { name: string; input: Record<string, unknown> } {
  const find = (s: string) => obs.elements.find((e) => e.label.toLowerCase().includes(s.toLowerCase()));
  const click = (s: string) => { const e = find(s); return e ? { name: "click", input: { thought: `dry run: tap ${s}`, index: e.idx } } : null; };
  const plan = [
    () => click("Launch FlipCollab"),
    () => ({ name: "wait", input: { thought: "dry run: wait for the splash", seconds: 4 } }),
    () => click("I'm a Brand"),
    () => ({ name: "look", input: { thought: "dry run: look" } }),
    () => ({ name: "note_issue", input: { thought: "dry run", severity: "polish", where: "dry run", what: "This is a dry-run issue, not a real finding." } }),
  ];
  const next = plan[step - 1]?.();
  return next || { name: "finish", input: { thought: "dry run done", summary: "Dry run: the browser side works.", rating: 5, would_use_again: true } };
}

async function runPersona(p: Persona, browser: Awaited<ReturnType<typeof chromium.launch>>, client: Anthropic | null, outDir: string): Promise<Result> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 430, height: 900 }, locale: "en-GB" });
  const page = await context.newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  context.on("page", (extra) => { if (extra !== page) extra.close().catch(() => {}); });
  const errors: string[] = [];
  page.on("pageerror", (e) => { if (!KNOWN_LOCAL_NOISE.test(e.message)) errors.push(e.message); });

  const result: Result = { persona: p, steps: [], issues: [], summary: "", rating: null, wouldUseAgain: null, errors, usage: { input: 0, output: 0, cached: 0 }, finished: false };
  const baseOrigin = new URL(BASE_URL).origin;

  if (p.login === "none") {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  } else {
    await loginAs(page, p.login);
  }

  let obs = await observe(page);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: [
    { type: "text", text: "You have just opened the app. This is what you see.\n\n" + describe(obs, page.url()) },
    await shot(page),
  ] }];

  const execute = async (name: string, input: any, step: number): Promise<{ content: Anthropic.ToolResultBlockParam["content"]; done?: boolean }> => {
    let label = "";
    try {
      if (name === "click") {
        label = obs.elements.find((e) => e.idx === input.index)?.label ?? "";
        if (!label) return { content: "There is no item with that number on screen right now." };
        if (BLOCKED_TAPS.test(label)) return { content: "That action is blocked in test runs. Choose something else." };
        result.steps.push({ n: step, thought: input.thought, action: `tap [${input.index}] ${label}` });
        await page.locator(`[data-ai-idx="${input.index}"]`).first().click({ timeout: 6000 });
      } else if (name === "type") {
        const e = obs.elements.find((x) => x.idx === input.index);
        if (!e || !e.kind.startsWith("input") && e.kind !== "dropdown") return { content: "That item is not a text field." };
        const shown = e.kind.includes("password") ? "(hidden)" : input.text;
        result.steps.push({ n: step, thought: input.thought, action: `type "${shown}" into [${input.index}] ${e.label}` });
        await page.locator(`[data-ai-idx="${input.index}"]`).first().fill(String(input.text), { timeout: 6000 });
        if (input.press_enter) await page.keyboard.press("Enter");
      } else if (name === "scroll") {
        result.steps.push({ n: step, thought: input.thought, action: `scroll ${input.direction}` });
        await page.mouse.move(215, 450);
        await page.mouse.wheel(0, input.direction === "up" ? -650 : 650);
      } else if (name === "wait") {
        result.steps.push({ n: step, thought: input.thought, action: "wait" });
        await page.waitForTimeout(Math.min(Math.max(Number(input.seconds) || 2, 1), 5) * 1000);
      } else if (name === "go_back") {
        result.steps.push({ n: step, thought: input.thought, action: "back" });
        await page.goBack({ timeout: 6000 }).catch(() => {});
      } else if (name === "look") {
        result.steps.push({ n: step, thought: input.thought, action: "look at the screen" });
        const img = await shot(page);
        fs.writeFileSync(path.join(outDir, `${p.id}-step${step}.jpg`), Buffer.from((img.source as any).data, "base64"));
        return { content: [{ type: "text", text: "Here is the screen." }, img] };
      } else if (name === "note_issue") {
        result.issues.push({ severity: input.severity, where: input.where, what: input.what, suggestion: input.suggestion, step });
        result.steps.push({ n: step, thought: input.thought, action: `noted (${input.severity}): ${input.what}` });
        return { content: "Noted." };
      } else if (name === "finish") {
        result.summary = input.summary; result.rating = input.rating; result.wouldUseAgain = input.would_use_again; result.finished = true;
        result.steps.push({ n: step, thought: input.thought, action: "finished" });
        return { content: "Done.", done: true };
      } else {
        return { content: `Unknown tool ${name}.` };
      }
    } catch (err) {
      return { content: `That didn't work: ${(err as Error).message.split("\n")[0]}` };
    }
    await page.waitForTimeout(900);
    // Never leave the app's own website.
    if (new URL(page.url()).origin !== baseOrigin) {
      await page.goBack().catch(() => {});
      return { content: "That led outside the app, so it was closed. You are back where you were." };
    }
    obs = await observe(page);
    return { content: "Done. This is what you see now.\n\n" + describe(obs, page.url()) };
  };

  for (let step = 1; step <= MAX_STEPS && !result.finished; step++) {
    const last = step === MAX_STEPS;
    let calls: { id: string; name: string; input: any }[];

    if (DRY_RUN || !client) {
      const d = dryRunDecision(step, obs);
      calls = [{ id: `dry-${step}`, name: d.name, input: d.input }];
    } else {
      const params: any = {
        model: MODEL,
        max_tokens: 4000,
        system: systemPrompt(p),
        tools: last ? tools.filter((t) => t.name === "finish") : tools,
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
        cache_control: { type: "ephemeral" },
        output_config: { effort: EFFORT },
        messages,
      };
      let res: Anthropic.Message;
      try {
        res = await client.messages.create(params);
      } catch (err) {
        result.summary = `Stopped: the AI service returned an error (${(err as Error).message}).`;
        break;
      }
      result.usage.input += res.usage.input_tokens;
      result.usage.output += res.usage.output_tokens;
      result.usage.cached += res.usage.cache_read_input_tokens ?? 0;
      messages.push({ role: "assistant", content: res.content });
      if (res.stop_reason === "refusal") { result.summary = "Stopped: the AI declined to continue."; break; }
      calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, input: b.input }));
      if (calls.length === 0) {
        const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
        result.summary = result.summary || text || "Stopped without a summary.";
        break;
      }
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const c of calls) {
      const out = await execute(c.name, c.input, step);
      toolResults.push({ type: "tool_result", tool_use_id: c.id, content: out.content });
    }
    if (result.finished) break;
    const reply: (Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam)[] = [...toolResults];
    if (step === MAX_STEPS - 1) reply.push({ type: "text", text: "That was nearly your last step. Call finish next with what you have learned." });
    // Plain screenshot every few steps so the persona keeps seeing how it looks.
    if (step % 6 === 0 && !DRY_RUN) reply.push(await shot(page) as any);
    messages.push({ role: "user", content: reply });
  }

  if (!result.finished && !result.summary) result.summary = "Ran out of steps before finishing.";
  await context.close();
  return result;
}

// -------------------------------------------------------------------- report

function report(r: Result): string {
  const sev = { blocker: 0, confusing: 1, polish: 2 } as Record<string, number>;
  const issues = [...r.issues].sort((a, b) => (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3));
  const L: string[] = [];
  L.push(`# ${r.persona.name}`, "");
  L.push(`**Trust rating:** ${r.rating ?? "n/a"} / 10   **Would use again:** ${r.wouldUseAgain === null ? "n/a" : r.wouldUseAgain ? "yes" : "no"}`, "");
  L.push("## In their words", "", r.summary || "(no summary)", "");
  L.push(`## Things they flagged (${issues.length})`, "");
  if (!issues.length) L.push("Nothing flagged.", "");
  for (const i of issues) {
    L.push(`- **${i.severity.toUpperCase()}** on *${i.where}* (step ${i.step}): ${i.what}${i.suggestion ? ` Would have helped: ${i.suggestion}` : ""}`);
  }
  L.push("", "## Browser errors seen", "");
  L.push(r.errors.length ? r.errors.map((e) => `- ${e}`).join("\n") : "None.", "");
  L.push("## What they did", "");
  for (const s of r.steps) L.push(`${s.n}. ${s.action}${s.thought ? `\n   - *${s.thought}*` : ""}`);
  L.push("", `*Tokens used: ${r.usage.input} in, ${r.usage.output} out, ${r.usage.cached} read from cache.*`);
  return L.join("\n");
}

async function main() {
  const chosen = personas.filter((p) => !wanted.length || wanted.includes(p.id));
  if (!chosen.length) { console.error("No persona matches. Available: " + personas.map((p) => p.id).join(", ")); process.exit(1); }
  const client = DRY_RUN ? null : new Anthropic();
  const server = await ensureServer();
  const outDir = path.join("e2e", "ai", "reports", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: !HEADED });
  const combined: string[] = ["# AI user test run", "", `App: ${BASE_URL}   Model: ${DRY_RUN ? "dry run (no AI)" : MODEL}`, ""];
  try {
    for (const p of chosen) {
      const needsAccount = p.login !== "none" && !(process.env[`E2E_${p.login.toUpperCase()}_EMAIL`] && process.env[`E2E_${p.login.toUpperCase()}_PASSWORD`]);
      if (needsAccount) { console.log(`- ${p.id}: skipped (no ${p.login} test account in .env.e2e.local)`); continue; }
      console.log(`- ${p.id}: running...`);
      const r = await runPersona(p, browser, client, outDir);
      const md = report(r);
      fs.writeFileSync(path.join(outDir, `${p.id}.md`), md);
      combined.push(md, "", "---", "");
      console.log(`  done: ${r.issues.length} issues, rating ${r.rating ?? "n/a"}, ${r.steps.length} steps`);
    }
  } finally {
    await browser.close();
    server?.kill();
  }
  fs.writeFileSync(path.join(outDir, "ALL.md"), combined.join("\n"));
  console.log(`\nReport: ${path.join(outDir, "ALL.md")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
