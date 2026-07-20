"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setLoading(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 disabled:opacity-60"
    >
      {loading ? "退出中…" : "退出登录"}
    </button>
  );
}
