"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createEntry } from "@/lib/collection/create-entry";
import {
  findAdventureParkStop,
  issueAdventureVoucher,
  safeExternalUrl,
} from "@/lib/collection/adventure";

const DEFAULT_CAMPAIGN = "adventurex-2026";
const PARK_STORAGE_KEY = "tavern-adventure-park";

type ParkRecord = {
  entryId?: string;
  stopId?: string;
  partnerName?: string;
  note?: string;
};

function readParkRecord(): ParkRecord | null {
  try {
    const raw = sessionStorage.getItem(PARK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ParkRecord) : null;
  } catch {
    return null;
  }
}

function PromiseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source")?.trim() || "booth";
  const campaign = searchParams.get("campaign")?.trim() || DEFAULT_CAMPAIGN;
  const returnTo = safeExternalUrl(searchParams.get("return_to"));
  const [parkRecord, setParkRecord] = useState<ParkRecord | null>(null);
  const [promise, setPromise] = useState("");
  const [deadline, setDeadline] = useState("三天内");
  const [importance, setImportance] = useState(3);
  const [timeCommitment, setTimeCommitment] = useState("30 分钟");
  const [wechat, setWechat] = useState("");
  const [joinBeta, setJoinBeta] = useState(true);
  const [allowResearch, setAllowResearch] = useState(false);
  const [allowContact, setAllowContact] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setParkRecord(readParkRecord());
  }, []);

  const parkStop = useMemo(
    () => findAdventureParkStop(parkRecord?.stopId),
    [parkRecord?.stopId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedPromise = promise.trim();
    const normalizedWechat = wechat.trim();
    if (!normalizedPromise) {
      setError("先写下一件你愿意完成的小事。");
      return;
    }
    if (!normalizedWechat) {
      setError("完成关注后，请留下微信以领取创始体验码。");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const entry = await createEntry({
        template_slug: "tavern-promise",
        title: normalizedPromise,
        description: `${deadline} · 重要程度 ${importance}/5 · ${timeCommitment}`,
        extra: {
          promise: normalizedPromise,
          deadline,
          importance,
          time_commitment: timeCommitment,
          park_entry_id: parkRecord?.entryId || undefined,
          park_stop: parkStop?.id || undefined,
          park_stop_label: parkStop?.label || undefined,
          partner_name: parkRecord?.partnerName || undefined,
          park_note: parkRecord?.note || undefined,
        },
        source,
        campaign,
        status: "submitted",
        is_public: true,
        contact: {
          wechat: normalizedWechat,
          join_beta: joinBeta,
          allow_research: allowResearch,
          allow_contact: allowContact,
        },
      });

      const voucher = await issueAdventureVoucher({
        entryId: entry.id,
        campaign,
        promise: normalizedPromise,
        deadline,
        importance,
        timeCommitment,
        parkStop,
        returnTo,
      });

      sessionStorage.removeItem(PARK_STORAGE_KEY);
      router.replace(`/share/${encodeURIComponent(voucher.shareSlug)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "承诺投递失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-8 px-5 py-10 font-sans sm:px-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-emerald-700">种种酒馆 · 承诺池</p>
        <h1 className="text-3xl font-semibold text-zinc-900">投下一份承诺</h1>
        <p className="text-sm leading-6 text-zinc-600">
          它可以很小。回答完这几件事，桂花会把它变成一颗等待兑现的种子。
        </p>
      </header>

      {parkStop ? (
        <section className="border-l-4 border-emerald-600 bg-emerald-50 px-5 py-4 text-sm text-zinc-700">
          你的游园起点：<strong className="text-zinc-900">{parkStop.label}</strong>
        </section>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-900">你想完成什么？</span>
          <textarea
            value={promise}
            onChange={(event) => setPromise(event.target.value)}
            rows={4}
            maxLength={240}
            placeholder="例如：完成一个 Demo，开始一次散步，给朋友发一条消息..."
            className="resize-y border border-zinc-300 bg-white px-3 py-3 leading-6 outline-none focus:border-emerald-600"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-900">准备多久后完成？</span>
            <select value={deadline} onChange={(event) => setDeadline(event.target.value)} className="border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600">
              <option>今天</option>
              <option>三天内</option>
              <option>一周内</option>
              <option>一个月内</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-900">愿意投入多少时间？</span>
            <select value={timeCommitment} onChange={(event) => setTimeCommitment(event.target.value)} className="border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600">
              <option>10 分钟</option>
              <option>30 分钟</option>
              <option>1 小时</option>
              <option>2 小时以上</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-3 text-sm">
          <span className="flex items-center justify-between gap-4 font-medium text-zinc-900">
            <span>这件事对你有多重要？</span>
            <output className="font-mono text-emerald-700">{importance} / 5</output>
          </span>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={importance}
            onChange={(event) => setImportance(Number(event.target.value))}
            className="accent-emerald-700"
          />
          <span className="flex justify-between text-xs text-zinc-500"><span>先试一试</span><span>非常重要</span></span>
        </label>

        <fieldset className="flex flex-col gap-3 border border-zinc-200 p-5">
          <legend className="px-1 text-sm font-medium text-zinc-900">领取 ADV 创始体验码</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">微信</span>
            <input
              value={wechat}
              onChange={(event) => setWechat(event.target.value)}
              maxLength={80}
              required
              className="border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={joinBeta} onChange={(event) => setJoinBeta(event.target.checked)} className="mt-0.5" />
            愿意加入优先内测
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={allowContact} onChange={(event) => setAllowContact(event.target.checked)} className="mt-0.5" />
            允许接收后续版本与活动通知
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={allowResearch} onChange={(event) => setAllowResearch(event.target.checked)} className="mt-0.5" />
            允许将这份匿名承诺用于产品研究
          </label>
        </fieldset>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "正在把承诺投进池里..." : "领取创始体验码"}
        </button>
      </form>
    </main>
  );
}

export default function TavernPromisePage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-5 py-10 text-sm text-zinc-600">正在准备承诺池...</main>}>
      <PromiseContent />
    </Suspense>
  );
}
