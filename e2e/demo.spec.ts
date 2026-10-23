import { test, expect, type Page } from "@playwright/test";

// The /demo sandbox needs no accounts: it runs on made-up data in the browser.
// These check that the main journeys work end to end and that nothing ever
// reaches the real backend. See src/lib/demo/README.md.

test.use({ viewport: { width: 390, height: 844 } });

// The demo only opens with a private link key. The dev server accepts this one
// (the production build does not), so the tests need no real link.
const KEY = "k=e2e-dev-key";

type Tables = Record<string, Array<Record<string, any>>>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function openDemo(page: Page, role: "creator" | "brand") {
  const leaks: string[] = [];
  const errors: string[] = [];
  const knownNoise = /OneSignal|Can only be used on|SDK already initialized|googleapis|gstatic|stripe/i;
  page.on("request", r => { if (/supabase\.co|demo\.flipcollab\.invalid/.test(r.url())) leaks.push(r.url()); });
  page.on("pageerror", e => { if (!knownNoise.test(e.message)) errors.push(e.message); });
  await page.goto(`/demo/${role}?${KEY}`, { waitUntil: "domcontentloaded" });
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
  await page.goto(`/demo?${KEY}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
  await expect(page.getByText("Try the demo")).toBeVisible();
  await page.getByText("I'm a Creator", { exact: true }).click();
  // the key travels with the link so a copied address still works for others
  await expect(page).toHaveURL(/\/demo\/creator\?k=e2e-dev-key$/);
  await expect(page.getByText("Discover deals")).toBeVisible({ timeout: 20_000 });
});

test.describe("without the private link", () => {
  for (const [name, path] of [
    ["no key", "/demo"],
    ["no key on a side", "/demo/brand"],
    ["a wrong key", "/demo?k=not-the-key"],
    ["an empty key", "/demo/creator?k="],
  ] as const) {
    test(`${name}: sent to the front page, nothing of the demo shown`, async ({ page }) => {
      const leaks: string[] = [];
      // the demo's backend (a separate chunk) must not even be downloaded
      page.on("request", r => { if (/supabase\.co|demo\.flipcollab\.invalid|\/lib\/demo\/engine/.test(r.url())) leaks.push(r.url()); });
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/^[^?]*\/$/, { timeout: 10_000 });
      await expect(page.getByText("Try the demo")).toHaveCount(0);
      await expect(page.getByText("You're looking at a demo")).toHaveCount(0);
      expect(await page.evaluate(() => sessionStorage.getItem("fc_demo_session"))).toBeNull();
      expect(await page.evaluate(() => sessionStorage.getItem("fc_demo_key"))).toBeNull();
      expect(leaks).toEqual([]);
    });
  }

  test("a key that was good earlier in the tab stops working once it is no longer valid", async ({ page }) => {
    await page.goto(`/demo?${KEY}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Try the demo")).toBeVisible();
    // Someone swaps in a wrong key by hand: the saved one must not carry it.
    await page.evaluate(() => sessionStorage.setItem("fc_demo_key", "forged"));
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/^[^?]*\/$/, { timeout: 10_000 });
    expect(await page.evaluate(() => sessionStorage.getItem("fc_demo_key"))).toBeNull();
  });

  test("a valid key is remembered for the tab, so a reload without it still opens", async ({ page }) => {
    await page.goto(`/demo?${KEY}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Try the demo")).toBeVisible();
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Try the demo")).toBeVisible();
  });
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
  await expect(page).toHaveURL(/\/demo\?k=e2e-dev-key$/);
  await expect(page.getByText("Try the demo")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("fc_demo_session"))).toBeNull();
});

test("brand: an applicant's pitch video is a watermarked preview", async ({ page }) => {
  await openDemo(page, "brand");
  // the seeded applicants have no pitch video: give this brand's applicants one
  await page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem("fc_demo_db") || "null");
    const uid = JSON.parse(sessionStorage.getItem("fc_demo_session") || "null").userId;
    const mine = new Set(saved.tables.campaigns.filter((c: { brand_id: string }) => c.brand_id === uid).map((c: { id: string }) => c.id));
    for (const a of saved.tables.applications) if (mine.has(a.campaign_id)) a.video_url = "/demo-assets/sample.mp4";
    sessionStorage.setItem("fc_demo_db", JSON.stringify(saved));
  });
  await db(page); // let the saved copy settle, then read the edit back in
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
  await page.getByText("Messages", { exact: true }).last().click({ timeout: 20_000 });
  await page.getByText(/^[0-9]+ applications?$/).first().click();
  await page.getByText(/^pending$/i).first().click();

  await expect(page.getByText("Video Pitch", { exact: true })).toBeVisible();
  await expect(page.getByText("PREVIEW", { exact: true }).first()).toBeAttached();
  await expect(page.getByText("This is a preview of their pitch.")).toBeVisible();
  // no native player: its own download and full screen buttons are not offered
  await expect(page.locator("video[controls]")).toHaveCount(0);
});

test("a video is never recoloured by the look, in the page or in full screen", async ({ page }) => {
  await openDemo(page, "creator");
  await page.evaluate(() => {
    const v = document.createElement("video");
    v.src = "/demo-assets/sample.mp4";
    v.muted = true;
    v.style.cssText = "position:relative;width:300px;height:170px;background:#000";
    document.querySelector(".app-shell")!.appendChild(v);
  });
  const video = page.locator(".app-shell > video").last();
  // Light mode is real colours now, so nothing above the video recolours it and its backdrop stays black.
  expect(await video.evaluate(v => { for (let el: Element | null = v; el; el = el.parentElement) { const f = getComputedStyle(el).filter; if (f && f !== "none") return f; } return "none"; })).toBe("none");
  expect(await video.evaluate(v => getComputedStyle(v).backgroundColor)).toBe("rgb(0, 0, 0)");
  await video.click({ position: { x: 150, y: 60 } }); // a real click, so full screen is allowed
  await video.evaluate(v => v.requestFullscreen());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe("VIDEO");
  expect(await page.evaluate(() => getComputedStyle(document.fullscreenElement!).filter)).toBe("none");
  await page.evaluate(() => document.exitFullscreen());
});

// How far down the fixed header at the top reaches (the list below must start under it).
const headerBottom = (page: Page) => page.getByText(/^Filters/).evaluate(el => {
  let node: HTMLElement | null = el as HTMLElement;
  while (node && getComputedStyle(node).position !== "fixed") node = node.parentElement;
  return node ? node.getBoundingClientRect().bottom : 0;
});

test.describe("filters", () => {
  test("creator: tucked away until the button is tapped, long niche list, picking one filters the feed", async ({ page }) => {
    const { leaks, errors } = await openDemo(page, "creator");
    const t = await db(page);
    const uid = await myId(page);
    const applied = new Set(t.applications.filter(a => a.creator_id === uid).map(a => a.campaign_id));
    const shown = (niche: string) => t.campaigns.filter(c => !c.is_draft && c.niche === niche && !applied.has(c.id)).length;
    const niche = ["Wellness", "Tech", "Beauty", "Fitness", "Food", "Fashion", "Travel", "Gaming", "Pets", "Lifestyle"].find(n => shown(n) > 0)!;

    // tucked away to start
    await expect(page.getByText("Filters", { exact: true })).toBeVisible();
    await expect(page.locator("[aria-haspopup='listbox']")).toHaveCount(0);
    const closedBottom = await headerBottom(page);

    // the button opens the menus, and the list moves down with the header
    await page.getByText(/^Filters/).click();
    await expect(page.locator("[aria-haspopup='listbox']")).toHaveCount(3);
    expect(await headerBottom(page)).toBeGreaterThan(closedBottom);
    const firstCardTop = await page.locator(".item-enter").first().evaluate(el => el.getBoundingClientRect().top);
    expect(firstCardTop, "the first campaign is not hidden under the header").toBeGreaterThanOrEqual(await headerBottom(page));

    // a long list: many niches, including ones that used to be missing, in A to Z order
    await page.locator("[aria-haspopup='listbox']").first().click();
    const options = await page.locator("[role='option']").allInnerTexts();
    expect(options.length).toBeGreaterThanOrEqual(40);
    for (const added of ["Anime", "Home & Garden", "Property", "Student Life", "Wellness"]) expect(options).toContain(added);
    const named = options.slice(1); // the first row clears the filter
    expect(named, "niches are in A to Z order").toEqual([...named].sort((a, b) => a.localeCompare(b)));
    // it scrolls inside its own menu rather than running off the screen
    const menu = await page.locator("[role='listbox']").evaluate(el => ({ scrolls: el.scrollHeight > el.clientHeight, bottom: el.getBoundingClientRect().bottom, view: innerHeight }));
    expect(menu.scrolls).toBe(true);
    expect(menu.bottom).toBeLessThanOrEqual(menu.view);

    // picking a niche closes the menu, counts as one filter and filters the feed
    await page.getByRole("option", { name: niche, exact: true }).click();
    await expect(page.locator("[role='listbox']")).toHaveCount(0);
    await expect(page.getByText("Filters (1)")).toBeVisible();
    await expect(page.locator(".item-enter")).toHaveCount(shown(niche));

    // a niche nobody has posted in says so, and Clear filters brings the feed back
    await page.locator("[aria-haspopup='listbox']").first().click();
    await page.getByRole("option", { name: "Property", exact: true }).click();
    await expect(page.getByText("Nothing matches those filters")).toBeVisible();
    await page.getByText("Clear filters", { exact: true }).click();
    await expect(page.getByText(/^Filters$/)).toBeVisible();
    await expect(page.locator(".item-enter").first()).toBeVisible();

    expect(leaks, "nothing may reach the real backend").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("tapping away closes a menu without pressing what was underneath, and Escape closes it too", async ({ page }) => {
    await openDemo(page, "creator");
    await page.getByText(/^Filters/).click();
    await page.locator("[aria-haspopup='listbox']").first().click();
    await expect(page.locator("[role='listbox']")).toHaveCount(1);

    // an Apply button is on screen under the tap: it must not open the application
    await page.getByText("Apply", { exact: true }).first().click({ force: true });
    await expect(page.locator("[role='listbox']")).toHaveCount(0);
    await expect(page.getByPlaceholder(/Introduce yourself/i)).toHaveCount(0);
    await expect(page.getByText("Discover deals", { exact: false }).first()).toBeVisible();

    // opening one menu while another is open leaves only the new one open
    await page.locator("[aria-haspopup='listbox']").nth(0).click();
    await page.locator("[aria-haspopup='listbox']").nth(1).click();
    await expect(page.locator("[role='listbox']")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(page.locator("[role='listbox']")).toHaveCount(0);
  });

  test("brand: same button, same niche list, and a filter that hides everything says so", async ({ page }) => {
    const { leaks, errors } = await openDemo(page, "brand");
    const t = await db(page);
    const uid = await myId(page);
    const mine = t.campaigns.filter(c => c.brand_id === uid);
    const niche = mine.find(c => c.niche)!.niche as string;
    const shown = mine.filter(c => c.niche === niche).length;

    await expect(page.locator("[aria-haspopup='listbox']")).toHaveCount(0);
    await page.getByText(/^Filters/).click();
    await expect(page.locator("[aria-haspopup='listbox']")).toHaveCount(2);

    await page.locator("[aria-haspopup='listbox']").first().click();
    const options = await page.locator("[role='option']").allInnerTexts();
    expect(options.length).toBeGreaterThanOrEqual(40);
    for (const added of ["Anime", "Property", "Weddings"]) expect(options).toContain(added);

    await page.getByRole("option", { name: niche, exact: true }).click();
    await expect(page.getByText("Filters (1)")).toBeVisible();
    await expect(page.locator(".item-enter")).toHaveCount(shown);

    // hiding everything must not claim "No campaigns yet" when there are some
    await page.locator("[aria-haspopup='listbox']").first().click();
    await page.getByRole("option", { name: "Property", exact: true }).click();
    await expect(page.getByText("Nothing matches those filters")).toBeVisible();
    await expect(page.getByText("No campaigns yet")).toHaveCount(0);
    await page.getByText("Clear Filters", { exact: true }).click();
    await expect(page.locator(".item-enter")).toHaveCount(mine.length);

    expect(leaks, "nothing may reach the real backend").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("search: same menu and niche list, and a creator with several niches matches each of them", async ({ page }) => {
    const { leaks, errors } = await openDemo(page, "creator");
    const uid = await myId(page);
    // give one creator two niches (profiles can list several), then read it back in
    const other = await page.evaluate(me => {
      const saved = JSON.parse(sessionStorage.getItem("fc_demo_db") || "null");
      const creator = saved.tables.creator_profiles.find((p: { id: string }) => p.id !== me);
      creator.niche = "Beauty, Anime";
      sessionStorage.setItem("fc_demo_db", JSON.stringify(saved));
      return creator.name as string;
    }, uid);
    await db(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("Not now", { exact: true }).click({ timeout: 2_000 }).catch(() => undefined);
    await page.getByText("Search", { exact: true }).last().click({ timeout: 20_000 });

    await expect(page.locator("[aria-haspopup='listbox']")).toHaveCount(0);
    await page.getByText(/^Filters/).click();
    await page.locator("[aria-haspopup='listbox']").first().click();
    const options = await page.locator("[role='option']").allInnerTexts();
    expect(options.length).toBeGreaterThanOrEqual(40);
    for (const added of ["Anime", "Property", "Weddings"]) expect(options).toContain(added);

    // the creator with "Beauty, Anime" turns up under each of those niches, and under nothing else
    await page.getByRole("option", { name: "Anime", exact: true }).click();
    await expect(page.getByText("Filters (1)")).toBeVisible();
    await expect(page.getByText(other, { exact: true })).toBeVisible();
    await expect(page.locator(".item-enter")).toHaveCount(1);
    await page.locator("[aria-haspopup='listbox']").first().click();
    await page.getByRole("option", { name: "Beauty", exact: true }).click();
    await expect(page.getByText(other, { exact: true })).toBeVisible();
    await page.locator("[aria-haspopup='listbox']").first().click();
    await page.getByRole("option", { name: "Property", exact: true }).click();
    await expect(page.getByText("No one matches that")).toBeVisible();
    await page.getByText("Clear search", { exact: true }).click();
    await expect(page.locator(".item-enter").first()).toBeVisible();

    expect(leaks, "nothing may reach the real backend").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("brand: the campaign form offers the same niches", async ({ page }) => {
    await openDemo(page, "brand");
    await page.getByText("Post", { exact: true }).last().click();
    const select = page.locator("select").filter({ has: page.locator("option", { hasText: "Wellness" }) }).first();
    const options = await select.locator("option").allInnerTexts();
    expect(options.length).toBeGreaterThanOrEqual(41); // a prompt row plus every niche
    for (const added of ["Anime", "Home & Garden", "Property"]) expect(options).toContain(added);
  });
});

test.describe("explore shelves", () => {
  const shelf = (page: Page, title: string) => page.locator(`section[aria-label='${title}']`);

  test("rows to swipe sideways sit above the feed, open the campaign, and 'See all' narrows the feed", async ({ page }) => {
    const { leaks, errors } = await openDemo(page, "creator");
    const t = await db(page);
    const uid = await myId(page);
    const applied = new Set(t.applications.filter(a => a.creator_id === uid).map(a => a.campaign_id));
    const discover = t.campaigns.filter(c => !c.is_draft && !applied.has(c.id));

    // the three rows, then the whole feed under its own heading
    for (const title of ["Closing soon", "Top paying", "New today"]) await expect(shelf(page, title)).toBeVisible();
    await expect(page.getByText("All campaigns", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".item-enter")).toHaveCount(discover.length);

    // a row swipes sideways and each card says what it is
    const top = shelf(page, "Top paying");
    const swipe = await top.locator(".shelf-scroll").evaluate(el => ({ scrolls: el.scrollWidth > el.clientWidth, cards: el.children.length }));
    expect(swipe.scrolls).toBe(true);
    await expect(shelf(page, "Closing soon").getByText(/^Due (today|tomorrow|in \d+ days)$/).first()).toBeVisible();
    await expect(top.getByText("You'd earn").first()).toBeVisible();

    // tapping a card goes to that campaign's application
    await shelf(page, "Closing soon").locator(".shelf-scroll > [role='button']").first().click();
    await expect(page.getByPlaceholder(/Introduce yourself/i)).toBeVisible({ timeout: 10_000 });
    await page.getByText("Explore", { exact: true }).last().click();

    // "See all" narrows the feed to that row, in its order, and "Show everything" brings the rest back
    const total = Number(await shelf(page, "Top paying").locator("p span").first().innerText());
    await shelf(page, "Top paying").getByText("See all", { exact: true }).click();
    await expect(shelf(page, "Top paying")).toHaveCount(0);
    await expect(page.getByText("Show everything", { exact: true })).toBeVisible();
    await expect(page.locator(".item-enter")).toHaveCount(total);
    const earnings = (await page.locator(".item-enter").getByText(/^£[\d,.]+$/).allInnerTexts()).map(s => Number(s.replace(/[£,]/g, "")));
    expect(earnings, "highest paying first").toEqual([...earnings].sort((a, b) => b - a));
    await page.getByText("Show everything", { exact: true }).click();
    await expect(page.locator(".item-enter")).toHaveCount(discover.length);
    await expect(shelf(page, "Top paying")).toBeVisible();

    expect(leaks, "nothing may reach the real backend").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("every campaign card has a colour band named for its niche, the same colour for the same niche", async ({ page }) => {
    await openDemo(page, "creator");
    const t = await db(page);
    const uid = await myId(page);
    const applied = new Set(t.applications.filter(a => a.creator_id === uid).map(a => a.campaign_id));
    const discover = t.campaigns.filter(c => !c.is_draft && !applied.has(c.id));

    const bands = await page.locator(".item-enter > .campaign-tile").evaluateAll(els => els.map(el => ({
      niche: el.querySelector("span")?.textContent || "",
      colour: getComputedStyle(el).backgroundColor,
    })));
    expect(bands.length, "one band on every card in the feed").toBe(discover.length);
    const seen = new Map<string, string>();
    for (const b of bands) {
      expect(b.niche, "the band names the niche").not.toBe("");
      if (seen.has(b.niche)) expect(b.colour, `${b.niche} is always the same colour`).toBe(seen.get(b.niche));
      else seen.set(b.niche, b.colour);
    }
    // the shelf cards carry a (shorter) band too
    expect(await page.locator("section[aria-label] .shelf-scroll > [role='button'] > .campaign-tile").count()).toBeGreaterThan(0);
    // a campaign posted within a day or due within three days says so on its band
    await expect(page.locator(".item-enter > .campaign-tile").getByText(/^(New|Closing soon)$/).first()).toBeVisible();
  });

  test("brand Market tab: the same rows and colour bands, tapping opens a preview or a profile, no rows on Your Campaigns", async ({ page }) => {
    const { leaks, errors } = await openDemo(page, "brand");
    const t = await db(page);
    const uid = await myId(page);
    const myName = t.brand_profiles.find(b => b.id === uid)!.name as string;
    const market = t.campaigns.filter(c => !c.is_draft);

    // Your Campaigns: bands on the cards, no rows
    await expect(page.locator("section[aria-label]")).toHaveCount(0);
    const mine = t.campaigns.filter(c => c.brand_id === uid);
    await expect(page.locator(".item-enter > .campaign-tile")).toHaveCount(mine.length);

    // Market: the three rows, money shown as a budget, and a band on every card
    await page.getByText("Market", { exact: true }).click();
    for (const title of ["Closing soon", "Top paying", "New today"]) await expect(shelf(page, title)).toBeVisible();
    await expect(shelf(page, "Top paying").getByText("Budget").first()).toBeVisible();
    await expect(page.locator(".item-enter")).toHaveCount(market.length);
    await expect(page.locator(".item-enter > .campaign-tile")).toHaveCount(market.length);
    expect(await shelf(page, "Top paying").locator(".shelf-scroll").evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);

    // another brand's card opens their profile
    const theirs = shelf(page, "Top paying").locator(".shelf-scroll > [role='button']").filter({ hasNotText: myName }).first();
    await theirs.click();
    await expect(page.getByText("Market", { exact: true })).toHaveCount(0);
    await page.getByText("←", { exact: true }).first().click();
    await page.getByText("Market", { exact: true }).click();

    // one of your own opens its preview
    await shelf(page, "Top paying").locator(".shelf-scroll > [role='button']").filter({ hasText: myName }).first().click();
    await expect(page.getByText("Campaign Preview", { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByText("←", { exact: true }).first().click();
    await page.getByText("Market", { exact: true }).click();

    // See all narrows the list to the row, Show everything undoes it
    const total = Number(await shelf(page, "Top paying").locator("p span").first().innerText());
    await shelf(page, "Top paying").getByText("See all", { exact: true }).click();
    await expect(page.locator(".item-enter")).toHaveCount(total);
    await page.getByText("Show everything", { exact: true }).click();
    await expect(page.locator(".item-enter")).toHaveCount(market.length);

    // a filter puts the rows away
    await page.getByText(/^Filters/).click();
    await page.locator("[aria-haspopup='listbox']").first().click();
    await page.getByRole("option", { name: "Wellness", exact: true }).click();
    await expect(page.locator("section[aria-label]")).toHaveCount(0);

    expect(leaks, "nothing may reach the real backend").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("with a mouse a row has arrows that scroll it, each greyed out at its end", async ({ page }) => {
    const { errors } = await openDemo(page, "creator");
    const row = shelf(page, "Top paying");
    const scroller = row.locator(".shelf-scroll");
    const left = row.getByRole("button", { name: "Scroll Top paying left" });
    const right = row.getByRole("button", { name: "Scroll Top paying right" });
    const x = () => scroller.evaluate(el => el.scrollLeft);

    await expect(left).toBeVisible();
    await expect(left, "nothing to the left at the start").toBeDisabled();
    await expect(right).toBeEnabled();
    expect(await x()).toBe(0);

    await right.click();
    await expect.poll(x, "the arrow moves the row").toBeGreaterThan(100);
    await expect(left).toBeEnabled();

    // keep going until the last card: then there is nowhere further to go
    for (let i = 0; i < 12 && await right.isEnabled(); i++) {
      await right.click();
      await page.waitForTimeout(450);
    }
    await expect(right).toBeDisabled();
    await expect(left).toBeEnabled();

    await left.click();
    await expect(right).toBeEnabled({ timeout: 5_000 });

    // the arrows do not cover "See all"
    await expect(row.getByText("See all", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the rows step aside for a filter and for My Pitches", async ({ page }) => {
    await openDemo(page, "creator");
    await expect(page.locator("section[aria-label]").first()).toBeVisible();

    await page.getByText(/^Filters/).click();
    await page.locator("[aria-haspopup='listbox']").first().click();
    await page.getByRole("option", { name: "Wellness", exact: true }).click();
    await expect(page.locator("section[aria-label]")).toHaveCount(0);
    await page.locator("[aria-haspopup='listbox']").first().click();
    await page.locator("[role='option']").first().click(); // the first row clears the niche
    await expect(page.locator("section[aria-label]").first()).toBeVisible();

    await page.getByText(/^My Pitches/).click();
    await expect(page.locator("section[aria-label]")).toHaveCount(0);
  });
});

test.describe("changing a deal's price in the chat", () => {
  const card = (page: Page) => page.getByTestId("deal-price-card");
  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  test("creator: offer a price, get it accepted, get a counter-offer and accept it; the campaign's own price never moves", async ({ page }) => {
    const { leaks, errors } = await openDemo(page, "creator");
    const uid = await myId(page);

    // Apply to a paid campaign from a brand the visitor has no deal with yet
    const before = await db(page);
    const dealBrands = new Set(before.applications.filter(a => a.creator_id === uid).map(a => before.campaigns.find(c => c.id === a.campaign_id)?.brand_id));
    const appliedTo = new Set(before.applications.filter(a => a.creator_id === uid).map(a => a.campaign_id));
    const target = before.campaigns.find(c => !c.is_draft && c.type === "paid" && Number(c.budget) >= 100 && !appliedTo.has(c.id) && !dealBrands.has(c.brand_id))!;
    const base = Math.round(Number(target.budget));
    const brandName = before.brand_profiles.find(b => b.id === target.brand_id)!.name as string;
    await page.locator(".item-enter", { has: page.getByText(target.name, { exact: true }) }).getByText("Apply", { exact: true }).click();
    await page.getByPlaceholder(/Introduce yourself/i).fill("Hi, I would love to make this for you.");
    await page.getByText(/TikTok Video|IG Reel|IG Story|YouTube Short/).last().click();
    if (await page.locator("input[type=file]").count()) await page.locator("input[type=file]").first().setInputFiles("public/demo-assets/sample.mp4");
    await page.getByText(/^Submit Application$/i).click();
    await expect.poll(async () => (await db(page)).applications.find(a => a.creator_id === uid && a.campaign_id === target.id)?.status, { timeout: 25_000 }).toBe("accepted");

    await page.getByText("Messages", { exact: true }).last().click();
    await page.getByText(brandName, { exact: true }).first().click();

    // the price is on show, with what it means for the creator (90% after the platform fee)
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByText(`£${base.toLocaleString()}`, { exact: true })).toBeVisible();
    await expect(card(page).getByText(`You'd receive £${money(base * 0.9)} after the 10% platform fee`)).toBeVisible();

    // offers that are not allowed are refused, with a reason, and nothing is saved
    await card(page).getByRole("button", { name: "Offer a different price" }).click();
    await card(page).getByRole("textbox").fill("0");
    await card(page).getByRole("button", { name: "Send offer" }).click();
    await expect(card(page).getByRole("alert")).toContainText("whole number of pounds");
    await card(page).getByRole("textbox").fill(String(base));
    await card(page).getByRole("button", { name: "Send offer" }).click();
    await expect(card(page).getByRole("alert")).toContainText("already the price");
    expect((await db(page)).price_offers).toEqual([]);

    // a fair offer is sent, then the (simulated) brand accepts it
    const fair = base + 20;
    await card(page).getByRole("textbox").fill(String(fair));
    await card(page).getByRole("button", { name: "Send offer" }).click();
    await expect(card(page).getByText(`You offered £${fair.toLocaleString()}`)).toBeVisible();
    await expect(card(page).getByText("Agreed price")).toBeVisible({ timeout: 15_000 });
    await expect(card(page).getByText(`£${fair.toLocaleString()}`, { exact: true })).toBeVisible();

    // an offer far too high is declined and the brand comes back with its own price
    await card(page).getByRole("button", { name: "Offer a different price" }).click();
    await card(page).getByRole("textbox").fill(String(fair * 10));
    await card(page).getByRole("button", { name: "Send offer" }).click();
    const counter = fair * 2;
    await expect(card(page).getByText(`${brandName} offered £${counter.toLocaleString()}`)).toBeVisible({ timeout: 15_000 });
    await card(page).getByRole("button", { name: `Accept £${counter.toLocaleString()}` }).click();
    await expect(card(page).getByText(`£${counter.toLocaleString()}`, { exact: true })).toBeVisible();

    // what was saved: each offer's end state, and the campaign itself untouched
    const t = await db(page);
    const app = t.applications.find(a => a.creator_id === uid && a.campaign_id === target.id)!;
    const offers = t.price_offers.filter(o => o.application_id === app.id);
    expect(offers.map(o => `${o.amount}:${o.status}`).sort()).toEqual([`${fair}:accepted`, `${fair * 10}:declined`, `${counter}:accepted`].sort());
    expect(Number(t.campaigns.find(c => c.id === target.id)!.budget), "the campaign keeps its own price").toBe(Number(target.budget));

    expect(leaks, "nothing may reach the real backend").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("brand: a lower price is agreed in the chat; the brand is charged that price plus its fee and the creator gets it less theirs", async ({ page }) => {
    const { leaks, errors } = await openDemo(page, "brand");
    const uid = await myId(page);
    const t0 = await db(page);
    const mine = new Map(t0.campaigns.filter(c => c.brand_id === uid && !c.is_draft && c.type === "paid" && Number(c.budget) >= 100).map(c => [c.id, c]));
    const pending = t0.applications.find(a => mine.has(a.campaign_id) && a.status === "pending")!;
    const campaign = mine.get(pending.campaign_id)!;
    const creatorName = t0.creator_profiles.find(c => c.id === pending.creator_id)!.name as string;
    const base = Math.round(Number(campaign.budget));
    const agreed = Math.round(base * 0.8);

    await page.getByText("Messages", { exact: true }).last().click();
    await page.getByText(campaign.name, { exact: true }).first().click();
    await page.getByText(creatorName, { exact: true }).first().click();
    await page.getByText("Accept & Chat", { exact: true }).click();
    await page.getByText(/Go to messages/i).click();
    await page.getByText(creatorName, { exact: true }).first().click();

    await expect(card(page)).toBeVisible();
    await expect(card(page).getByText(`£${money(base * 1.05)} charged to you, including the 5% platform fee`)).toBeVisible();
    await card(page).getByRole("button", { name: "Offer a different price" }).click();
    await card(page).getByRole("textbox").fill(String(agreed));
    await expect(card(page).getByText(`£${money(agreed * 1.05)} charged to you, including the 5% platform fee`)).toBeVisible(); // the preview
    await card(page).getByRole("button", { name: "Send offer" }).click();
    await expect(card(page).getByText("Agreed price")).toBeVisible({ timeout: 15_000 });

    // paying: the button and the saved payment both use the agreed price
    await page.getByText("Pay", { exact: true }).first().click();
    await expect(page.getByText(`Pay £${money(agreed * 1.05)}`)).toBeVisible();
    await page.getByText(/^Pay £/).click();
    await expect.poll(async () => (await db(page)).applications.find(a => a.id === pending.id)?.status, { timeout: 15_000 }).toBe("funded");
    const after = await db(page);
    const tx = after.transactions.find(x => x.campaign_id === campaign.id && x.creator_id === pending.creator_id)!;
    expect(tx.creator_payout, "the creator gets the agreed price less their 10%").toBe(Math.round(agreed * 100 * 0.9));
    expect(tx.amount, "the brand is charged the agreed price plus its 5%").toBe(Math.round(agreed * 100 * 1.05));
    expect(Number(after.campaigns.find(c => c.id === campaign.id)!.budget), "the campaign keeps its own price").toBe(Number(campaign.budget));

    // once paid, the price is locked and the card is gone
    await expect(card(page)).toHaveCount(0);

    expect(leaks, "nothing may reach the real backend").toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe("campaign cover photos", () => {
  // The smallest valid PNG: enough to be a real picture the browser can read.
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

  test("brand: a photo added on the Post form replaces the colour band, shows on the Market tab, and can be removed", async ({ page }) => {
    const { leaks, errors } = await openDemo(page, "brand");
    await page.getByText("Post", { exact: true }).last().click();
    const input = page.getByTestId("cover-input");

    // something that is not a photo is refused, with a reason
    await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByText("Choose a JPG, PNG or WebP photo.")).toBeVisible();
    await expect(page.locator(".campaign-tile img")).toHaveCount(0);

    // a real photo shows as a preview of the card's band
    await input.setInputFiles({ name: "shop.png", mimeType: "image/png", buffer: PNG });
    await expect(page.locator(".campaign-tile img")).toHaveCount(1);
    await expect(page.getByText("Choose a JPG, PNG or WebP photo.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();

    await page.getByPlaceholder(/Summer drop launch/).fill("Cover photo check");
    await page.locator("select").filter({ has: page.locator("option", { hasText: "Wellness" }) }).first().selectOption("Wellness");
    await page.getByText("Gifted", { exact: true }).click();
    await page.getByText("Post Campaign", { exact: true }).last().click();

    // saved on the campaign, as a picture the app can show
    await expect(page.getByText("Campaigns", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    const posted = (await db(page)).campaigns.find(c => c.name === "Cover photo check");
    expect(posted?.cover_url, "the photo is saved on the campaign").toMatch(/^data:image\//);

    // Your Campaigns shows it in place of the colour band
    const card = page.locator(".item-enter").filter({ hasText: "Cover photo check" });
    await expect(card.locator(".campaign-tile img")).toHaveCount(1);
    await expect.poll(() => card.locator(".campaign-tile img").evaluate((img: HTMLImageElement) => img.naturalWidth), "the picture actually loads").toBeGreaterThan(0);
    // a wide banner (5:2, not tall enough to fill the screen), and nothing laid over it to dim it: only the
    // picture and the small label and tag sit in it
    const tile = card.locator(".campaign-tile").first();
    const box = (await tile.boundingBox())!;
    expect(Math.abs(box.height / box.width - 2 / 5), "5:2").toBeLessThan(0.02);
    await expect(tile.locator(":scope > div"), "no dark layer over the photo").toHaveCount(0);

    // and so does the Market tab (the same card for everyone else)
    await page.getByText("Market", { exact: true }).click();
    await expect(page.locator(".item-enter").filter({ hasText: "Cover photo check" }).locator(".campaign-tile img")).toHaveCount(1);

    // editing it: the saved photo is there to see, and Remove puts the colour band back
    await page.getByText("Your Campaigns", { exact: true }).click();
    await page.locator(".item-enter").filter({ hasText: "Cover photo check" }).getByTitle("Edit").click();
    await expect(page.locator(".campaign-tile img")).toHaveCount(1);
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Add a cover photo")).toBeVisible();
    await page.getByText("Save Changes", { exact: true }).last().click();
    await expect(page.getByText("Campaigns", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect((await db(page)).campaigns.find(c => c.name === "Cover photo check")?.cover_url ?? null).toBeNull();
    await expect(page.locator(".item-enter").filter({ hasText: "Cover photo check" }).locator(".campaign-tile img")).toHaveCount(0);

    expect(leaks, "nothing may reach the real backend").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("only an https address (or, in the demo, a picture kept on the device) is ever used as a cover", async ({ page }) => {
    await openDemo(page, "creator");
    // The same check the cards use, run on addresses a hostile row might carry.
    const out = await page.evaluate(async () => {
      const { coverSrc } = await import("/src/lib/coverPhoto.ts");
      const png = "data:image/png;base64,iVBORw0KGgo=";
      return {
        https: coverSrc("https://files.example/campaign-assets/a/b/covers/1-x.jpg"),
        http: coverSrc("http://tracker.example/pixel.png"),
        script: coverSrc("javascript:alert(1)"),
        svg: coverSrc("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="),
        otherData: coverSrc("data:text/html;base64,PGI+"),
        demoPicture: coverSrc(png),
        empty: coverSrc(""),
        missing: coverSrc(null),
      };
    });
    expect(out.https).toBe("https://files.example/campaign-assets/a/b/covers/1-x.jpg");
    expect(out.demoPicture).toBe("data:image/png;base64,iVBORw0KGgo=");
    for (const k of ["http", "script", "svg", "otherData", "empty", "missing"] as const) expect(out[k], k).toBeUndefined();
  });
});

test.describe("on an iPhone", () => {
  test.use({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
  });

  test("the rows keep to swiping: no scroll arrows on a touch screen", async ({ page }) => {
    await page.goto(`/demo/creator?${KEY}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Continue in browser", { exact: true }).click({ timeout: 5_000 });
    await expect(page.getByText("You're looking at a demo")).toBeVisible({ timeout: 20_000 });
    await page.getByText("Got it", { exact: true }).click();
    await expect(page.locator("section[aria-label='Top paying']")).toBeVisible();
    await expect(page.locator(".shelf-arrow").first()).toBeHidden();
  });

  test("the demo link opens with a big add-to-home-screen ask, once", async ({ page }) => {
    // Straight away on the picker, before choosing brand or creator.
    await page.goto(`/demo?${KEY}`, { waitUntil: "domcontentloaded" });
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
    await page.goto(`/demo/brand?${KEY}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Add FlipCollab to your home screen")).toBeVisible({ timeout: 5_000 });
  });
});
