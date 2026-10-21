// Builds the made-up world a demo visitor lands in: a few brands, creators,
// campaigns and deals at different stages, with chats and notifications to
// match. Everything is fictional and derived from the visit's seed, so the
// same visit always gets the same world and a new visit gets a new one.
//
// Plain, restrained copy on purpose: this is what people judge the product on.

import type { Row, Tables } from "./query";
import { chance, int, makeRng, pick, sample, shuffle, uuid, type Rng } from "./random";
import type { DemoRole } from "./mode";

export const SAMPLE_VIDEO_URL = "/demo-assets/sample.mp4";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;

const FIRST_NAMES = ["Maya", "Josh", "Priya", "Tom", "Chloe", "Ben", "Amara", "Sam", "Ella", "Noah", "Isla", "Ravi", "Zoe", "Callum", "Freya", "Jamal", "Holly", "Leo", "Nia", "Harry", "Aisha", "Mia", "Owen", "Layla", "Ethan", "Ruby", "Kofi", "Grace", "Dan", "Sofia"];
const LAST_NAMES = ["Patel", "Hughes", "Okafor", "Lawson", "Bennett", "Khan", "Murray", "Reid", "Adeyemi", "Foster", "Walsh", "Sharma", "Clarke", "Ahmed", "Brooks", "Hart", "Nolan", "Singh", "Price", "Ellis", "Grant", "Morgan", "Dixon", "Fraser", "Osei", "Whitaker", "Shaw", "Cooper", "Mistry", "Doyle"];
const CITIES = ["London", "Manchester", "Birmingham", "Leeds", "Bristol", "Glasgow", "Liverpool", "Edinburgh", "Sheffield", "Nottingham", "Cardiff", "Brighton"];
const BRAND_FIRST = ["Fernhill", "Oakline", "Northfield", "Brightside", "Harbour", "Willow", "Stonebridge", "Juniper", "Copperleaf", "Silverbirch", "Redwood", "Marlow", "Ashgrove", "Kestrel", "Linden", "Bramble", "Saltmarsh", "Thistle"];

const PLATFORM_SETS: string[][] = [["TikTok"], ["TikTok", "Instagram"], ["Instagram"], ["TikTok", "Instagram", "YouTube"]];
const CONTENT_TYPES = ["Photos", "Reels", "UGC Videos", "Stories", "Reviews", "Unboxings", "Tutorials", "Vlogs", "Hauls", "GRWM", "Comparisons", "Skits"];
const AGE_RANGES = ["18-24", "25-34", "35-44"];
const TIERS = ["nano", "micro", "mid", "macro", "mega"];

interface CampaignTemplate {
  name: string;
  vibe: string;
  deliverables: string[];
  objective: string;
  budget: number; // pounds, 0 for gifted
  dos: string[];
  donts: string[];
}

interface Archetype {
  industry: string;
  niche: string;
  kinds: string[];
  makes: string;
  audience: string;
  content: string[];
  campaigns: CampaignTemplate[];
}

const ARCHETYPES: Archetype[] = [
  {
    industry: "Beauty & Cosmetics", niche: "Beauty", kinds: ["Skin", "Botanicals", "Beauty"], makes: "skincare",
    audience: "Women aged 18 to 34 who care about skincare", content: ["UGC Video Assets", "Product Reviews", "Tutorials"],
    campaigns: [
      { name: "Autumn skincare routine", vibe: "Show your morning or evening routine using our new cleanser and moisturiser. Real use over a few days, nothing scripted.", deliverables: ["TikTok Video", "IG Reel"], objective: "Brand Awareness", budget: 180, dos: ["Show the product in use", "Mention how your skin feels after a week"], donts: ["Make medical claims", "Compare to named competitors"] },
      { name: "Lip balm first impressions", vibe: "Tell us what you honestly think after the first week. Short, natural and in your own words.", deliverables: ["IG Story"], objective: "Product Launch", budget: 0, dos: ["Keep it under 30 seconds"], donts: ["Read from a script"] },
    ],
  },
  {
    industry: "Food & Beverage", niche: "Food", kinds: ["Tea", "Coffee", "Kitchen", "Pantry"], makes: "small batch food and drink",
    audience: "Home cooks and coffee and tea lovers", content: ["UGC Video Assets", "Unboxings", "Tutorials"],
    campaigns: [
      { name: "Morning ritual with our loose leaf tea", vibe: "Film your morning routine with the tea. We love slow, calm videos with natural light.", deliverables: ["TikTok Video"], objective: "Brand Awareness", budget: 120, dos: ["Natural light", "Show the brewing"], donts: ["Fast cuts", "Loud music"] },
      { name: "Weeknight dinner in 15 minutes", vibe: "Cook a quick dinner using our sauces and show the whole process from start to finish.", deliverables: ["IG Reel", "TikTok Video"], objective: "Drive Conversions", budget: 200, dos: ["Show the finished plate", "Say how long it took"], donts: ["Use other sauce brands"] },
    ],
  },
  {
    industry: "Fitness", niche: "Fitness", kinds: ["Fitness", "Athletics", "Active"], makes: "home fitness gear",
    audience: "People training at home, 20 to 40", content: ["UGC Video Assets", "Product Reviews", "Tutorials"],
    campaigns: [
      { name: "Home workout kit review", vibe: "Test the resistance bands and the mat for a week and tell people what you honestly think.", deliverables: ["TikTok Video", "YouTube Short"], objective: "Drive Conversions", budget: 250, dos: ["Show a full set", "Be honest about what you liked"], donts: ["Promise results"] },
      { name: "Thirty day movement challenge", vibe: "Share your first week of the challenge with your real progress, good days and bad.", deliverables: ["IG Reel"], objective: "Community Growth", budget: 400, dos: ["Post an update each week"], donts: ["Fake before and after shots"] },
    ],
  },
  {
    industry: "Tech & SaaS", niche: "Tech", kinds: ["Labs", "Audio", "Devices"], makes: "everyday tech",
    audience: "Early adopters and remote workers", content: ["UGC Video Assets", "Unboxings", "Product Reviews"],
    campaigns: [
      { name: "Wireless earbuds unboxing", vibe: "Unbox the earbuds, set them up on camera and give your first impressions on sound and comfort.", deliverables: ["TikTok Video"], objective: "Product Launch", budget: 0, dos: ["Show the case and fit", "Test a call"], donts: ["Use stock audio"] },
      { name: "Desk setup with our new lamp", vibe: "Show your desk with the lamp in it. We want to see how it looks in a real space.", deliverables: ["IG Reel"], objective: "Brand Awareness", budget: 150, dos: ["Show it on and off"], donts: ["Hide the product"] },
    ],
  },
  {
    industry: "Fashion & Apparel", niche: "Fashion", kinds: ["Studio", "Clothing", "Denim"], makes: "everyday clothing",
    audience: "Style-led shoppers aged 18 to 35", content: ["UGC Video Assets", "Hauls", "GRWM"],
    campaigns: [
      { name: "Autumn layers lookbook", vibe: "Put together three outfits using our layering pieces and show how you would wear them day to day.", deliverables: ["IG Reel", "TikTok Video"], objective: "Brand Awareness", budget: 300, dos: ["Three different looks", "Show the fabric up close"], donts: ["Heavy filters"] },
      { name: "Three ways to wear one jacket", vibe: "One jacket, three ways. Keep it quick and easy to copy.", deliverables: ["TikTok Video"], objective: "Drive Conversions", budget: 220, dos: ["Show sizing"], donts: ["Use another brand's logo"] },
    ],
  },
  {
    industry: "Travel & Hospitality", niche: "Travel", kinds: ["Stays", "Journeys"], makes: "short stays and day trips",
    audience: "Couples and friends planning weekends away", content: ["UGC Video Assets", "Long-form Vlogs", "Product Reviews"],
    campaigns: [
      { name: "Weekend away in the Peak District", vibe: "Stay a night with us and share what you loved most. Include the room, the view and one local tip.", deliverables: ["IG Reel"], objective: "Brand Awareness", budget: 0, dos: ["Show the view", "Tag the location"], donts: ["Show other guests"] },
      { name: "City break packing guide", vibe: "Show what you pack for a two night city break and why. Practical, quick and honest.", deliverables: ["TikTok Video"], objective: "Community Growth", budget: 180, dos: ["Show the bag", "Share one thing you would leave behind"], donts: ["Sponsored claims you can't back up"] },
    ],
  },
  {
    industry: "Pet Care", niche: "Pets", kinds: ["Paws", "Treats", "Pet Co"], makes: "natural treats and toys",
    audience: "Dog and cat owners", content: ["UGC Video Assets", "Unboxings", "Product Reviews"],
    campaigns: [
      { name: "Puppy treat taste test", vibe: "Let your dog try the treats and film their honest reaction. Bonus if they do a trick first.", deliverables: ["TikTok Video"], objective: "Product Launch", budget: 0, dos: ["Keep your dog safe", "Show the packaging"], donts: ["Force a reaction"] },
      { name: "Dog walking essentials", vibe: "Show what you take on a walk and where our lead and bag holder fit in.", deliverables: ["IG Reel"], objective: "Drive Conversions", budget: 140, dos: ["Real walk, real location"], donts: ["Studio shots"] },
    ],
  },
  {
    industry: "Home & Garden", niche: "Lifestyle", kinds: ["Home", "Living", "Garden"], makes: "homewares",
    audience: "First-time buyers and renters", content: ["UGC Video Assets", "Hauls", "Tutorials"],
    campaigns: [
      { name: "Small space makeover", vibe: "Show a corner of your home before and after adding two of our pieces.", deliverables: ["TikTok Video", "IG Reel"], objective: "Brand Awareness", budget: 260, dos: ["Before and after", "Show the price tags on screen"], donts: ["Over-edit the colours"] },
      { name: "Candle night routine", vibe: "Show your evening wind-down with our candle. Calm, quiet and simple.", deliverables: ["IG Story"], objective: "Community Growth", budget: 110, dos: ["Soft lighting"], donts: ["Talk over the whole video"] },
    ],
  },
  {
    industry: "Gaming", niche: "Gaming", kinds: ["Games", "Play", "Arcade"], makes: "indie games and accessories",
    audience: "Players aged 16 to 30", content: ["UGC Video Assets", "Long-form Vlogs", "Product Reviews"],
    campaigns: [
      { name: "First hour playthrough", vibe: "Play the first hour of the new release and share your honest first impressions.", deliverables: ["TikTok Video"], objective: "Product Launch", budget: 350, dos: ["Show real gameplay"], donts: ["Spoil the ending"] },
      { name: "Controller giveaway promo", vibe: "Announce our giveaway in your own style and explain how to enter.", deliverables: ["IG Reel"], objective: "Community Growth", budget: 160, dos: ["Say the closing date clearly"], donts: ["Promise odds you can't verify"] },
    ],
  },
  {
    industry: "Health & Wellness", niche: "Wellness", kinds: ["Wellness", "Calm", "Daily"], makes: "sleep and recovery products",
    audience: "People who want better sleep and routines", content: ["UGC Video Assets", "Product Reviews", "Tutorials"],
    campaigns: [
      { name: "Seven day sleep routine", vibe: "Try our evening routine for a week and share what changed for you, if anything.", deliverables: ["TikTok Video"], objective: "Brand Awareness", budget: 210, dos: ["Be honest if it didn't work"], donts: ["Make health claims"] },
      { name: "Desk stretching series", vibe: "Film a short stretching routine you can do at a desk, using our mat.", deliverables: ["IG Reel"], objective: "Drive Conversions", budget: 170, dos: ["Keep each move simple"], donts: ["Give medical advice"] },
    ],
  },
];

const CREATOR_BIO_TEMPLATES = [
  "{niche} content from {city}. Short, honest videos and I reply to every comment.",
  "Making {niche} videos for people who want the real version, not the ad. Based in {city}.",
  "{city} based. Mostly {niche}, sometimes a bit of everything. Open to gifted and paid work.",
  "I film simple, well lit {niche} videos. Quick turnaround and always on brief.",
];

const PITCHES = [
  "Hi, I'd love to make this for you. I've made similar content before and my audience is mostly 18 to 30 in the UK. I can film this week.",
  "This is right up my street. I'd keep it natural and show it in real use. I can turn the video around within three days.",
  "Love the brief. I'm happy to follow it as written and can send a first cut for you to review.",
  "My followers have asked for more of this kind of content. I'd be glad to make something honest and easy to watch.",
];

const BRAND_OPENERS = [
  "Thanks for applying. Your pitch was great and we'd love to work with you on this.",
  "Hi! We liked your application. Can we talk through timings and what you'd need from us?",
  "Your profile looks like a great fit for this one. Keen to hear how you'd approach it.",
];
const CREATOR_REPLIES = [
  "Thanks so much for the message. I can start this week and have a first version ready within a few days.",
  "Love this. I can film over the weekend and send it across on Monday if that works.",
  "Thank you! Happy to follow the brief as written. Is there anything you'd like me to avoid saying?",
];
const BRAND_FOLLOWUPS = [
  "Perfect. We'll send the product out as soon as the deal is locked in.",
  "That works well for us. No scripts needed, just keep it natural.",
  "Great. Let's lock it in and get you started.",
];
const CREATOR_ACKS = ["Sounds good, thank you!", "Brilliant, talk soon.", "Great, I'll get started as soon as it's secured."];

const REVIEW_COMMENTS_FOR_CREATOR = [
  "Quick, professional and exactly on brief. Would work with again.",
  "Great communication and the video performed really well for us.",
  "Easy to work with and delivered ahead of the deadline.",
];
const REVIEW_COMMENTS_FOR_BRAND = [
  "Clear brief and paid quickly. A pleasure to work with.",
  "Replied fast and gave useful feedback. Would happily work with them again.",
  "Everything was explained well and the payment was held safely from day one.",
];

interface Person {
  id: string;
  name: string;
  niche: string;
}

export interface World {
  tables: Tables;
}

const CHAT_OPENED = (campaign: string) =>
  `Chat Opened! The brand is interested in talking details for "${campaign}". Let's align on dates and deliverables before finalizing the deal!`;
const PAYMENT_SECURED = (campaign: string) =>
  `Payment secured! Funds for "${campaign}" are held in escrow until content is approved.`;

function isoAgo(now: number, ms: number): string {
  return new Date(now - ms).toISOString();
}

function dateIn(now: number, days: number): string {
  return new Date(now + days * DAY).toISOString().slice(0, 10);
}

// A cover tile for a made-up post: the caption set in white on a flat tone, the
// way a lot of real short-video covers look. Self-contained, nothing to host.
const TILE_TONES = ["#5b6b7a", "#7a6a5b", "#5e7a6a", "#7a5b6a", "#66667a", "#7a735b", "#5b7a78", "#7a625b"];
function postTile(caption: string, salt: string): string {
  let h = 0;
  const key = caption + salt;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const tone = TILE_TONES[h % TILE_TONES.length];
  const words = caption.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > 10 && line) { lines.push(line); line = w; } else { line = (line + " " + w).trim(); }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 4);
  const startY = 84 - (shown.length - 1) * 9;
  const text = shown
    .map((l, i) => `<text x="45" y="${startY + i * 18}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#f2f2f2">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160"><rect width="90" height="160" fill="${tone}"/>${text}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}

export function buildWorld(seed: number, userId: string, role: DemoRole, nowMs: number = Date.now()): World {
  const rng: Rng = makeRng(seed);
  const t: Tables = {
    profiles: [], creator_profiles: [], brand_profiles: [], campaigns: [], applications: [],
    conversations: [], messages: [], notifications: [], transactions: [], favourites: [],
    campaign_favourites: [], blocks: [], reports: [], social_connections: [], social_posts_cache: [],
    verification_requests: [], message_reactions: [], creator_reviews: [], brand_reviews: [],
    disputes: [], campaign_posts: [],
  };

  const usedNames = new Set<string>();
  const personName = () => {
    for (let i = 0; i < 40; i++) {
      const n = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
    return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  };

  // --- people -------------------------------------------------------------

  const addCreator = (id: string, opts: { niche?: string; own?: boolean } = {}): Person => {
    const name = personName();
    const niche = opts.niche ?? pick(rng, ["Beauty", "Fitness", "Food", "Tech", "Fashion", "Travel", "Lifestyle", "Gaming", "Wellness", "Pets"]);
    const city = pick(rng, CITIES);
    const platforms = pick(rng, PLATFORM_SETS);
    const handle = slug(name).replace(/\./g, "");
    const followers: Record<string, string> = {};
    const engagement: Record<string, string> = {};
    const links: Record<string, string> = {};
    for (const p of platforms) {
      followers[p] = String(int(rng, 2_400, 96_000));
      engagement[p] = (2.5 + rng() * 5.5).toFixed(1);
      links[p] = `@${handle}`;
    }
    t.profiles.push({ id, role: "creator", email: `${handle}@demo.flipcollab.invalid`, account_status: "active", status_reason: null, created_at: isoAgo(nowMs, int(rng, 20, 160) * DAY) });
    t.creator_profiles.push({
      id, name, niche,
      bio: pick(rng, CREATOR_BIO_TEMPLATES).replace("{niche}", niche.toLowerCase()).replace("{city}", city).replace(/^./, c => c.toUpperCase()),
      // No picture: the app shows its default one (initials) for these.
      avatar_url: null, location: `${city}, United Kingdom`, age: int(rng, 20, 34),
      gender: pick(rng, ["Female", "Male", "Non-binary"]),
      available: chance(rng, 0.8), profile_visible: true, onboarding_complete: true,
      platforms, social_links: links, follower_counts: followers, engagement_rates: engagement,
      content_types: sample(rng, CONTENT_TYPES, 3), languages: ["English"],
      audience_age_range: sample(rng, AGE_RANGES, 2), audience_location: "United Kingdom",
      rates: { post: String(int(rng, 4, 9) * 10), story: String(int(rng, 2, 5) * 10), reel: String(int(rng, 6, 12) * 10), video: String(int(rng, 8, 16) * 10), ugc: String(int(rng, 10, 20) * 10) },
      collabs: [],
      hashtags: [`#${niche.toLowerCase()}`, "#ugc", "#ukcreator"],
      created_at: isoAgo(nowMs, int(rng, 20, 160) * DAY),
    });
    // Featured posts for every creator so profiles look lived in; the visitor
    // also has the account connected.
    {
      const platform = platforms.includes("TikTok") ? "tiktok" : "instagram";
      const label = platform === "tiktok" ? "TikTok" : "Instagram";
      const count = Number(followers[label] ?? 12000);
      if (opts.own) {
        t.social_connections.push({ id: uuid(rng), user_id: id, platform, username: handle, follower_count: count, connected_at: isoAgo(nowMs, 30 * DAY) });
      }
      const captions = ["Morning routine, unedited", "What I actually use every day", "Trying this so you don't have to", "A realistic day in my week", "Honest first impressions"];
      captions.slice(0, opts.own ? 5 : 3).forEach((caption, i) => {
        t.social_posts_cache.push({
          id: uuid(rng), user_id: id, platform, post_id: `demo-${i}`, post_url: "https://flipcollab.com/demo",
          thumbnail_url: postTile(caption, name), caption, posted_at: isoAgo(nowMs, (i + 2) * 3 * DAY), featured: true, username: handle,
          follower_count: count,
        });
      });
    }
    return { id, name, niche };
  };

  const brandNames = new Set<string>();
  const addBrand = (id: string, arch: Archetype, opts: { verified?: boolean; enterprise?: boolean } = {}): Person => {
    let name = "";
    for (let i = 0; i < 40; i++) {
      name = `${pick(rng, BRAND_FIRST)} ${pick(rng, arch.kinds)}`;
      if (!brandNames.has(name)) break;
    }
    brandNames.add(name);
    const city = pick(rng, CITIES);
    const handle = slug(name).replace(/\./g, "");
    t.profiles.push({ id, role: "brand", email: `${handle}@demo.flipcollab.invalid`, account_status: "active", status_reason: null, created_at: isoAgo(nowMs, int(rng, 30, 200) * DAY) });
    t.brand_profiles.push({
      id, name, company_name: name, industry: arch.industry, niche: arch.industry,
      bio: `We make ${arch.makes} in ${city}. A small team, honest products, and we like working with creators who tell it straight.`,
      website: `https://${handle}.example`, instagram: `@${handle}`, tiktok: `@${handle}`,
      location: `${city}, United Kingdom`, target_audience: arch.audience,
      content_types: arch.content, budget_range: pick(rng, TIERS.slice(0, 4)),
      logo_url: null, avatar_url: null, verified: !!opts.verified, is_enterprise: !!opts.enterprise,
      profile_visible: true, onboarding_complete: true, subscription_cancel_at_period_end: false,
      created_at: isoAgo(nowMs, int(rng, 30, 200) * DAY),
    });
    return { id, name, niche: arch.niche };
  };

  // --- campaigns ----------------------------------------------------------

  const addCampaign = (brand: Person, arch: Archetype, tpl: CampaignTemplate, o: { daysAgo: number; draft?: boolean; name?: string }): Row => {
    const platformsOnly = tpl.deliverables.filter(d => /^(tiktok|ig |instagram|youtube)/i.test(d));
    const row: Row = {
      id: uuid(rng), brand_id: brand.id, name: o.name ?? tpl.name, description: tpl.vibe,
      budget: tpl.budget, type: tpl.budget > 0 ? "paid" : "gifted", niche: arch.niche,
      platforms: platformsOnly, deadline: dateIn(nowMs, int(rng, 12, 40)), video_required: chance(rng, 0.25),
      objective: tpl.objective, deliverables: tpl.deliverables, vibe: tpl.vibe,
      dos: tpl.dos, donts: tpl.donts, promo_code: "", landing_link: "", utm_code: "",
      is_draft: !!o.draft, script: "", logos: [], overlays: [], style_videos: [], broll: [],
      created_at: isoAgo(nowMs, o.daysAgo * DAY), updated_at: isoAgo(nowMs, o.daysAgo * DAY),
    };
    t.campaigns.push(row);
    return row;
  };

  // --- deals --------------------------------------------------------------

  const notify = (userIdFor: string, type: string, title: string, body: string, data: Row, agoMs: number, read: boolean) => {
    t.notifications.push({ id: uuid(rng), user_id: userIdFor, type, title, body, data, read, created_at: isoAgo(nowMs, agoMs) });
  };

  type DealStatus = "pending" | "accepted" | "funded" | "paid" | "rejected";
  interface Deal { app: Row; convoId: string | null }

  const addDeal = (campaign: Row, brand: Person, creator: Person, status: DealStatus, appliedAgoMs: number, o: { delivered?: boolean; creatorIsMe?: boolean; brandIsMe?: boolean } = {}): Deal => {
    const created = isoAgo(nowMs, appliedAgoMs);
    const respondedAgo = appliedAgoMs - int(rng, 3, 20) * HOUR;
    const platformPick = (campaign.platforms as string[])[0] ?? (campaign.deliverables as string[])[0];
    const app: Row = {
      id: uuid(rng), campaign_id: campaign.id, creator_id: creator.id,
      message: pick(rng, PITCHES), platforms: platformPick ? [platformPick] : [], video_url: null,
      status, created_at: created,
      responded_at: status === "pending" ? null : isoAgo(nowMs, Math.max(respondedAgo, HOUR)),
      deliverable_url: null, deliverable_uploaded_at: null, media_delete_at: null,
      revision_count: 0, revision_note: null, revision_requested_at: null, reminder_sent_at: null,
    };
    if (o.delivered) {
      app.deliverable_url = SAMPLE_VIDEO_URL;
      app.deliverable_uploaded_at = isoAgo(nowMs, int(rng, 8, 30) * HOUR);
    }
    t.applications.push(app);

    // New application notice for the brand.
    notify(brand.id, "campaign_application", "New Application", `${creator.name} applied to your campaign "${campaign.name}".`, { campaign_id: campaign.id }, appliedAgoMs, status !== "pending" || !o.brandIsMe);

    if (status === "pending" || status === "rejected") return { app, convoId: null };

    // Conversation and messages for deals that are past the application stage.
    const convoId = uuid(rng);
    let at = nowMs - Math.max(respondedAgo, 2 * HOUR);
    const msgs: Row[] = [];
    const say = (sender: string, text: string, gapMin = int(rng, 8, 90)) => {
      at += gapMin * MIN;
      msgs.push({ id: uuid(rng), conversation_id: convoId, sender_id: sender, text, video_url: null, image_url: null, media_type: null, read_at: isoAgo(nowMs, 2 * HOUR), edited_at: null, deleted_at: null, created_at: new Date(at).toISOString() });
    };
    say(brand.id, CHAT_OPENED(campaign.name as string), 1);
    say(brand.id, pick(rng, BRAND_OPENERS));
    say(creator.id, pick(rng, CREATOR_REPLIES), int(rng, 20, 120));
    say(brand.id, pick(rng, BRAND_FOLLOWUPS));
    say(creator.id, pick(rng, CREATOR_ACKS));
    if (status === "funded" || status === "paid") say(brand.id, PAYMENT_SECURED(campaign.name as string), 30);
    // Never in the future.
    for (const m of msgs) if (new Date(m.created_at).getTime() > nowMs - 5 * MIN) m.created_at = isoAgo(nowMs, 5 * MIN);
    const last = msgs[msgs.length - 1];
    t.messages.push(...msgs);
    t.conversations.push({ id: convoId, participant_1: brand.id, participant_2: creator.id, last_message: last.text, last_message_at: last.created_at, created_at: msgs[0].created_at });

    notify(creator.id, "campaign_chatting", "Chat Opened!", `${brand.name} initiated a discussion for your "${campaign.name}" pitch.`, { campaign_id: campaign.id, conversation_id: convoId }, Math.max(respondedAgo, 2 * HOUR), !(o.creatorIsMe && status === "accepted"));

    if (status === "funded" || status === "paid") {
      const budgetPence = Math.round(Number(campaign.budget) * 100);
      const fee = Math.round(budgetPence * 0.05);
      t.transactions.push({
        id: uuid(rng), campaign_id: campaign.id, brand_id: brand.id, creator_id: creator.id,
        amount: budgetPence + fee, platform_fee: fee + Math.round(budgetPence * 0.1),
        creator_payout: budgetPence - Math.round(budgetPence * 0.1),
        status: "completed", stripe_payment_intent_id: `pi_demo_${uuid(rng).slice(0, 8)}`,
        payout_released_at: status === "paid" ? isoAgo(nowMs, int(rng, 2, 6) * DAY) : null,
        created_at: isoAgo(nowMs, Math.max(respondedAgo - HOUR, 90 * MIN)),
      });
      notify(creator.id, "payment_received", "Payment Received",
        `Funds for "${campaign.name}" have been secured in escrow. Deliver your video in the chat. Your payout is released once the brand confirms they're happy with it, or automatically 5 days after you upload if they don't respond.`,
        { campaign_id: campaign.id }, Math.max(respondedAgo - HOUR, 90 * MIN), !(o.creatorIsMe && status === "funded"));
    }
    if (o.delivered && status === "funded") {
      notify(brand.id, "deliverable_uploaded", "Deliverable Received",
        `Your creator sent their video for "${campaign.name}". Are you happy with it? You have 5 days to answer. If you don't, the payment is released to the creator automatically.`,
        { campaign_id: campaign.id, application_id: app.id }, 20 * HOUR, !o.brandIsMe ? true : false);
    }
    return { app, convoId };
  };

  const addReviews = (campaign: Row, brand: Person, creator: Person, agoDays: number) => {
    t.creator_reviews.push({ id: uuid(rng), creator_id: creator.id, brand_id: brand.id, campaign_id: campaign.id, rating: chance(rng, 0.7) ? 5 : 4, comment: pick(rng, REVIEW_COMMENTS_FOR_CREATOR), created_at: isoAgo(nowMs, agoDays * DAY) });
    t.brand_reviews.push({ id: uuid(rng), brand_id: brand.id, creator_id: creator.id, campaign_id: campaign.id, rating: chance(rng, 0.7) ? 5 : 4, comment: pick(rng, REVIEW_COMMENTS_FOR_BRAND), created_at: isoAgo(nowMs, agoDays * DAY) });
  };

  // --- the world around the visitor ---------------------------------------

  const archetypes = shuffle(rng, ARCHETYPES);

  if (role === "creator") {
    const me = addCreator(userId, { own: true });
    // Starting a profile card from the creator's own niche keeps the feed relevant.
    const brands = archetypes.slice(0, 7).map((arch, i) => ({ arch, brand: addBrand(uuid(rng), arch, { verified: i === 0 || i === 3, enterprise: i === 2 }) }));
    const campaigns: Row[] = [];
    brands.forEach(({ arch, brand }, i) => {
      campaigns.push(addCampaign(brand, arch, arch.campaigns[0], { daysAgo: int(rng, 1, 12) }));
      // Every brand ends up with at least one paid campaign, so deals have money in them.
      if (i % 2 === 0 || arch.campaigns[0].budget === 0) campaigns.push(addCampaign(brand, arch, arch.campaigns[1], { daysAgo: int(rng, 2, 16) }));
    });
    for (let i = 0; i < 6; i++) addCreator(uuid(rng));

    // Deals involving the visitor, one at each stage.
    const byBrand = (i: number) => {
      const mine = campaigns.filter(c => c.brand_id === brands[i].brand.id);
      return (mine.find(c => Number(c.budget) > 0) ?? mine[0]) as Row;
    };
    addDeal(byBrand(0), brands[0].brand, me, "pending", 2 * DAY, { creatorIsMe: true });
    addDeal(byBrand(1), brands[1].brand, me, "accepted", 5 * DAY, { creatorIsMe: true });
    addDeal(byBrand(2), brands[2].brand, me, "funded", 7 * DAY, { creatorIsMe: true });
    addDeal(byBrand(3), brands[3].brand, me, "paid", 18 * DAY, { creatorIsMe: true, delivered: true });
    addDeal(byBrand(4), brands[4].brand, me, "rejected", 9 * DAY, { creatorIsMe: true });
    addReviews(byBrand(3), brands[3].brand, me, 8);

    // A couple of campaigns bookmarked, a few unread things.
    t.campaign_favourites.push({ id: uuid(rng), user_id: userId, campaign_id: byBrand(5).id, created_at: isoAgo(nowMs, 1 * DAY) });
    const unread = brands[6].brand;
    const convo = uuid(rng);
    t.conversations.push({ id: convo, participant_1: unread.id, participant_2: userId, last_message: "Hi! Saw your profile and wondered if you're free for something next month?", last_message_at: isoAgo(nowMs, 3 * HOUR), created_at: isoAgo(nowMs, 3 * HOUR) });
    t.messages.push({ id: uuid(rng), conversation_id: convo, sender_id: unread.id, text: "Hi! Saw your profile and wondered if you're free for something next month?", video_url: null, image_url: null, media_type: null, read_at: null, edited_at: null, deleted_at: null, created_at: isoAgo(nowMs, 3 * HOUR) });
    notify(userId, "new_message", "New Message", `${unread.name} sent you a message: "Hi! Saw your profile and wondered if you're free..."`, { conversation_id: convo }, 3 * HOUR, false);
  } else {
    // The visitor's own campaigns should both be paid ones, so paying works.
    const myArch = archetypes.find(a => a.campaigns.every(c => c.budget > 0)) ?? archetypes[0];
    const me = addBrand(userId, myArch, { verified: false });
    const c1 = addCampaign(me, myArch, myArch.campaigns[0], { daysAgo: 9 });
    const c2 = addCampaign(me, myArch, myArch.campaigns[1], { daysAgo: 4 });
    addCampaign(me, myArch, { ...myArch.campaigns[0], name: "Winter gifting idea", budget: 0 }, { daysAgo: 2, draft: true, name: "Winter gifting idea" });

    const creators: Person[] = [];
    for (let i = 0; i < 9; i++) creators.push(addCreator(uuid(rng)));

    addDeal(c1, me, creators[0], "pending", 1 * DAY, { brandIsMe: true });
    addDeal(c1, me, creators[1], "pending", 3 * HOUR, { brandIsMe: true });
    addDeal(c1, me, creators[2], "accepted", 3 * DAY, { brandIsMe: true });
    addDeal(c1, me, creators[3], "funded", 6 * DAY, { brandIsMe: true, delivered: true });
    addDeal(c2, me, creators[4], "paid", 14 * DAY, { brandIsMe: true, delivered: true });
    addDeal(c2, me, creators[5], "pending", 2 * DAY, { brandIsMe: true });
    addReviews(c2, me, creators[4], 6);

    // Other brands, so the Discover tab has something to show.
    archetypes.filter(a => a !== myArch).slice(0, 5).forEach((arch, i) => {
      const b = addBrand(uuid(rng), arch, { verified: i === 1 });
      addCampaign(b, arch, arch.campaigns[0], { daysAgo: int(rng, 1, 14) });
      if (i % 2 === 1) addCampaign(b, arch, arch.campaigns[1], { daysAgo: int(rng, 3, 18) });
    });

    t.favourites.push({ id: uuid(rng), user_id: userId, creator_id: creators[6].id, created_at: isoAgo(nowMs, 2 * DAY) });
    t.favourites.push({ id: uuid(rng), user_id: userId, creator_id: creators[7].id, created_at: isoAgo(nowMs, 5 * DAY) });
  }

  // Every campaign above is due in two to six weeks, which would leave the
  // Explore shelves (Closing soon, New today) empty. Pull a few dates in by
  // position, not by chance, so nothing else that is seeded moves. Only among
  // campaigns the visitor has not already applied to, since those are the ones
  // Explore lists, and so there is always at least one of each when there are
  // three or more.
  const appliedByMe = new Set(t.applications.filter(a => a.creator_id === userId).map(a => a.campaign_id));
  t.campaigns.filter(c => !c.is_draft && !appliedByMe.has(c.id)).forEach((c, i) => {
    if (i % 3 === 1) c.deadline = dateIn(nowMs, 2 + (i % 5));
    if (i % 4 === 2) { c.created_at = isoAgo(nowMs, (3 + (i % 4)) * HOUR); c.updated_at = c.created_at; }
  });

  return { tables: t };
}
