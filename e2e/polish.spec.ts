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
        // a dark-look grey fainter than #999 (the page's colours are the dark look's, flipped for light)
        if (c && c.r === c.g && c.g === c.b && c.r >= 85 && c.r <= 136) out.push({ what: `faint text rgb(${c.r})`, where: label(el) });
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
