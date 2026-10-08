import { expect, type Page } from "@playwright/test";

// The two accounts the signed-in tests use. Create them once by hand (one
// brand, one creator) and keep them for testing only. Put the details in a
// file called .env.e2e.local (see e2e/README.md); it is never committed.
export const accounts = {
  brand: { email: process.env.E2E_BRAND_EMAIL, password: process.env.E2E_BRAND_PASSWORD },
  creator: { email: process.env.E2E_CREATOR_EMAIL, password: process.env.E2E_CREATOR_PASSWORD },
};

export const haveAccounts = !!(accounts.brand.email && accounts.brand.password && accounts.creator.email && accounts.creator.password);

// Landing page -> app -> the "Who are you?" screen.
export async function launchApp(page: Page) {
  // Don't wait for every external script (fonts, push, Stripe) to finish loading.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Launch FlipCollab" }).first().click();
  await expect(page.getByText("Who are you?")).toBeVisible({ timeout: 20_000 });
}

export async function openLogin(page: Page) {
  await launchApp(page);
  await page.getByText("Log in", { exact: true }).click();
  await expect(page.getByText("Welcome back")).toBeVisible();
}

export async function logIn(page: Page, who: "brand" | "creator") {
  const { email, password } = accounts[who];
  if (!email || !password) throw new Error(`Missing E2E_${who.toUpperCase()}_EMAIL / PASSWORD`);
  await openLogin(page);
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByText("Log In", { exact: true }).click();
  // The login screen goes away once the session is in.
  await expect(page.getByText("Welcome back")).toBeHidden({ timeout: 30_000 });
}

// Taps a label in the bottom bar. The bar is the last thing on the page, so a
// heading with the same word (like Messages) is never the one that gets tapped.
export async function tapNav(page: Page, label: "Messages" | "Profile" | "Search" | "Explore") {
  await page.getByText(label, { exact: true }).last().click();
}

// Collects anything the app throws in the browser so a test can fail on it.
export function watchForErrors(page: Page) {
  const errors: string[] = [];
  // OneSignal (push notifications) only works on the real website address, so
  // it complains when the app runs locally. That's expected, not a bug.
  const knownLocalNoise = /Can only be used on: https:\/\/flipcollab\.com|SDK already initialized/;
  page.on("pageerror", (e) => { if (!knownLocalNoise.test(e.message)) errors.push(e.message); });
  return errors;
}
