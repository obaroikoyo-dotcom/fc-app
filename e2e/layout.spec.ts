import { test, expect, type Browser, type Page } from "@playwright/test";

// Phones come in many shapes: different heights, a notch or Dynamic Island on
// top, a home bar at the bottom, and two ways an iPhone can show a web app
// (edge to edge with the page told the insets, or with the system keeping the
// page inside the safe area itself). These check the screens that are meant to
// sit still and centred on each of them. The safe-area insets are simulated, so
// nothing here needs a phone.

interface Phone { name: string; w: number; h: number; dpr: number; top: number; bottom: number }

const PHONES: Phone[] = [
  { name: "iPhone 16, edge to edge", w: 393, h: 852, dpr: 3, top: 59, bottom: 34 },
  { name: "iPhone 13, edge to edge", w: 390, h: 844, dpr: 3, top: 47, bottom: 34 },
  { name: "iPhone 16 Pro, edge to edge", w: 402, h: 874, dpr: 3, top: 62, bottom: 34 },
  { name: "iPhone 13, kept inside the safe area", w: 390, h: 763, dpr: 3, top: 0, bottom: 0 },
  { name: "iPhone SE", w: 375, h: 667, dpr: 2, top: 0, bottom: 0 },
  { name: "small Android", w: 360, h: 640, dpr: 3, top: 0, bottom: 0 },
  { name: "oldest small iPhone", w: 320, h: 568, dpr: 2, top: 0, bottom: 0 },
];

async function openPhone(browser: Browser, p: Phone, opts: { standalone: boolean }) {
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: p.dpr, isMobile: true, hasTouch: true });
  // An installed app skips the marketing page and goes straight to the app.
  if (opts.standalone) await ctx.addInitScript(() => { Object.defineProperty(navigator, "standalone", { get: () => true }); });
  const page = await ctx.newPage();
  page.on("pageerror", () => undefined); // third-party script noise, not what is under test
  if (p.top || p.bottom) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: p.top, bottom: p.bottom, left: 0, right: 0 } });
  }
  return { ctx, page };
}

// How much the scrolling page area holds beyond what it shows (0 = nothing to scroll).
const scrollGap = (page: Page) => page.evaluate(() => {
  const area = (document.querySelector(".page-enter") || document.querySelector("[data-auth-layout]")?.parentElement) as HTMLElement;
  return area.scrollHeight - area.clientHeight;
});

test.describe("screens that sit still and centred", () => {
  for (const p of PHONES) {
    test(`splash and role screen: ${p.name}`, async ({ browser }) => {
      const { ctx, page } = await openPhone(browser, p, { standalone: true });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // ---- the splash. Its logo, name and exit all animate, and the exit starts
      // at 2.4s, so measuring on a timer is a race. Switch the animations off
      // and read where everything actually sits.
      await page.waitForSelector("svg[viewBox='0 0 365 219']");
      await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
      await page.waitForTimeout(150);
      const splash = await page.evaluate(() => {
        const logo = document.querySelector("svg[viewBox='0 0 365 219']")!.getBoundingClientRect();
        const name = [...document.querySelectorAll("p")].find(el => el.textContent?.trim() === "FlipCollab")!.getBoundingClientRect();
        return { centre: (logo.top + name.bottom) / 2, top: logo.top, bottom: name.bottom, inner: innerHeight };
      });
      const usableCentre = p.top + (p.h - p.top - p.bottom) / 2;
      expect(Math.abs(splash.centre - usableCentre), "splash is in the middle of the usable area").toBeLessThanOrEqual(2);
      expect(splash.top, "splash clear of the status bar").toBeGreaterThanOrEqual(p.top);
      expect(splash.bottom, "splash clear of the home bar").toBeLessThanOrEqual(p.h - p.bottom);
      expect(await scrollGap(page), "splash cannot be scrolled").toBe(0);

      // ---- the role screen that follows when nobody is signed in
      await page.getByText("Who are you?").waitFor({ timeout: 20_000 });
      await page.waitForTimeout(500);
      const role = await page.evaluate(() => {
        const logo = document.querySelector("img.rs-logo")!.getBoundingClientRect();
        const foot = document.querySelector(".rs-foot")!.getBoundingClientRect();
        const content = document.querySelector("[data-tier]") as HTMLElement;
        return { centre: (logo.top + foot.bottom) / 2, top: logo.top, bottom: foot.bottom, tier: content.dataset.tier };
      });
      expect(Math.abs(role.centre - usableCentre), "role screen is in the middle of the usable area").toBeLessThanOrEqual(2);
      expect(role.top, "role screen clear of the status bar").toBeGreaterThanOrEqual(p.top);
      expect(role.bottom, "role screen clear of the home bar").toBeLessThanOrEqual(p.h - p.bottom);
      expect(await scrollGap(page), "role screen cannot be scrolled").toBe(0);

      // both ways in are on screen and tappable without scrolling
      for (const text of ["I'm a Brand", "I'm a Creator", "Log in"]) {
        const box = (await page.getByText(text, { exact: true }).boundingBox())!;
        expect(box.y + box.height, `${text} is on screen`).toBeLessThanOrEqual(p.h - p.bottom);
      }
      await ctx.close();
    });
  }

  test("a phone with room keeps the full-size role screen, a short one gets the compact one", async ({ browser }) => {
    const tall = await openPhone(browser, PHONES[0], { standalone: true });
    await tall.page.goto("/", { waitUntil: "domcontentloaded" });
    await tall.page.getByText("Who are you?").waitFor({ timeout: 20_000 });
    expect(await tall.page.evaluate(() => (document.querySelector("[data-tier]") as HTMLElement).dataset.tier)).toBe("0");
    await tall.ctx.close();

    const short = await openPhone(browser, PHONES[4], { standalone: true });
    await short.page.goto("/", { waitUntil: "domcontentloaded" });
    await short.page.getByText("Who are you?").waitFor({ timeout: 20_000 });
    expect(await short.page.evaluate(() => (document.querySelector("[data-tier]") as HTMLElement).dataset.tier)).not.toBe("0");
    await short.ctx.close();
  });

  test("the layout stays put once it has settled (it does not keep re-measuring)", async ({ browser }) => {
    const { ctx, page } = await openPhone(browser, PHONES[4], { standalone: true });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByText("Who are you?").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(800);
    const positions = await page.evaluate(async () => {
      const link = [...document.querySelectorAll("span")].find(s => s.textContent?.trim() === "Log in")!;
      const seen = new Set<string>();
      for (let i = 0; i < 30; i++) {
        await new Promise(r => requestAnimationFrame(r));
        const b = link.getBoundingClientRect();
        seen.add(`${b.top.toFixed(1)},${b.left.toFixed(1)}`);
      }
      return [...seen];
    });
    expect(positions, "the Log in link did not move over 30 frames").toHaveLength(1);
    await ctx.close();
  });

  for (const p of PHONES) {
    test(`demo picker fits without scrolling: ${p.name}`, async ({ browser }) => {
      const { ctx, page } = await openPhone(browser, p, { standalone: false });
      await page.goto("/demo?k=e2e-dev-key", { waitUntil: "domcontentloaded" });
      await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
      await page.getByText("Try the demo").waitFor({ timeout: 20_000 });
      await page.waitForTimeout(400);
      expect(await scrollGap(page), "demo picker cannot be scrolled").toBe(0);
      for (const text of ["I'm a Brand", "I'm a Creator", "Create an account"]) {
        const box = (await page.getByText(text, { exact: true }).boundingBox())!;
        expect(box.y, `${text} below the status bar`).toBeGreaterThanOrEqual(p.top);
        expect(box.y + box.height, `${text} above the home bar`).toBeLessThanOrEqual(p.h - p.bottom);
      }
      await ctx.close();
    });
  }
});

// ---------------------------------------------------------------------------
// The bottom bar and everything that sits on it. On a phone that runs edge to
// edge, the strip at the bottom belongs to the home bar and the strip at the top
// to the status bar: nothing readable or tappable may sit in either, the end of
// every page must scroll clear of the bottom bar, and anything pinned just above
// the bar (the chat input) must sit right on it.
// ---------------------------------------------------------------------------

// What is visible inside the unsafe strips. Runs in the page.
async function unsafeZoneOffenders(page: Page, top: number, bottom: number) {
  return page.evaluate(({ top, bottom }) => {
    const H = innerHeight;
    const found: string[] = [];
    const visibleAt = (el: Element, x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
    };
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      let own = "";
      el.childNodes.forEach(n => { if (n.nodeType === 3) own += n.textContent; });
      own = own.trim();
      const media = ["svg", "IMG", "VIDEO"].includes(el.tagName);
      if (!own && !media) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= H) continue;
      const inTop = top > 0 && r.top < top - 0.5;
      const inBottom = bottom > 0 && r.bottom > H - bottom + 0.5;
      if (!inTop && !inBottom) continue;
      const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const y = inTop ? Math.max(Math.min(r.top + (top - r.top) / 2, top - 1), 1) : Math.min(Math.max(H - bottom + (r.bottom - (H - bottom)) / 2, H - bottom + 1), H - 1);
      if (!visibleAt(el, x, y)) continue; // hidden behind a bar: nobody sees it there
      found.push(`${inTop ? "top" : "bottom"} <${el.tagName.toLowerCase()}> "${own.slice(0, 24)}"`);
    }
    return Array.from(new Set(found)).slice(0, 6);
  }, { top, bottom });
}

// Can the end of the page be scrolled up clear of the bottom bar (or the home bar if there is no bar)?
async function endOfPageClear(page: Page, homeBar: number) {
  return page.evaluate((homeBar) => {
    const scroller = document.querySelector(".page-enter") as HTMLElement | null;
    if (!scroller) return { ok: true, lowest: 0, limit: 0 };
    scroller.scrollTop = scroller.scrollHeight;
    let limit = innerHeight - homeBar;
    for (const d of Array.from(document.querySelectorAll("div"))) {
      if (getComputedStyle(d).position !== "fixed") continue;
      const r = d.getBoundingClientRect();
      if (r.bottom >= innerHeight - 0.5 && r.height < 200 && /Search/.test(d.textContent || "") && /Profile/.test(d.textContent || "")) limit = Math.min(limit, r.top);
    }
    let lowest = 0;
    scroller.querySelectorAll("*").forEach(el => {
      let own = "";
      el.childNodes.forEach(n => { if (n.nodeType === 3) own += n.textContent; });
      if (!own.trim() || el.closest("[style*='position: fixed']")) return;
      const r = el.getBoundingClientRect();
      if (r.height >= 2 && r.bottom > 0 && r.bottom > lowest) lowest = r.bottom;
    });
    scroller.scrollTop = 0;
    return { ok: lowest <= limit + 0.5, lowest: Math.round(lowest), limit: Math.round(limit) };
  }, homeBar);
}

async function enterDemo(page: Page, role: "creator" | "brand") {
  await page.goto(`/demo/${role}?k=e2e-dev-key`, { waitUntil: "domcontentloaded" });
  await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
  await page.getByText("Got it", { exact: true }).click({ timeout: 20_000 });
  await page.waitForTimeout(1_200);
}

// The fixed bar at the bottom of the screen that holds the navigation labels.
function bottomBar() {
  for (const d of Array.from(document.querySelectorAll("div"))) {
    if (getComputedStyle(d).position !== "fixed") continue;
    const r = d.getBoundingClientRect();
    if (r.bottom >= innerHeight - 0.5 && r.height < 200 && /Search/.test(d.textContent || "") && /Profile/.test(d.textContent || "")) return { top: r.top, bottom: r.bottom, height: r.height };
  }
  return null;
}

const BAR_PHONES = [PHONES[0], PHONES[1], PHONES[3], PHONES[4], PHONES[5]];

test.describe("bottom bar and the home bar zone", () => {
  for (const p of BAR_PHONES) {
    for (const role of ["creator", "brand"] as const) {
      test(`${role} screens keep clear of the status bar and home bar: ${p.name}`, async ({ browser }) => {
        const { ctx, page } = await openPhone(browser, p, { standalone: false });
        await enterDemo(page, role);

        const tab = (text: string) => page.getByText(text, { exact: true }).last().click();
        const screens: Array<[string, () => Promise<unknown>]> = role === "creator"
          ? [
            ["explore", async () => undefined],
            ["search", () => tab("Search")],
            ["messages", () => tab("Messages")],
            ["profile", () => tab("Profile")],
          ]
          : [
            ["campaigns", async () => undefined],
            ["post", () => tab("Post")],
            ["search", () => tab("Search")],
            ["messages", () => tab("Messages")],
            ["profile", () => tab("Profile")],
          ];
        for (const [name, go] of screens) {
          await go();
          await page.waitForTimeout(800);
          expect(await unsafeZoneOffenders(page, p.top, p.bottom), `${name}: nothing readable in the status bar or home bar zone`).toEqual([]);
          const end = await endOfPageClear(page, p.bottom);
          expect(end.ok, `${name}: the end of the page scrolls clear of the bottom bar (lowest ${end.lowest}, limit ${end.limit})`).toBe(true);
        }

        // the bar still runs to the bottom edge of the screen, and is taller by exactly the home bar zone
        const bar = await page.evaluate(bottomBar);
        expect(bar, "the bottom bar is there").not.toBeNull();
        expect(Math.abs(bar!.bottom - p.h), "the bar reaches the bottom edge").toBeLessThanOrEqual(0.5);
        expect(bar!.height).toBeGreaterThanOrEqual(48 + p.bottom);
        expect(bar!.height).toBeLessThanOrEqual(52 + p.bottom);
        await ctx.close();
      });
    }
  }

  for (const p of [PHONES[0], PHONES[3], PHONES[4]]) {
    test(`chat input sits right on the bottom bar: ${p.name}`, async ({ browser }) => {
      const { ctx, page } = await openPhone(browser, p, { standalone: false });
      await enterDemo(page, "creator");
      const t = await page.evaluate(() => JSON.parse(sessionStorage.getItem("fc_demo_db") || "null").tables);
      const uid = await page.evaluate(() => JSON.parse(sessionStorage.getItem("fc_demo_session") || "null").userId as string);
      const convo = t.conversations.find((c: { participant_1: string; participant_2: string }) => c.participant_1 === uid || c.participant_2 === uid);
      const other = convo.participant_1 === uid ? convo.participant_2 : convo.participant_1;
      const name = (t.brand_profiles.find((b: { id: string }) => b.id === other) || t.creator_profiles.find((c: { id: string }) => c.id === other)).name;
      await page.getByText("Messages", { exact: true }).last().click();
      await page.getByText(name, { exact: true }).first().click();
      await page.getByPlaceholder(/^Message/).waitFor();
      const gap = await page.evaluate(() => {
        const input = document.querySelector("input[placeholder^='Message'], textarea[placeholder^='Message']") as HTMLElement;
        let box: HTMLElement | null = input;
        while (box && !(getComputedStyle(box).position === "fixed" && box.style.bottom)) box = box.parentElement;
        let barTop = innerHeight;
        for (const d of Array.from(document.querySelectorAll("div"))) {
          if (getComputedStyle(d).position !== "fixed") continue;
          const r = d.getBoundingClientRect();
          if (r.bottom >= innerHeight - 0.5 && r.height < 200 && /Search/.test(d.textContent || "") && /Profile/.test(d.textContent || "")) barTop = Math.min(barTop, r.top);
        }
        return box ? barTop - box.getBoundingClientRect().bottom : null;
      });
      expect(gap, "the input bar is found").not.toBeNull();
      expect(Math.abs(gap!), "the input bar meets the bottom bar with no gap and no overlap").toBeLessThanOrEqual(2.5);
      await ctx.close();
    });
  }
});
