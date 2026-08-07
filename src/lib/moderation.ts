import { supabase } from "./supabase";

export type AccountStatus = "active" | "suspended" | "banned";

export interface UserSearchResult {
  id: string;
  role: string;
  email: string;
  name: string;
  avatar_url: string | null;
  account_status: AccountStatus;
  status_reason: string | null;
}

export async function listUsers(): Promise<UserSearchResult[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, role, email, account_status, status_reason, creator_profiles(name, avatar_url), brand_profiles(name, logo_url)");
  if (!data) return [];
  return (data as any[]).map(p => ({
    id: p.id,
    role: p.role,
    email: p.email || "",
    name: p.creator_profiles?.name || p.brand_profiles?.name || p.email || "Unknown",
    avatar_url: p.creator_profiles?.avatar_url || p.brand_profiles?.logo_url || null,
    account_status: (p.account_status || "active") as AccountStatus,
    status_reason: p.status_reason,
  }));
}

export async function setAccountStatus(userId: string, status: AccountStatus, reason?: string) {
  const { error } = await supabase.rpc("admin_set_account_status", {
    target_user_id: userId,
    new_status: status,
    reason: reason?.trim() || null,
  });
  if (error) return { error };

  // Also revoke/restore sign-in at the auth-provider level, not just the
  // in-app flag - suspended and banned both block login the same way here;
  // the distinction is purely the status/reason shown to admins and users.
  try {
    await supabase.functions.invoke("moderate-user", {
      body: { user_id: userId, action: status === "active" ? "unban" : "ban" },
    });
  } catch {
    // The DB flag above already blocks all in-app usage even if this
    // best-effort auth-level call fails.
  }

  return { error: null };
}
