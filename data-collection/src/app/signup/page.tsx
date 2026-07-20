"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      setError("缺少 Supabase 环境变量，请检查 .env.local 并重启 npm run dev。");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // 开启邮箱确认时通常没有 session；假成功（已注册邮箱）时 user 可能为空 identities
      const identities = data.user?.identities ?? [];
      if (data.user && identities.length === 0) {
        setError("该邮箱可能已注册，请直接登录，或换一个邮箱。");
        return;
      }

      if (!data.session) {
        setMessage(
          "注册请求已提交。若开启了邮箱确认，请到邮箱点确认链接后再登录；开发阶段可在 Supabase → Authentication → Providers → Email 关闭 Confirm email。",
        );
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-6 py-16 font-sans">
      <div>
        <p className="text-sm text-zinc-500">种种 · data-collection</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">注册</h1>
        <p className="mt-2 text-sm text-zinc-600">
          邮箱密码注册（MVP）。请求可能需数秒，请稍候。
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
          <span className="text-zinc-700">密码（至少 6 位）</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-zinc-700">{message}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {loading ? "注册中…（可能需 10 秒）" : "注册"}
        </button>
      </form>

      <p className="text-sm text-zinc-600">
        已有账号？{" "}
        <Link href="/login" className="underline">
          登录
        </Link>
      </p>
    </main>
  );
}
