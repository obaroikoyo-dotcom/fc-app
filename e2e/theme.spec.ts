import { test, expect, type Page } from "@playwright/test";

// The app opens on the light look, the login page included, whatever an older
// version left in the browser. Dark only when it has been chosen.

test.use({ viewport: { width: 390, height: 844 } });

const backgroundOf = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector(".app-shell") as Element).filter);

async function openLogin(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Launch FlipCollab" }).first().click();
  await page.getByRole("button", { name: "Continue in browser" }).click({ timeout: 1_500 }).catch(() => undefined);
  await expect(page.getByText("Who are you?")).toBeVisible({ timeout: 20_000 });
  await page.getByText("Log in", { exact: true }).click();
  await expect(page.getByText("Welcome back")).toBeVisible();
}

test("opens on light, even if an old version saved dark", async ({ page }) => {
  // What the previous version wrote when someone toggled the theme.
  await page.addInitScript(() => localStorage.setItem("theme", "normal"));
  await openLogin(page);
  expect(await backgroundOf(page)).toContain("invert(1)");
  // The page behind it is white, not the dark base colour.
  expect(await page.evaluate(() => document.body.style.background)).toMatch(/rgb\(255, 255, 255\)|#fff/);
});

test("stays dark once dark has been chosen", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fc_theme", "dark"));
  await openLogin(page);
  expect(await backgroundOf(page)).toBe("none");
});
