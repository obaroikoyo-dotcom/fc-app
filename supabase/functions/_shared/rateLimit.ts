import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
}

// Prefer the authenticated user's id when available (tighter, can't be
// evaded by rotating IPs); fall back to IP for endpoints with no reliable
// caller identity.
export function clientIdentifier(req: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `ip:${ip}`;
}

export async function checkRateLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  identifier: string,
  config: RateLimitConfig
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_bucket_key: `${bucket}:${identifier}`,
    p_window_seconds: config.windowSeconds,
    p_max_requests: config.maxRequests,
  });

  // Fail open on infra errors - a broken rate limiter shouldn't take every
  // endpoint in the app down with it.
  if (error) {
    console.error(`Rate limit check failed for ${bucket}:`, error);
    return true;
  }

  return data === true;
}

export function rateLimitResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
  });
}
