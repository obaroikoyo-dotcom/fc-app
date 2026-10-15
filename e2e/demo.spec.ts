import { test, expect, type Page } from "@playwright/test";

// The /demo sandbox needs no accounts: it runs on made-up data in the browser.
// These check that the main journeys work end to end and that nothing ever
// reaches the real backend. See src/lib/demo/README.md.

test.use({ viewport: { width: 390, height: 844 } });

type Tables = Record<string, Array<Record<string, any>>>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function openDemo(page: Page, role: "creator" | "brand") {
  const leaks: string[] = [];
  const errors: string[] = [];
  const knownNoise = /OneSignal|Can only be used on|SDK already initialized|googleapis|gstatic|stripe/i;
  page.on("request", r => { if (/supabase\.co|demo\.flipcollab\.invalid/.test(r.url())) leaks.push(r.url()); });
  page.on("pageerror", e => { if (!knownNoise.test(e.message)) errors.push(e.message); });
  await page.goto(`/demo/${role}`, { waitUntil: "domcontentloaded" });
  // A browser that offers to install shows the home-screen ask first: say no.
  await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
  await expect(page.getByText("You're looking at a demo")).toBeVisible({ timeout: 20_000 });
  await page.getByText("Got it", { exact: true }).click();
  return { leaks, errors };
}

async function db(page: Page): Promise<Tables> {
  await page.waitForTimeout(700); // the saved copy is written a moment after each change
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("fc_demo_db") || "null").tables);
}

const myId = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("fc_demo_session") || "null").userId as string);

test("the picker offers both sides and starts a fresh made-up profile", async ({ page }) => {
  await page.goto("/demo", { waitUntil: "domcontentloaded" });
  await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
  await expect(page.getByText("Try the demo")).toBeVisible();
  await page.getByText("I'm a Creator", { exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/creator$/);
  await expect(page.getByText("Discover deals")).toBeVisible({ timeout: 20_000 });
});

test("creator: apply, get accepted, chat, deliver, get paid", async ({ page }) => {
  const { leaks, errors } = await openDemo(page, "creator");
  const uid = await myId(page);

  // Apply to a campaign from a brand the visitor has no deal with yet, so the new
  // chat is its own thread and the funded deal further down is left alone.
  const before = await db(page);
  const dealBrands = new Set(before.applications.filter(a => a.creator_id === uid).map(a => before.campaigns.find(c => c.id === a.campaign_id)?.brand_id));
  const appliedTo = new Set(before.applications.filter(a => a.creator_id === uid).map(a => a.campaign_id));
  const target = before.campaigns.find(c => !c.is_draft && !appliedTo.has(c.id) && !dealBrands.has(c.brand_id))!;
  await page.locator(".item-enter", { has: page.getByText(target.name, { exact: true }) }).getByText("Apply", { exact: true }).click();
  await page.getByPlaceholder(/Introduce yourself/i).fill("Hi, I would love to make this for you.");
  await page.getByText(/TikTok Video|IG Reel|IG Story|YouTube Short/).last().click();
  // some campaigns ask for a video pitch: attach the sample clip
  if (await page.locator("input[type=file]").count()) {
    await page.locator("input[type=file]").first().setInputFiles("public/demo-assets/sample.mp4");
  }
  await page.getByText(/^Submit Application$/i).click();

  // the (simulated) brand accepts a few seconds later and opens a chat
  await expect.poll(async () => {
    const t = await db(page);
    return t.applications.find(a => a.creator_id === uid && a.message.startsWith("Hi, I would love"))?.status;
  }, { timeout: 25_000 }).toBe("accepted");

  // the funded deal: upload a video, the brand approves, the payout is released
  const t = await db(page);
  const funded = t.applications.find(a => a.creator_id === uid && a.status === "funded")!;
  const brandId = t.campaigns.find(c => c.id === funded.campaign_id)!.brand_id;
  const brandName = t.brand_profiles.find(b => b.id === brandId)!.name;
  await page.getByText("Messages", { exact: true }).last().click();
  await page.getByText(brandName, { exact: true }).first().click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Tap to upload your deliverable video").click(),
  ]);
  await chooser.setFiles("public/demo-assets/sample.mp4");
  await expect.poll(async () => (await db(page)).applications.find(a => a.id === funded.id)?.status, { timeout: 30_000 }).toBe("paid");

  expect(leaks, "nothing may reach the real backend").toEqual([]);
  expect(errors).toEqual([]);
});

test("brand: accept, pay, receive the video, approve", async ({ page }) => {
  const { leaks, errors } = await openDemo(page, "brand");
  const uid = await myId(page);

  await page.getByText("Messages", { exact: true }).last().click();
  await page.getByText(/^[0-9]+ applications?$/).first().click(); // first campaign
  await page.getByText(/^pending$/i).first().click(); // first pending applicant
  await page.getByText("Accept & Chat", { exact: true }).click();
  await page.getByText(/Go to messages/i).click();

  const t = await db(page);
  const mine = new Set(t.campaigns.filter(c => c.brand_id === uid).map(c => c.id));
  const accepted = t.applications
    .filter(a => mine.has(a.campaign_id) && a.status === "accepted")
    .sort((a, b) => (b.responded_at || "").localeCompare(a.responded_at || ""))[0];
  const creatorName = t.creator_profiles.find(c => c.id === accepted.creator_id)!.name;
  await page.getByText(creatorName, { exact: true }).first().click();
  await page.getByText("Pay", { exact: true }).first().click();
  await page.getByText(/^Pay £/).click();

  await expect.poll(async () => (await db(page)).applications.find(a => a.id === accepted.id)?.status, { timeout: 15_000 }).toBe("funded");
  // the (simulated) creator hands in a video
  await expect.poll(async () => !!(await db(page)).applications.find(a => a.id === accepted.id)?.deliverable_url, { timeout: 25_000 }).toBe(true);
  await page.evaluate(() => { const s = document.querySelector(".page-enter"); if (s) s.scrollTop = s.scrollHeight; });
  await page.getByText("Yes, I'm happy", { exact: true }).click();
  await expect.poll(async () => (await db(page)).applications.find(a => a.id === accepted.id)?.status, { timeout: 15_000 }).toBe("paid");

  expect(leaks, "nothing may reach the real backend").toEqual([]);
  expect(errors).toEqual([]);
});

test("signing out of the demo goes back to the picker and forgets the visitor", async ({ page }) => {
  await openDemo(page, "creator");
  await page.getByText("Profile", { exact: true }).last().click();
  await expect(page.getByText("My Profile")).toBeVisible();
  await page.mouse.click(352, 35);
  await expect(page.getByText("Account Settings", { exact: true })).toBeVisible();
  await page.getByText("Sign Out", { exact: true }).click();
  await expect(page).toHaveURL(/\/demo$/);
  expect(await page.evaluate(() => sessionStorage.getItem("fc_demo_session"))).toBeNull();
});

test.describe("on an iPhone", () => {
  test.use({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
  });

  test("the demo link opens with a big add-to-home-screen ask, once", async ({ page }) => {
    // Straight away on the picker, before choosing brand or creator.
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    const ask = page.getByText("Add FlipCollab to your home screen");
    await expect(ask).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Tap Add to Home Screen")).toBeVisible(); // the steps are on show
    await page.getByText("Continue in browser", { exact: true }).click();
    await expect(ask).toBeHidden();

    // Choosing a side must not bring it back.
    await page.getByText("I'm a Creator", { exact: true }).click();
    await expect(page.getByText("You're looking at a demo")).toBeVisible({ timeout: 20_000 });
    await expect(ask).toBeHidden();
  });

  test("a direct /demo/brand link asks straight away too", async ({ page }) => {
    await page.goto("/demo/brand", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Add FlipCollab to your home screen")).toBeVisible({ timeout: 5_000 });
  });
});
