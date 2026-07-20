"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeExternalUrl } from "@/lib/collection/adventure";

type VoucherData = {
  kind?: string;
  identity?: string;
  task?: string;
  blocker?: string | null;
  promise?: string;
  deadline?: string;
  importance?: number;
  time_commitment?: string;
  issued_at?: string;
  park_stop?: { label?: string; kind?: string } | null;
  tavern?: { account?: string; contact?: string };
  return_to?: string | null;
  special?: {
    name?: string;
    bartender?: string;
    keywords?: string[];
    completion_hint?: string;
  };
};

type VoucherPage = {
  share_slug: string;
  render_data: VoucherData;
  redeemed_at: string | null;
};

function asVoucherData(value: unknown): VoucherData {
  return value && typeof value === "object" ? (value as VoucherData) : {};
}

function TodaySpecialPage({
  page,
  data,
  copied,
  onCopy,
}: {
  page: VoucherPage;
  data: VoucherData;
  copied: boolean;
  onCopy: () => void;
}) {
  const returnTo = safeExternalUrl(data.return_to);
  const rawKeywords = data.special?.keywords;
  const keywords = Array.isArray(rawKeywords) ? rawKeywords : [];

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-7 px-5 py-10 font-sans sm:px-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-sky-700">种种酒馆 · 今日特调</p>
        <h1 className="text-3xl font-semibold text-zinc-900">桂花已为你备好一杯</h1>
        <p className="text-sm leading-6 text-zinc-600">这张结果页记录今天想做的事，也可以作为现场凭证使用。</p>
      </header>

      <section className="border-2 border-zinc-900 bg-sky-50 p-6 shadow-[6px_6px_0_#18181b]">
        <p className="text-xs font-medium tracking-[0.12em] text-zinc-500">TODAY&apos;S SPECIAL</p>
        <h2 className="mt-3 text-2xl font-semibold text-zinc-900">{data.special?.name || "桂花今日特调"}</h2>
        <p className="mt-2 text-sm text-zinc-700">调酒师：{data.special?.bartender || "桂花"}</p>

        <div className="mt-6 flex flex-col gap-2 border-y border-zinc-300 py-5">
          <code className="break-all bg-white px-4 py-3 text-center font-mono text-lg font-semibold tracking-wider text-zinc-900">{page.share_slug}</code>
          <button type="button" onClick={onCopy} className="self-end text-sm font-medium text-zinc-700 underline underline-offset-4">
            {copied ? "已复制" : "复制现场凭证"}
          </button>
        </div>

        <dl className="mt-6 grid gap-5 text-sm text-zinc-700">
          <div>
            <dt className="text-xs font-medium text-zinc-500">今天的身份</dt>
            <dd className="mt-1 font-medium text-zinc-900">{data.identity || "酒馆来客"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">今天想做的事</dt>
            <dd className="mt-1 text-base leading-6 text-zinc-900">{data.task || "把今天端上吧台"}</dd>
          </div>
          {data.blocker ? (
            <div>
              <dt className="text-xs font-medium text-zinc-500">当前卡点</dt>
              <dd className="mt-1 leading-6 text-zinc-900">{data.blocker}</dd>
            </div>
          ) : null}
          {keywords.length ? (
            <div>
              <dt className="text-xs font-medium text-zinc-500">关键词</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {keywords.map((keyword) => <span key={keyword} className="border border-sky-300 bg-white px-2 py-1 text-xs text-sky-900">{keyword}</span>)}
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-6 border-t border-zinc-300 pt-5 text-sm leading-6 text-zinc-700">{data.special?.completion_hint || "完成一件小事后，回来收下今天的下一层配方。"}</p>
        <div className="mt-5 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">{data.tavern?.account || "种种酒馆"}</p>
          <p className="mt-1">{data.tavern?.contact || "请前往展位咨询"}</p>
        </div>
      </section>

      {returnTo ? <a href={returnTo} className="text-center text-sm font-medium text-zinc-900 underline underline-offset-4">返回种种酒馆</a> : null}
    </main>
  );
}

export default function ShareVoucherPage() {
  const params = useParams<{ shareSlug: string }>();
  const shareSlug = params.shareSlug;
  const [page, setPage] = useState<VoucherPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadVoucher() {
      try {
        const { data, error: queryError } = await supabase
          .from("generated_pages")
          .select("share_slug, render_data, redeemed_at")
          .eq("share_slug", shareSlug)
          .eq("status", "ready")
          .maybeSingle();

        if (!active) return;
        if (queryError) {
          setError(queryError.message);
        } else if (!data) {
          setError("没有找到这张现场凭证。");
        } else {
          setPage({
            share_slug: data.share_slug,
            render_data: asVoucherData(data.render_data),
            redeemed_at: data.redeemed_at,
          });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "现场凭证加载失败。");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadVoucher();

    return () => {
      active = false;
    };
  }, [shareSlug]);

  async function copyCode() {
    if (!page) return;
    try {
      await navigator.clipboard.writeText(page.share_slug);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("复制失败，请手动记录体验码。");
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-xl px-5 py-12 text-sm text-zinc-600">正在打开现场小卡...</main>;
  }

  if (!page || error) {
    return <main className="mx-auto max-w-xl px-5 py-12 text-sm text-red-700">{error || "现场凭证不可用。"}</main>;
  }

  const data = page.render_data;
  if (data.kind === "tavern-today-special") {
    return <TodaySpecialPage page={page} data={data} copied={copied} onCopy={copyCode} />;
  }
  const returnTo = safeExternalUrl(data.return_to);
  const issuedAt = data.issued_at ? new Date(data.issued_at).toLocaleDateString("zh-CN") : "今天";

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-7 px-5 py-10 font-sans sm:px-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-amber-700">种种酒馆 · 现场凭证</p>
        <h1 className="text-3xl font-semibold text-zinc-900">带走这一张小卡</h1>
        <p className="text-sm leading-6 text-zinc-600">它既是你的参与凭证，也是等待兑现的未来邀请函。</p>
      </header>

      <section className="border-2 border-zinc-900 bg-amber-50 p-6 shadow-[6px_6px_0_#18181b]">
        <div className="flex items-start justify-between gap-5 border-b border-zinc-300 pb-5">
          <div>
            <p className="text-xs font-medium tracking-[0.12em] text-zinc-500">ADV FOUNDING PASS</p>
            <p className="mt-2 text-lg font-semibold text-zinc-900">创始体验码</p>
          </div>
          <span className={`border px-2 py-1 text-xs ${page.redeemed_at ? "border-emerald-700 text-emerald-800" : "border-amber-700 text-amber-800"}`}>
            {page.redeemed_at ? "已核销" : "待领取"}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <code className="break-all bg-white px-4 py-4 text-center font-mono text-xl font-semibold tracking-wider text-zinc-900">{page.share_slug}</code>
          <button type="button" onClick={copyCode} className="self-end text-sm font-medium text-zinc-700 underline underline-offset-4">
            {copied ? "已复制" : "复制体验码"}
          </button>
        </div>

        <dl className="mt-7 grid gap-5 text-sm text-zinc-700">
          {data.park_stop?.label ? (
            <div>
              <dt className="text-xs font-medium text-zinc-500">联名游园点位</dt>
              <dd className="mt-1 font-medium text-zinc-900">{data.park_stop.label}{data.park_stop.kind ? ` · ${data.park_stop.kind}` : ""}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium text-zinc-500">留下的承诺</dt>
            <dd className="mt-1 text-base leading-6 text-zinc-900">{data.promise || "一颗正在等待兑现的种子"}</dd>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-zinc-500">完成期限</dt>
              <dd className="mt-1 text-zinc-900">{data.deadline || "待约定"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">投入时间</dt>
              <dd className="mt-1 text-zinc-900">{data.time_commitment || "待约定"}</dd>
            </div>
          </div>
        </dl>

        <div className="mt-7 border-t border-zinc-300 pt-5 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">{data.tavern?.account || "种种酒馆"}</p>
          <p className="mt-1">{data.tavern?.contact || "请前往展位咨询"}</p>
          <p className="mt-3 text-xs text-zinc-500">签发于 {issuedAt} · 向展位工作人员出示体验码即可核销。</p>
        </div>
      </section>

      <p className="text-center text-sm leading-6 text-zinc-600">App 正式上线后，可凭码兑换 7 天完整订阅体验、优先内测资格与后续活动通知。</p>

      {returnTo ? (
        <a href={returnTo} className="text-center text-sm font-medium text-zinc-900 underline underline-offset-4">返回种种酒馆</a>
      ) : null}
    </main>
  );
}
