import { test, expect } from "@playwright/test";
import { launchApp, openLogin, watchForErrors } from "./helpers";

// No accounts needed: this is what a brand-new visitor sees.

test("the landing page loads and launches the app", async ({ page }) => {
  const errors = watchForErrors(page);
  await launchApp(page);
  await expect(page.getByText("I'm a Brand")).toBeVisible();
  await expect(page.getByText("I'm a Creator")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the login screen opens from the role screen", async ({ page }) => {
  await openLogin(page);
  await expect(page.getByPlaceholder("you@email.com")).toBeVisible();
  await expect(page.getByText("Forgot password?")).toBeVisible();
});

test("a wrong password shows an error and does not log in", async ({ page }) => {
  await openLogin(page);
  await page.getByPlaceholder("you@email.com").fill("e2e-nobody@example.invalid");
  await page.getByPlaceholder("••••••••").fill("not-a-real-password");
  await page.getByText("Log In", { exact: true }).click();
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.locator("p", { hasText: /invalid|incorrect|wrong|credentials|not confirmed/i }).first()).toBeVisible({ timeout: 20_000 });
});
