import { test, expect, type Page } from "@playwright/test";

// Looks and readability across the main screens, checked on the finished page:
// no green anywhere, text never too small or too faint, and the buttons at the
// top of a chat big enough to tap. Runs in the demo (made-up data, no accounts).

test.use({ viewport: { width: 390, height: 844 } });

const KEY = "k=e2e-dev-key";

async function openDemo(page: Page, role: "creator" | "brand") {
  await page.goto(`/demo/${role}?${KEY}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
  await expect(page.getByText("You're looking at a demo")).toBeVisible({ timeout: 20_000 });
  await page.getByText("Got it", { exact: true }).click();
  await page.waitForTimeout(600);
}

interface Finding { what: string; where: string }

// Looks at everything visible on the current screen and reports what breaks the rules.
async function audit(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    const out: { what: string; where: string }[] = [];
    const light = document.documentElement.classList.contains("theme-light");
    const parse = (c: string) => {
      const m = /rgba?\((\d+), ?(\d+), ?(\d+)(?:, ?([\d.]+))?\)/.exec(c);
      return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
    };
    const isGreen = (c: { r: number; g: number; b: number; a: number } | null) => !!c && c.a > 0.05 && c.g > c.r + 30 && c.g > c.b + 30;
    const label = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""} "${(el.textContent || "").trim().slice(0, 30)}"`;
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      for (const prop of ["color", "backgroundColor", "borderTopColor", "borderLeftColor"] as const) {
        if (prop.startsWith("border") && cs.borderTopWidth === "0px" && cs.borderLeftWidth === "0px") continue;
        if (isGreen(parse(cs[prop]))) out.push({ what: `green ${prop}`, where: label(el) });
      }
      const ownText = Array.from(el.childNodes).some(n => n.nodeType === 3 && (n.textContent || "").trim().length > 0);
      if (ownText && !el.classList.contains("nav-label")) {
        const size = parseFloat(cs.fontSize);
        if (size < 11) out.push({ what: `text ${size}px`, where: label(el) });
        const c = parse(cs.color);
        // A grey too faint to read: on white anything lighter than about #767676 (4.5:1) up to the
        // disabled greys (#bbb and lighter, left alone); on dark anything darker than #999 down to the
        // disabled greys (#444 and darker, left alone).
        const grey = !!c && c.r === c.g && c.g === c.b;
        if (grey && (light ? c!.r > 118 && c!.r < 190 : c!.r >= 85 && c!.r <= 136)) out.push({ what: `faint text rgb(${c!.r})`, where: label(el) });
      }
    }
    return out;
  });
}

const screens: Array<[role: "creator" | "brand", name: string, go: (page: Page) => Promise<void>]> = [
  ["creator", "Explore", async () => undefined],
  ["creator", "Search", async p => { await p.getByText("Search", { exact: true }).last().click(); }],
  ["creator", "Messages", async p => { await p.getByText("Messages", { exact: true }).last().click(); }],
  ["creator", "Profile", async p => { await p.getByText("Profile", { exact: true }).last().click(); }],
  ["brand", "Campaigns", async () => undefined],
  ["brand", "Market", async p => { await p.getByText("Market", { exact: true }).click(); }],
  ["brand", "Post", async p => { await p.getByText("Post", { exact: true }).last().click(); }],
  ["brand", "Profile", async p => { await p.getByText("Profile", { exact: true }).last().click(); }],
];

for (const [role, name, go] of screens) {
  test(`${role} ${name}: no green, nothing too small or too faint to read`, async ({ page }) => {
    await openDemo(page, role);
    await go(page);
    await page.waitForTimeout(900);
    const findings = await audit(page);
    expect(findings, JSON.stringify(findings.slice(0, 12), null, 1)).toEqual([]);
  });
}

test("a chat's top bar: Pay, Screen Out and report are easy to tap, and a long name never pushes them off the screen", async ({ page }) => {
  await openDemo(page, "brand");
  // give one creator a very long name, then open that chat
  const longName = "Alexandria Montgomery-Featherstonehaugh";
  await page.evaluate(name => {
    const db = JSON.parse(sessionStorage.getItem("fc_demo_db") || "null");
    const convo = db.tables.conversations[0];
    const session = JSON.parse(sessionStorage.getItem("fc_demo_session") || "null");
    const other = convo.participant_1 === session.userId ? convo.participant_2 : convo.participant_1;
    const profile = db.tables.creator_profiles.find((c: { id: string }) => c.id === other) || db.tables.brand_profiles.find((b: { id: string }) => b.id === other);
    profile.name = name;
    sessionStorage.setItem("fc_demo_db", JSON.stringify(db));
  }, longName);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
  await page.getByText("Messages", { exact: true }).last().click();
  await page.getByText(/^messages$/i).nth(1).click(); // the Messages tab beside Applications (after the page title)
  await page.getByText(longName, { exact: true }).first().click();

  const pay = page.getByText("Pay", { exact: true }).first();
  const screenOut = page.getByText("Screen Out", { exact: true });
  await expect(pay).toBeVisible();
  for (const [label, el] of [["Pay", pay], ["Screen Out", screenOut]] as const) {
    const box = (await el.boundingBox())!;
    expect(box.height, `${label} is at least 36px tall`).toBeGreaterThanOrEqual(36);
    expect(box.x + box.width, `${label} stays on the screen`).toBeLessThanOrEqual(360);
  }
  const doc = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(doc.scroll, "no sideways scrolling").toBeLessThanOrEqual(doc.client);
  // the name is cut short, not wrapped or pushed
  const nameBox = (await page.locator("h1", { hasText: "Alexandria" }).boundingBox())!;
  expect(nameBox.height, "the name stays on one line").toBeLessThan(30);
  expect(nameBox.width, "and has room to be read").toBeGreaterThan(150);
  // the first message is not hidden behind the taller top bar
  const bar = (await page.locator("div[style*=\"position: fixed\"]").first().boundingBox())!;
  expect(bar.y + bar.height).toBeLessThan(200);
});

test("an applicant's page: the Report button holds its label and is easy to tap", async ({ page }) => {
  await openDemo(page, "brand");
  await page.getByText("Messages", { exact: true }).last().click();
  await page.getByText(/^[0-9]+ applications?$/).first().click(); // first campaign
  await page.getByText(/^pending$/i).first().click(); // first pending applicant
  const report = page.getByText(/Report$/).filter({ hasText: "⚑" }).first();
  await expect(report).toBeVisible();
  const box = (await report.boundingBox())!;
  expect(box.height, "at least 36px tall").toBeGreaterThanOrEqual(36);
  const fits = await report.evaluate(el => el.scrollWidth <= el.clientWidth + 1);
  expect(fits, "the label sits inside the button").toBe(true);
  expect(box.x + box.width, "stays on the screen").toBeLessThanOrEqual(390);
});

// A cover photo must show exactly its own colours, in the light look and the dark
// look alike. (Light mode used to be the dark look run through a colour filter, which
// turned a strong red into a dull maroon.) Checked on the real pixels on screen.
for (const theme of ["light", "dark"] as const) {
  test(`a cover photo shows its own colours, ${theme} look`, async ({ page }) => {
    await page.addInitScript(t => localStorage.setItem("fc_theme", t), theme);
    await openDemo(page, "creator");

    // Give the open campaigns a photo made of known colours: red, green, blue, skin and sky.
    const swatches: Array<[string, number[]]> = [
      ["red", [195, 2, 19]], ["green", [30, 160, 60]], ["blue", [20, 60, 200]], ["skin", [224, 172, 105]], ["sky", [135, 206, 235]],
    ];
    const dataUrl = await page.evaluate(sw => {
      const c = document.createElement("canvas");
      c.width = 500; c.height = 200;
      const g = c.getContext("2d")!;
      sw.forEach(([, rgb], i) => { g.fillStyle = `rgb(${rgb.join(",")})`; g.fillRect(i * 100, 0, 100, 200); });
      return c.toDataURL("image/png");
    }, swatches);
    await page.evaluate(url => {
      const db = JSON.parse(sessionStorage.getItem("fc_demo_db") || "null");
      for (const c of db.tables.campaigns as Array<{ is_draft?: boolean; cover_url?: string }>) if (!c.is_draft) c.cover_url = url;
      sessionStorage.setItem("fc_demo_db", JSON.stringify(db));
    }, dataUrl);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
    await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });

    const photo = page.locator(".campaign-tile img").first();
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

    // nothing between the picture and the page may recolour it
    const filters = await photo.evaluate(img => {
      const found: string[] = [];
      for (let el: Element | null = img; el; el = el.parentElement) { const f = getComputedStyle(el).filter; if (f && f !== "none") found.push(f); }
      return found;
    });
    expect(filters, "no colour filter above the photo").toEqual([]);

    // and the pixels on screen are the picture's own colours
    const { createRequire } = await import("node:module");
    const { PNG } = createRequire(import.meta.url)("playwright-core/lib/utilsBundle");
    const png = PNG.sync.read(await photo.screenshot());
    const stripe = png.width / swatches.length;
    for (const [i, [name, rgb]] of swatches.entries()) {
      const x = Math.round(stripe * i + stripe / 2), y = Math.round(png.height * 0.3); // above the niche label
      const at = (png.width * y + x) * 4;
      const got = [png.data[at], png.data[at + 1], png.data[at + 2]];
      for (let k = 0; k < 3; k++) expect(Math.abs(got[k] - rgb[k]), `${name} channel ${k} is ${got} not ${rgb}`).toBeLessThanOrEqual(3);
    }
  });
}
