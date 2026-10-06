import { supabase } from "./supabase";

const FUNCTIONS_BASE = "https://otbcvpgtxxidgtbxgzpo.supabase.co/functions/v1";

async function authedFetch(path: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${path} failed`);
  return data;
}

// Used to mount Stripe's embedded onboarding/account-management components
// inline in CreatorProfile - country is only required the first time (when
// no Stripe account exists yet for this creator), ignored afterwards.
export async function getConnectAccountSession(country?: string): Promise<{ client_secret: string }> {
  return authedFetch("connect-account-session", { country });
}

export interface ConnectStatus {
  connected: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}

export async function getConnectStatus(): Promise<ConnectStatus> {
  return authedFetch("connect-account-status", {});
}

// Used by the brand's pay flow to show a soft warning if the creator hasn't
// finished payout setup - never blocks payment, escrow already exists for
// exactly this kind of gap.
export async function getCreatorPayoutsEnabled(creatorId: string): Promise<boolean> {
  const data = await authedFetch("connect-account-status", { creator_id: creatorId });
  return !!data.payouts_enabled;
}
