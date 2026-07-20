"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createEntry } from "@/lib/collection/create-entry";
import {
  ADVENTURE_PARK_STOPS,
  findAdventureParkStop,
  safeExternalUrl,
} from "@/lib/collection/adventure";

const DEFAULT_CAMPAIGN = "adventurex-2026";
const PARK_STORAGE_KEY = "tavern-adventure-park";

function ParkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source")?.trim() || "booth";
  const campaign = searchParams.get("campaign")?.trim() || DEFAULT_CAMPAIGN;
  const returnTo = safeExternalUrl(searchParams.get("return_to"));
  const [stopId, setStopId] = useState<string>(ADVENTURE_PARK_STOPS[0].id);
  const [partnerName, setPartnerName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => findAdventureParkStop(stopId), [stopId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;

    setError(null);
    setSubmitting(true);
    try {
      const entry = await createEntry({
        template_slug: "tavern-park",
        title: selected.label,
        description: selected.description,
        extra: {
          park_stop: selected.id,
          park_stop_label: selected.label,
          park_stop_kind: selected.kind,
          partner_name: partnerName.trim() || undefined,
          note: note.trim() || undefined,
          completed_task: selected.task,
        },
        source,
        campaign,
        status: "submitted",
        is_public: false,
      });

      sessionStorage.setItem(
        PARK_STORAGE_KEY,
        JSON.stringify({
          entryId: entry.id,
          stopId: selected.id,
          partnerName: partnerName.trim(),
          note: note.trim(),
        }),
      );

      const params = new URLSearchParams({ source, campaign });
      if (returnTo) params.set("return_to", returnTo);
      router.push(`/collect/tavern-promise?${params.toString()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "游园记录保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-8 px-5 py-10 font-sans sm:px-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-amber-700">种种酒馆 · 联名游园</p>
        <h1 className="text-3xl font-semibold text-zinc-900">在地图上选一个想去的地方</h1>
        <p className="max-w-xl text-sm leading-6 text-zinc-600">
          桂花会把你的线下逛展，收进这张数字地图。每个点位都留了一句提示和一件小任务。
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-7">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="联名游园地图">
          {ADVENTURE_PARK_STOPS.map((stop, index) => {
            const active = selected?.id === stop.id;
            return (
              <button
                key={stop.id}
                type="button"
                onClick={() => setStopId(stop.id)}
                aria-pressed={active}
                className={`min-h-40 border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  active
                    ? "border-amber-600 bg-amber-50 shadow-sm"
                    : "border-zinc-200 bg-white hover:border-amber-300"
                }`}
              >
                <span className="text-xs font-medium text-amber-700">0{index + 1} · {stop.kind}</span>
                <strong className="mt-3 block text-lg text-zinc-900">{stop.label}</strong>
                <span className="mt-2 block text-sm leading-5 text-zinc-600">{stop.description}</span>
              </button>
            );
          })}
        </section>

        {selected ? (
          <section className="border-l-4 border-amber-500 bg-amber-50 px-5 py-4 text-sm text-zinc-700">
            <p className="font-medium text-zinc-900">{selected.hint}</p>
            <p className="mt-2">小任务：{selected.task}</p>
          </section>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">联名方 / 摊位名称（可选）</span>
            <input
              value={partnerName}
              onChange={(event) => setPartnerName(event.target.value)}
              maxLength={80}
              className="border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-amber-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">现场小记（可选）</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={120}
              className="border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-amber-600"
            />
          </label>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "正在收下这枚地图印章..." : "前往承诺池"}
        </button>
      </form>
    </main>
  );
}

export default function TavernParkPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl px-5 py-10 text-sm text-zinc-600">正在打开游园地图...</main>}>
      <ParkContent />
    </Suspense>
  );
}
