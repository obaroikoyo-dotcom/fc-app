import { supabase } from "./supabase";

// The pieces behind the deal tabs at the top of a chat (components/DealTabs.tsx): which deals get
// a tab, and which of them have something new in it.

interface Deal {
  id: string;
  status: string;
  campaign_id: string;
  campaign_name: string;
}

// A deal is part of the chat once the brand has accepted it. An application the brand hasn't
// answered yet ("Applied") isn't, so it gets no tab: a creator who has applied to a second campaign
// keeps seeing the plain chat until the brand accepts. A deal the brand accepted and later screened
// out keeps its tab (as "Declined"): it is the one the chat has a "Chat Opened" message for. One turned
// down before it was ever accepted has no such message, so no tab.
export function dealsWithTabs<T extends Pick<Deal, "status" | "campaign_name">>(deals: T[], chatOpenedTexts: string[]): T[] {
  return deals.filter(deal => {
    if (deal.status === "pending") return false;
    if (deal.status !== "rejected") return true;
    return chatOpenedTexts.some(text => text.includes(`"${deal.campaign_name}"`));
  });
}

// The deal of this chat a notification is about, if it is about one. Most carry the application's id.
// "Chat opened" and "payment received" only name the campaign, which is enough here: a creator has
// one application per campaign. (A brand's "new application" notice names a campaign too, but it
// is about whoever applied, so it is left out.)
export function dealOfNotification(
  notification: { type: string; data?: Record<string, unknown> | null },
  convoId: string,
  deals: Pick<Deal, "id" | "campaign_id">[],
): string | undefined {
  const data = notification.data ?? {};
  if (typeof data.application_id === "string") return deals.find(d => d.id === data.application_id)?.id;
  const namesCampaign = (notification.type === "campaign_chatting" && data.conversation_id === convoId) || notification.type === "payment_received";
  return namesCampaign ? deals.find(d => d.campaign_id === data.campaign_id)?.id : undefined;
}

// The unread notifications about the deals of this chat, each with the deal it is about.
export async function unreadDealNotifications(userId: string, convoId: string, deals: Pick<Deal, "id" | "campaign_id">[]): Promise<{ id: string; dealId: string }[]> {
  const { data } = await supabase.from("notifications").select("id, type, data").eq("user_id", userId).eq("read", false);
  const unread: { id: string; dealId: string }[] = [];
  for (const notification of data ?? []) {
    const dealId = dealOfNotification(notification, convoId, deals);
    if (dealId) unread.push({ id: notification.id, dealId });
  }
  return unread;
}
