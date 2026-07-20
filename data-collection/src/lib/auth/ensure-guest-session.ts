import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

function isMissingSessionError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("auth session missing") ||
    m.includes("session missing") ||
    m.includes("not authenticated") ||
    m.includes("invalid jwt") ||
    m.includes("jwt expired")
  );
}

/**
 * Ensure there is a signed-in user for collection flows.
 * If none, create an anonymous (guest) session via Supabase Auth.
 *
 * Note: when logged out, getUser() may return error "Auth session missing!"
 * with user=null — that is normal and must not block signInAnonymously().
 */
export async function ensureGuestSession(
  client?: SupabaseClient,
): Promise<User> {
  const supabase = client ?? createClient();

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError && !isMissingSessionError(getUserError.message)) {
    throw new Error(getUserError.message);
  }

  if (user) {
    return user;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(
      error.message.includes("disabled") ||
        error.message.includes("Anonymous")
        ? "匿名登录未开启：请在 Supabase Dashboard → Authentication → Providers 中启用 Anonymous Sign-Ins。"
        : error.message,
    );
  }

  if (!data.user) {
    throw new Error("匿名登录失败：未返回用户。");
  }

  return data.user;
}
