"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createEntry } from "@/lib/collection/create-entry";
import { issueTodaySpecial, safeExternalUrl } from "@/lib/collection/adventure";

const DEFAULT_CAMPAIGN = "adventurex-2026";

function GuideForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source")?.trim() || "booth";
  const campaign = searchParams.get("campaign")?.trim() || DEFAULT_CAMPAIGN;
  const returnTo = safeExternalUrl(searchParams.get("return_to"));
  const draft = searchParams.get("draft")?.trim().slice(0, 120) || "";
  const [identity, setIdentity] = useState("创作者");
  const [task, setTask] = useState(draft);
  const [blocker, setBlocker] = useState("");
  const [wechat, setWechat] = useState("");
  const [joinBeta, setJoinBeta] = useState(true);
  const [allowContact, setAllowContact] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedTask = task.trim();
    const normalizedBlocker = blocker.trim();
    if (!normalizedTask) {
      setError("先告诉桂花，今天想端上吧台的是什么。");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const entry = await createEntry({
        template_slug: "tavern-guide",
        title: normalizedTask,
        description: `${identity}${normalizedBlocker ? ` · 卡点：${normalizedBlocker}` : ""}`,
        extra: {
          identity,
          task: normalizedTask,
          blocker: normalizedBlocker || undefined,
        },
        source,
        campaign,
        status: "submitted",
        is_public: true,
        contact: wechat.trim()
          ? {
              wechat: wechat.trim(),
              join_beta: joinBeta,
              allow_contact: allowContact,
            }
          : undefined,
      });

      const result = await issueTodaySpecial({
        entryId: entry.id,
        campaign,
        identity,
        task: normalizedTask,
        blocker: normalizedBlocker,
        returnTo,
      });

      router.replace(`/share/${encodeURIComponent(result.shareSlug)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "今日酒单保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-8 px-5 py-10 font-sans sm:px-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-sky-700">种种酒馆 · 桂花的引导</p>
        <h1 className="text-3xl font-semibold text-zinc-900">先把今天端上吧台</h1>
        <p className="text-sm leading-6 text-zinc-600">
          桂花会根据这份酒单，为你备好一杯只属于今天的特调。
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-900">你今天以什么身份到来？</span>
          <select value={identity} onChange={(event) => setIdentity(event.target.value)} className="border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-sky-700">
            <option>创作者</option>
            <option>开发者</option>
            <option>产品 / 运营</option>
            <option>学生</option>
            <option>正在探索的人</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-900">今天想端上吧台的事</span>
          <textarea
            value={task}
            onChange={(event) => setTask(event.target.value)}
            rows={4}
            maxLength={240}
            placeholder="例如：完成一个 Demo，整理一份材料，发出一条消息..."
            required
            className="resize-y border border-zinc-300 bg-white px-3 py-3 leading-6 outline-none focus:border-sky-700"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-900">现在最卡的地方（可选）</span>
          <textarea
            value={blocker}
            onChange={(event) => setBlocker(event.target.value)}
            rows={3}
            maxLength={240}
            placeholder="例如：不知道从哪里开始，时间总被零碎的事打断..."
            className="resize-y border border-zinc-300 bg-white px-3 py-3 leading-6 outline-none focus:border-sky-700"
          />
        </label>

        <fieldset className="flex flex-col gap-3 border border-zinc-200 p-5">
          <legend className="px-1 text-sm font-medium text-zinc-900">带走后续邀请（可选）</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">微信</span>
            <input value={wechat} onChange={(event) => setWechat(event.target.value)} maxLength={80} className="border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-sky-700" />
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={joinBeta} onChange={(event) => setJoinBeta(event.target.checked)} className="mt-0.5" />
            愿意加入优先内测
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={allowContact} onChange={(event) => setAllowContact(event.target.checked)} className="mt-0.5" />
            允许接收后续版本与活动通知
          </label>
        </fieldset>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button type="submit" disabled={submitting} className="w-full bg-sky-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "桂花正在调制..." : "生成今日特调"}
        </button>
      </form>
    </main>
  );
}

export default function TavernGuidePage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-5 py-10 text-sm text-zinc-600">桂花正在准备酒单...</main>}>
      <GuideForm />
    </Suspense>
  );
}
