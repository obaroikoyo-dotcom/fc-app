import { test, expect, type Page } from "@playwright/test";

// Launch on a computer: a browser that offers to install FlipCollab (Chrome,
// Edge) gets one install ask per visit before the app opens. Browsers that
// don't offer it go straight in. The browser's own offer is simulated here.

async function offerInstall(page: Page, outcome: "accepted" | "dismissed") {
  await page.addInitScript((result) => {
    window.addEventListener("DOMContentLoaded", () => {
      const e = new Event("beforeinstallprompt") as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
      e.prompt = () => undefined;
      e.userChoice = Promise.resolve({ outcome: result });
      window.dispatchEvent(e);
    });
  }, outcome);
}

const launch = (page: Page) => page.getByRole("button", { name: "Launch FlipCollab" }).first().click();

test("Launch asks to install first, and Continue in browser goes on into the app", async ({ page }) => {
  await offerInstall(page, "accepted");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await launch(page);
  await expect(page.getByText("Install FlipCollab on your computer")).toBeVisible();
  await page.getByRole("button", { name: "Continue in browser" }).click();
  await expect(page.getByText("Who are you?")).toBeVisible({ timeout: 20_000 });
});

test("installing shows the confirmation", async ({ page }) => {
  await offerInstall(page, "accepted");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await launch(page);
  await page.getByRole("button", { name: "Install FlipCollab" }).click();
  await expect(page.getByText("FlipCollab is installed")).toBeVisible();
});

test("it only asks once per visit", async ({ page }) => {
  await offerInstall(page, "dismissed");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await launch(page);
  await page.getByRole("button", { name: "Continue in browser" }).click();
  await expect(page.getByText("Who are you?")).toBeVisible({ timeout: 20_000 });
  // Back on the landing page in the same tab: straight in this time.
  await page.reload({ waitUntil: "domcontentloaded" });
  await launch(page);
  await expect(page.getByText("Install FlipCollab on your computer")).toBeHidden();
  await expect(page.getByText("Who are you?")).toBeVisible({ timeout: 20_000 });
});

test("a browser that doesn't offer to install goes straight in", async ({ page }) => {
  // Swallow the browser's own offer before the app can see it.
  await page.addInitScript(() => {
    window.addEventListener("beforeinstallprompt", e => e.stopImmediatePropagation(), true);
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await launch(page);
  await expect(page.getByText("Who are you?")).toBeVisible({ timeout: 20_000 });
});
