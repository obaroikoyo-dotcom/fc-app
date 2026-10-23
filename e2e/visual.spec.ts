import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Screenshots of the main screens, for checking that a change to how colours
// are built did not change how anything looks. It does nothing in a normal test
// run: set VISUAL_DIR to a folder to take a set, then compare two sets with
//   node scripts/visual-diff.mjs <before> <after>
//
// The demo's world is made repeatable (fixed seed, fixed clock, no animation),
// so two sets taken from the same code are identical.

const DIR = process.env.VISUAL_DIR;
test.skip(!DIR, "set VISUAL_DIR to take screenshots");

test.use({ viewport: { width: 390, height: 844 } });

const KEY = "k=e2e-dev-key";
const FIXED_NOW = new Date("2026-10-23T12:00:00Z");
const USER_ID = "00000000-0000-4000-8000-0000000000aa";

async function prepare(page: Page, role: "creator" | "brand", theme: "light" | "dark") {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(({ role, theme, userId }) => {
    try {
      localStorage.setItem("fc_theme", theme);
      if (!sessionStorage.getItem("fc_demo_session")) {
        sessionStorage.setItem("fc_demo_session", JSON.stringify({ role, seed: 424242, userId, startedAt: 1_793_000_000_000 }));
        sessionStorage.setItem("fc_demo_notice_seen", "1");
        sessionStorage.setItem("fc_demo_install_seen", "1");
      }
    } catch { /* ignore */ }
  }, { role, theme, userId: USER_ID });
  await page.goto(`/demo/${role}?${KEY}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }" });
  await page.waitForTimeout(1500);
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(DIR!, `${name}.png`) });
}

async function scrollMain(page: Page, by: number) {
  await page.evaluate(top => { const s = document.querySelector(".page-enter"); if (s) s.scrollTop = top; }, by);
  await page.waitForTimeout(250);
}

for (const theme of ["light", "dark"] as const) {
  test(`creator screens, ${theme}`, async ({ page }) => {
    mkdirSync(DIR!, { recursive: true });
    await prepare(page, "creator", theme);
    const n = (s: string) => `creator-${theme}-${s}`;

    await shot(page, n("explore"));
    await scrollMain(page, 700); await shot(page, n("explore-scrolled")); await scrollMain(page, 0);
    await page.getByText(/^Filters/).click(); await page.waitForTimeout(300); await shot(page, n("explore-filters")); await page.getByText(/^Filters/).click();
    await page.getByText(/^My Pitches/i).click(); await page.waitForTimeout(400); await shot(page, n("explore-pitches"));
    await page.getByText(/^Discover Deals/i).click(); await page.waitForTimeout(300);

    // a campaign's apply page
    await page.locator(".item-enter").first().getByText("Apply", { exact: true }).click();
    await page.waitForTimeout(900); await shot(page, n("apply")); await scrollMain(page, 700); await shot(page, n("apply-scrolled"));
    await page.getByText("Explore", { exact: true }).last().click(); await page.waitForTimeout(500);

    await page.getByText("Search", { exact: true }).last().click(); await page.waitForTimeout(900); await shot(page, n("search"));
    await page.getByText(/^Filters/).click(); await page.waitForTimeout(300); await shot(page, n("search-filters")); await page.getByText(/^Filters/).click();

    await page.getByText("Messages", { exact: true }).last().click(); await page.waitForTimeout(900); await shot(page, n("messages"));
    await page.locator("[style*='cursor: pointer']").filter({ hasText: /\d\d:\d\d/ }).first().click(); await page.waitForTimeout(1000);
    await shot(page, n("chat")); await scrollMain(page, 0); await shot(page, n("chat-top"));
    await page.getByText("⚑").first().click().catch(() => undefined); await page.waitForTimeout(300); await shot(page, n("chat-report"));
    await page.getByText("←", { exact: true }).first().click().catch(() => undefined);

    await page.getByText("Profile", { exact: true }).last().click(); await page.waitForTimeout(1200); await shot(page, n("profile"));
    await scrollMain(page, 800); await shot(page, n("profile-scrolled"));
    await scrollMain(page, 1700); await shot(page, n("profile-scrolled-2"));
  });

  test(`brand screens, ${theme}`, async ({ page }) => {
    mkdirSync(DIR!, { recursive: true });
    await prepare(page, "brand", theme);
    const n = (s: string) => `brand-${theme}-${s}`;

    await shot(page, n("campaigns"));
    await scrollMain(page, 700); await shot(page, n("campaigns-scrolled")); await scrollMain(page, 0);
    await page.getByText("Market", { exact: true }).click(); await page.waitForTimeout(600); await shot(page, n("market"));
    await scrollMain(page, 700); await shot(page, n("market-scrolled")); await scrollMain(page, 0);
    await page.getByText(/^Filters/).click(); await page.waitForTimeout(300); await shot(page, n("market-filters")); await page.getByText(/^Filters/).click();

    await page.getByText("Post", { exact: true }).last().click(); await page.waitForTimeout(800); await shot(page, n("post"));
    await scrollMain(page, 700); await shot(page, n("post-scrolled")); await scrollMain(page, 1500); await shot(page, n("post-scrolled-2")); await scrollMain(page, 4000); await shot(page, n("post-end"));

    await page.getByText("Messages", { exact: true }).last().click(); await page.waitForTimeout(900); await shot(page, n("messages-applications"));
    await page.getByText(/^messages$/i).nth(1).click(); await page.waitForTimeout(500); await shot(page, n("messages"));
    await page.locator("[style*='cursor: pointer']").filter({ hasText: /\d\d:\d\d/ }).first().click(); await page.waitForTimeout(1000);
    await shot(page, n("chat"));
    await page.getByText("Pay", { exact: true }).first().click(); await page.waitForTimeout(800); await shot(page, n("pay-modal")); await scrollMain(page, 0);
    await page.keyboard.press("Escape");

    await page.goto(`/demo/brand?${KEY}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.getByText("Profile", { exact: true }).last().click(); await page.waitForTimeout(1200); await shot(page, n("profile"));
    await scrollMain(page, 800); await shot(page, n("profile-scrolled"));
  });
}

test("the demo picker, light and dark", async ({ page }) => {
  mkdirSync(DIR!, { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    await page.clock.setFixedTime(FIXED_NOW);
    await page.addInitScript(t => { try { localStorage.setItem("fc_theme", t); sessionStorage.setItem("fc_demo_install_seen", "1"); } catch { /* ignore */ } }, theme);
    await page.goto(`/demo?${KEY}`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
    await expect(page.getByText("I'm a Creator")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(DIR!, `picker-${theme}.png`) });
  }
});
