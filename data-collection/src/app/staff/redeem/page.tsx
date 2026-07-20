"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { staffLookupAction, staffRedeemAction } from "./actions";

type PageInfo = {
  share_slug: string;
  template_slug: string;
  status: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
};

function RedeemForm() {
  const searchParams = useSearchParams();
  const initialCode = useMemo(
    () => searchParams.get("code") ?? searchParams.get("slug") ?? "",
    [searchParams],
  );

  const [password, setPassword] = useState("");
  const [code, setCode] = useState(initialCode);
  const [redeemedBy, setRedeemedBy] = useState("");
  const [page, setPage] = useState<PageInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"lookup" | "redeem" | null>(null);

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPage(null);
    setLoading("lookup");
    try {
      const result = await staffLookupAction({ password, code });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPage(result.page);
      if (result.page.redeemed_at) {
        setMessage("该凭证已兑换，请勿重复发放。");
      } else {
        setMessage("凭证有效，可以核销。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败");
    } finally {
      setLoading(null);
    }
  }

  async function onRedeem() {
    setError(null);
    setMessage(null);
    setLoading("redeem");
    try {
      const result = await staffRedeemAction({
        password,
        code,
        redeemedBy,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPage((prev) =>
        prev
          ? {
              ...prev,
              redeemed_at: result.page.redeemed_at,
              redeemed_by: result.page.redeemed_by,
            }
          : {
              share_slug: result.page.share_slug,
              template_slug: "",
              status: "ready",
              redeemed_at: result.page.redeemed_at,
              redeemed_by: result.page.redeemed_by,
              created_at: "",
            },
      );
      setMessage(
        result.already
          ? "该凭证此前已兑换，未重复核销。"
          : "核销成功，可以发放实物。",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "核销失败");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-6 py-12 font-sans">
      <div>
        <p className="text-sm text-zinc-500">种种酒馆 · 展位</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">核销</h1>
        <p className="mt-2 text-sm text-zinc-600">
          输入结果页凭证编号（share_slug），确认后发放实物。
        </p>
      </div>

      <form onSubmit={onLookup} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-700">工作人员口令</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2"
            autoComplete="current-password"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-700">凭证编号</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="share_slug 或含 code 的链接"
            className="w-full rounded border border-zinc-300 px-3 py-2 font-mono text-sm"
            required
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-700">核销人（可选）</span>
          <input
            value={redeemedBy}
            onChange={(e) => setRedeemedBy(e.target.value)}
            placeholder="工位 / 姓名"
            className="w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={loading !== null}
          className="w-full rounded bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading === "lookup" ? "查询中…" : "查询凭证"}
        </button>
      </form>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      {page ? (
        <section className="space-y-3 rounded border border-zinc-200 p-4 text-sm">
          <dl className="space-y-2 text-zinc-700">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">凭证</dt>
              <dd className="font-mono text-xs">{page.share_slug}</dd>
            </div>
            {page.template_slug ? (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">模板</dt>
                <dd>{page.template_slug}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">状态</dt>
              <dd>{page.redeemed_at ? "已兑换" : "未兑换"}</dd>
            </div>
            {page.redeemed_at ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">核销时间</dt>
                  <dd className="text-right text-xs">
                    {new Date(page.redeemed_at).toLocaleString("zh-CN")}
                  </dd>
                </div>
                {page.redeemed_by ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">核销人</dt>
                    <dd>{page.redeemed_by}</dd>
                  </div>
                ) : null}
              </>
            ) : null}
          </dl>

          {!page.redeemed_at ? (
            <button
              type="button"
              onClick={onRedeem}
              disabled={loading !== null}
              className="w-full rounded bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading === "redeem" ? "核销中…" : "确认核销并发放"}
            </button>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default function StaffRedeemPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 py-12 text-sm text-zinc-500">
          加载中…
        </main>
      }
    >
      <RedeemForm />
    </Suspense>
  );
}
