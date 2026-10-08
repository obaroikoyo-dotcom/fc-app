import { test, expect, type Page } from "@playwright/test";
import { haveAccounts, logIn, tapNav, watchForErrors } from "./helpers";

// The money moment: a funded deal with a delivered video, the brand answers
// "Are you happy with the content?", the creator sees the payout released.
//
// This USES UP a deal, so it only runs when you ask for it:
//   E2E_RUN_RELEASE=1 npx playwright test review-and-release
// Before each run, set one deal up by hand in test mode (steps in e2e/README.md).
// E2E_BRAND_NAME and E2E_CREATOR_NAME are the names shown in the chat list.
const brandName = process.env.E2E_BRAND_NAME;
const creatorName = process.env.E2E_CREATOR_NAME;

async function openChatWith(page: Page, who: "brand" | "creator", otherName: string) {
  await tapNav(page, "Messages");
  // A brand lands on the Applications tab first; the chats are on the other tab.
  if (who === "brand") await page.getByText("messages", { exact: true }).click();
  await page.getByText(otherName).first().click();
}

test.describe("review and release", () => {
  test.skip(!haveAccounts || !process.env.E2E_RUN_RELEASE || !brandName || !creatorName,
    "Set E2E_RUN_RELEASE=1, E2E_BRAND_NAME, E2E_CREATOR_NAME and the test accounts to run this.");

  test("the brand says yes and the creator is paid", async ({ browser }) => {
    // Two separate people, two separate browser sessions.
    const brandPage = await (await browser.newContext()).newPage();
    const creatorPage = await (await browser.newContext()).newPage();
    const brandErrors = watchForErrors(brandPage);
    const creatorErrors = watchForErrors(creatorPage);

    await logIn(brandPage, "brand");
    await openChatWith(brandPage, "brand", creatorName!);

    await expect(brandPage.getByText("Are you happy with the content?")).toBeVisible({ timeout: 20_000 });
    await expect(brandPage.getByText("Payment Secured")).toBeVisible();
    // Until the money is released the brand only gets the watermarked preview.
    await expect(brandPage.getByText(/This is a preview/)).toBeVisible();

    await brandPage.getByText("Yes, I'm happy", { exact: true }).click();
    await expect(brandPage.getByText("Are you happy with the content?")).toBeHidden({ timeout: 45_000 });

    await logIn(creatorPage, "creator");
    await openChatWith(creatorPage, "creator", brandName!);
    await expect(creatorPage.getByText(/Payout released/)).toBeVisible({ timeout: 30_000 });

    expect(brandErrors).toEqual([]);
    expect(creatorErrors).toEqual([]);
  });
});
