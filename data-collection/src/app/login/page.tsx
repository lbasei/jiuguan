"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ensureGuestSession } from "@/lib/auth/ensure-guest-session";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    callbackError === "auth_callback" ? "登录回调失败，请重试。" : null,
  );
  const [loading, setLoading] = useState<"email" | "guest" | null>(null);

  function ensureEnv(): boolean {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      setError("缺少 Supabase 环境变量，请检查 .env.local 并重启 npm run dev。");
      return false;
    }
    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ensureEnv()) return;

    setLoading("email");

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试。");
    } finally {
      setLoading(null);
    }
  }

  async function onGuestLogin() {
    setError(null);
    if (!ensureEnv()) return;

    setLoading("guest");

    try {
      await ensureGuestSession();
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "游客登录失败，请稍后重试。");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-6 py-16 font-sans">
      <div>
        <p className="text-sm text-zinc-500">种种 · data-collection</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">登录</h1>
        <p className="mt-2 text-sm text-zinc-600">
          邮箱密码，或游客匿名登录（MVP，不做美化）
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">邮箱</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">密码</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading !== null}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {loading === "email" ? "登录中…" : "登录"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200" />
          或
          <span className="h-px flex-1 bg-zinc-200" />
        </div>
        <button
          type="button"
          onClick={onGuestLogin}
          disabled={loading !== null}
          className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-800 disabled:opacity-60"
        >
          {loading === "guest" ? "进入中…" : "游客登录（匿名）"}
        </button>
        <p className="text-xs text-zinc-500">
          无需邮箱密码，适合现场扫码填表。会话与正式账号隔离。
        </p>
      </div>

      <p className="text-sm text-zinc-600">
        还没有账号？{" "}
        <Link href="/signup" className="underline">
          注册
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto px-6 py-16 text-sm text-zinc-600">加载中…</main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
