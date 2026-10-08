import { test, expect } from "@playwright/test";
import { haveAccounts, logIn, tapNav, watchForErrors } from "./helpers";

// Needs the two test accounts (see e2e/README.md). Skipped until they exist.
test.describe("signed in", () => {
  test.skip(!haveAccounts, "Add the test accounts to .env.e2e.local to run these.");

  for (const who of ["creator", "brand"] as const) {
    test(`the ${who} test account can log in and move around`, async ({ page }) => {
      const errors = watchForErrors(page);
      await logIn(page, who);

      await tapNav(page, "Messages");
      await page.waitForTimeout(1500);
      await tapNav(page, "Profile");
      await page.waitForTimeout(1500);
      await tapNav(page, "Search");
      await page.waitForTimeout(1500);

      // The bottom bar is still there and nothing crashed along the way.
      await expect(page.getByText("Messages", { exact: true }).last()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
