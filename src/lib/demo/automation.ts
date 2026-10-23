// The other people in the demo are simulated. When the visitor does
// something, the person on the other end answers after a short, believable
// pause: a reply in the chat, a brand accepting an application, a creator
// handing in a video. Without this every action would just sit there, since
// there is nobody real on the other side.

import { emitBroadcast, type ChangeEvent } from "./realtime";
import type { Row } from "./query";
import type { Ctx } from "./ctx";
import { notifyUser } from "./rpc";
import { releaseDeal } from "./functions";
import { SAMPLE_VIDEO_URL } from "./seed";
import { creatorNetPounds, dealPricePounds } from "./prices";
import { poundsText, priceNotice } from "../priceNotices";

export type Scheduler = (fn: () => void, ms: number) => void;

const BRAND_REPLIES = [
  "Thanks, that's helpful. We'll have a look and come back to you shortly.",
  "Got it. That works for us.",
  "Great, thanks for letting us know.",
  "Sounds good to us. Shout if you need anything else from our side.",
];
const CREATOR_REPLIES = [
  "Thanks for the message! I'll get back to you properly in a moment.",
  "Sounds good to me.",
  "Perfect, thank you. I'll get on it.",
  "Happy to do that. Anything else you need from me?",
];
const BRAND_QUESTION_REPLIES = ["Good question. We're flexible on that, so go with whatever feels natural to you."];
const CREATOR_QUESTION_REPLIES = ["Good question. I'd say yes, and I can change it if you'd prefer it another way."];
const PITCHES = [
  "Hi, I'd love to make this for you. I've made similar content before and my audience is mostly 18 to 30 in the UK.",
  "This is right up my street. I'd keep it natural and show it in real use. I can turn the video around within three days.",
];

function pickFrom<T>(list: readonly T[], salt: number): T {
  return list[Math.abs(salt) % list.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function startAutomation(ctx: Ctx, schedule: Scheduler = (fn, ms) => { setTimeout(fn, ms); }) {
  const { db, session } = ctx;
  const me = session.userId;

  const nameOf = (userId: string): string => {
    const c = db.rows("creator_profiles").find(r => r.id === userId);
    if (c?.name) return c.name as string;
    const b = db.rows("brand_profiles").find(r => r.id === userId);
    return (b?.name as string) || "Someone";
  };

  const conversationBetween = (a: string, b: string): Row | undefined =>
    db.rows("conversations").find(c => (c.participant_1 === a && c.participant_2 === b) || (c.participant_1 === b && c.participant_2 === a));

  const say = (convo: Row, sender: string, text: string) => {
    const now = new Date().toISOString();
    db.insert("messages", { conversation_id: convo.id, sender_id: sender, text, video_url: null, image_url: null, media_type: null }, now);
    db.update("conversations", [convo], { last_message: text, last_message_at: now });
  };

  const tellMe = (from: string, text: string, convo: Row) => {
    notifyUser(ctx, me, "new_message", "New Message", `${nameOf(from)} sent you a message: "${text.slice(0, 40)}${text.length > 40 ? "..." : ""}"`, { conversation_id: convo.id });
  };

  // --- the visitor sent a chat message: the other side answers ---------------
  const onMessage = (m: Row) => {
    const text = String(m.text ?? "");
    if (/^(Chat Opened!|Payment secured!)/.test(text)) return;
    const convo = db.rows("conversations").find(c => c.id === m.conversation_id);
    if (!convo) return;
    const other = convo.participant_1 === me ? convo.participant_2 : convo.participant_1;
    const otherRole = db.rows("profiles").find(p => p.id === other)?.role;
    if (!otherRole || other === me) return;
    const asks = text.includes("?");
    const pool = otherRole === "brand" ? (asks ? BRAND_QUESTION_REPLIES : BRAND_REPLIES) : (asks ? CREATOR_QUESTION_REPLIES : CREATOR_REPLIES);
    const reply = m.video_url || m.image_url ? "Got it, thanks for sending that over." : pickFrom(pool, hash(String(m.id)));
    schedule(() => emitBroadcast(`convo-${convo.id}`, "typing", { senderId: other }), 1200);
    schedule(() => {
      say(convo, other, reply);
      tellMe(other, reply, convo);
    }, 3300);
  };

  // --- the visitor offered a different price: the other side answers -----------
  // Anything from half to double the current price is accepted; beyond that they
  // decline and come back with the nearest price they would take.
  const answerOffer = (offerId: string) => {
    const offer = db.rows("price_offers").find(o => o.id === offerId);
    if (!offer || offer.status !== "pending") return;
    const app = db.rows("applications").find(a => a.id === offer.application_id);
    const campaign = db.rows("campaigns").find(c => c.id === app?.campaign_id);
    if (!app || !campaign) return;
    const other = (me === app.creator_id ? campaign.brand_id : app.creator_id) as string;
    const convo = conversationBetween(me, other);
    const current = dealPricePounds(db, app);
    const amount = Number(offer.amount);
    const now = new Date().toISOString();
    if (amount >= current * 0.5 && amount <= current * 2) {
      db.update("price_offers", [offer], { status: "accepted", responded_at: now });
      const text = `Happy to go with ${poundsText(creatorNetPounds(db, campaign, amount))}. Thanks for agreeing that with me.`;
      if (convo) say(convo, other, text);
      const accepted = priceNotice("accept", nameOf(other), creatorNetPounds(db, campaign, amount), String(campaign.name));
      notifyUser(ctx, me, "price_offer", accepted.title, accepted.body, { campaign_id: campaign.id, application_id: app.id, conversation_id: convo?.id });
      return;
    }
    db.update("price_offers", [offer], { status: "declined", responded_at: now });
    const counter = Math.max(1, Math.round(amount < current * 0.5 ? current * 0.5 : current * 2));
    db.insert("price_offers", { application_id: app.id, proposed_by: other, amount: counter, status: "pending", responded_at: null }, now);
    const declined = priceNotice("decline", nameOf(other), creatorNetPounds(db, campaign, amount), String(campaign.name));
    notifyUser(ctx, me, "price_offer", declined.title, declined.body, { campaign_id: campaign.id, application_id: app.id, conversation_id: convo?.id });
    const countered = priceNotice("counter", nameOf(other), creatorNetPounds(db, campaign, counter), String(campaign.name));
    notifyUser(ctx, me, "price_offer", countered.title, countered.body, { campaign_id: campaign.id, application_id: app.id, conversation_id: convo?.id });
  };

  // --- creator visitor applied: the brand accepts and opens a chat ------------
  const acceptApplication = (appId: string) => {
    const app = db.rows("applications").find(a => a.id === appId);
    if (!app || app.status !== "pending") return;
    const campaign = db.rows("campaigns").find(c => c.id === app.campaign_id);
    if (!campaign) return;
    const brandId = campaign.brand_id as string;
    const now = new Date().toISOString();
    db.update("applications", [app], { status: "accepted", responded_at: now });
    const welcome = `Chat Opened! The brand is interested in talking details for "${campaign.name}". Let's align on dates and deliverables before finalizing the deal!`;
    let convo = conversationBetween(brandId, me);
    if (!convo) {
      convo = db.insert("conversations", { participant_1: brandId, participant_2: me, last_message: welcome, last_message_at: now }, now);
      db.insert("messages", { conversation_id: convo.id, sender_id: brandId, text: welcome, video_url: null, image_url: null, media_type: null }, now);
    } else {
      say(convo, brandId, welcome);
    }
    notifyUser(ctx, me, "campaign_chatting", "Chat Opened!", `${nameOf(brandId)} initiated a discussion for your "${campaign.name}" pitch.`, { campaign_id: campaign.id, conversation_id: convo.id });
  };

  // --- brand visitor posted a campaign: a creator applies ---------------------
  const someoneApplies = (campaignId: string) => {
    const campaign = db.rows("campaigns").find(c => c.id === campaignId);
    if (!campaign || campaign.is_draft) return;
    const taken = new Set(db.rows("applications").filter(a => a.campaign_id === campaignId).map(a => a.creator_id));
    const candidates = db.rows("profiles").filter(p => p.role === "creator" && p.id !== me && !taken.has(p.id));
    if (candidates.length === 0) return;
    const creator = pickFrom(candidates, hash(campaignId));
    const platform = (campaign.platforms as string[] | undefined)?.[0] ?? (campaign.deliverables as string[] | undefined)?.[0];
    db.insert("applications", {
      campaign_id: campaignId, creator_id: creator.id, message: pickFrom(PITCHES, hash(campaignId)),
      platforms: platform ? [platform] : [], video_url: null, status: "pending", responded_at: null,
      deliverable_url: null, deliverable_uploaded_at: null, media_delete_at: null,
      revision_count: 0, revision_note: null, revision_requested_at: null, reminder_sent_at: null,
    });
    notifyUser(ctx, me, "campaign_application", "New Application", `${nameOf(creator.id as string)} applied to your campaign "${campaign.name}".`, { campaign_id: campaignId });
  };

  // --- brand visitor funded a deal / asked for a new video: creator delivers --
  const deliver = (appId: string, note: string) => {
    const app = db.rows("applications").find(a => a.id === appId);
    if (!app || app.status !== "funded" || app.deliverable_url) return;
    const campaign = db.rows("campaigns").find(c => c.id === app.campaign_id);
    db.update("applications", [app], { deliverable_url: SAMPLE_VIDEO_URL, deliverable_uploaded_at: new Date().toISOString() });
    notifyUser(ctx, me, "deliverable_uploaded", "Deliverable Received",
      `Your creator sent their video for "${campaign?.name ?? "your campaign"}". Are you happy with it? You have 5 days to answer. If you don't, the payment is released to the creator automatically.`,
      { campaign_id: app.campaign_id, application_id: app.id });
    const convo = conversationBetween(app.creator_id, campaign?.brand_id ?? me);
    if (convo) {
      say(convo, app.creator_id, note);
      tellMe(app.creator_id, note, convo);
    }
  };

  // --- creator visitor delivered: the brand approves and the payout is released
  const approve = (appId: string) => {
    const app = db.rows("applications").find(a => a.id === appId);
    if (!app || app.status !== "funded" || !app.deliverable_url) return;
    const campaign = db.rows("campaigns").find(c => c.id === app.campaign_id);
    const convo = conversationBetween(app.creator_id, campaign?.brand_id ?? "");
    if (convo && campaign) {
      const text = "This looks great, thank you. Releasing the payment now.";
      say(convo, campaign.brand_id as string, text);
      tellMe(campaign.brand_id as string, text, convo);
    }
    releaseDeal(ctx, app);
  };

  db.subscribe((c: ChangeEvent) => {
    const created = c.new;
    const before = c.old;

    if (c.table === "messages" && c.eventType === "INSERT" && created?.sender_id === me) {
      onMessage(created);
      return;
    }

    if (c.table === "price_offers" && c.eventType === "INSERT" && created?.proposed_by === me && created.status === "pending") {
      schedule(() => answerOffer(created.id), 4000);
      return;
    }

    if (session.role === "creator" && c.table === "applications" && c.eventType === "INSERT" && created?.creator_id === me && created.status === "pending") {
      schedule(() => acceptApplication(created.id), 7000);
      return;
    }

    if (session.role === "brand" && c.table === "campaigns" && created?.brand_id === me && !created.is_draft
      && (c.eventType === "INSERT" || (c.eventType === "UPDATE" && before?.is_draft))) {
      schedule(() => someoneApplies(created.id), 8000);
      return;
    }

    if (session.role === "brand" && c.table === "applications" && c.eventType === "UPDATE" && created) {
      const funded = before?.status !== "funded" && created.status === "funded" && !created.deliverable_url;
      const revision = !!before?.deliverable_url && !created.deliverable_url && Number(created.revision_count) > Number(before?.revision_count ?? 0);
      if (funded) schedule(() => deliver(created.id, "I've uploaded the video. Let me know what you think and I can make changes."), 9000);
      if (revision) schedule(() => deliver(created.id, "Thanks for the feedback. I've uploaded a new version."), 9000);
      return;
    }

    if (session.role === "creator" && c.table === "applications" && c.eventType === "UPDATE" && created?.creator_id === me
      && created.status === "funded" && created.deliverable_url && !before?.deliverable_url) {
      schedule(() => approve(created.id), 10000);
    }
  });
}
