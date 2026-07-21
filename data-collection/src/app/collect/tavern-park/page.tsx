"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createEntry } from "@/lib/collection/create-entry";
import { safeExternalUrl } from "@/lib/collection/adventure";
import {
  findAdventurePartner,
  listAdventurePartners,
  MAP_ZONE_LANDMARKS,
  partnerLogoUrl,
  partnerQrUrl,
  zoneLabel,
  type AdventurePartner,
} from "@/lib/collection/partners";
import "./park-map.css";

const DEFAULT_CAMPAIGN = "adventurex-2026";
const PARK_STORAGE_KEY = "tavern-adventure-park";

function ParkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source")?.trim() || "booth";
  const campaign = searchParams.get("campaign")?.trim() || DEFAULT_CAMPAIGN;
  const returnTo = safeExternalUrl(searchParams.get("return_to"));
  const [partners, setPartners] = useState<AdventurePartner[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => findAdventurePartner(partners, partnerId),
    [partners, partnerId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    listAdventurePartners({ campaign })
      .then((rows) => {
        if (cancelled) return;
        setPartners(rows);
        setPartnerId((current) => {
          if (current && rows.some((row) => row.id === current)) return current;
          return rows[0]?.id || "";
        });
      })
      .catch((caught) => {
        if (cancelled) return;
        setLoadError(
          caught instanceof Error ? caught.message : "摊位列表加载失败",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaign]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;

    setError(null);
    setSubmitting(true);
    try {
      const entry = await createEntry({
        template_slug: "tavern-park",
        title: selected.name,
        description: selected.intro,
        extra: {
          park_stop: "co-brand-booth",
          park_stop_label: "联名摊位",
          park_stop_kind: "摊位",
          partner_id: selected.id,
          partner_slug: selected.slug,
          partner_name: selected.name,
          keyword: selected.keyword,
          task: selected.task,
          reward: selected.reward,
          website: selected.website || undefined,
          zone: selected.zone || undefined,
          booth_no: selected.booth_no || undefined,
          pin_x: selected.pin_x ?? undefined,
          pin_y: selected.pin_y ?? undefined,
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
          stopId: "co-brand-booth",
          partnerId: selected.id,
          partnerSlug: selected.slug,
          partnerName: selected.name,
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

  if (loading) {
    return (
      <main className="park-page">
        <p className="park-muted">正在打开游园地图...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="park-page">
        <h1 className="park-title">游园地图暂时打不开</h1>
        <p className="park-error">{loadError}</p>
      </main>
    );
  }

  if (!partners.length) {
    return (
      <main className="park-page">
        <h1 className="park-title">联名摊位还在准备中</h1>
        <p className="park-muted">摊位目录为空，请稍后再试或联系工作人员。</p>
      </main>
    );
  }

  const logo = selected ? partnerLogoUrl(selected) : null;
  const qr = selected ? partnerQrUrl(selected) : null;

  return (
    <main className="park-page">
      <header className="park-header">
        <p className="park-kicker">种种酒馆 · 联名游园</p>
        <h1 className="park-title">酒鬼地图：探险世界</h1>
        <p className="park-lead">
          在地图上点一个摊位点，看清任务与奖励，再到现场打卡收下种子。
        </p>
      </header>

      <form onSubmit={onSubmit} className="park-form">
        <section className="park-map" aria-label="酒鬼地图">
          <div className="park-map-sky" aria-hidden="true" />
          <svg className="park-map-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M18 38 C 30 30, 40 42, 48 48 S 68 40, 74 14 M48 48 C 60 55, 70 62, 78 72 M48 48 C 34 58, 28 66, 20 70 M48 48 C 48 65, 48 78, 48 86"
              fill="none"
              stroke="rgba(255,236,170,0.55)"
              strokeWidth="0.8"
              strokeDasharray="1.6 1.4"
            />
          </svg>

          {MAP_ZONE_LANDMARKS.map((zone) => (
            <div
              key={zone.id}
              className={`park-landmark ${selected?.zone === zone.id ? "is-active" : ""}`}
              style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
            >
              <span className="park-landmark-seed">{zone.seed}</span>
              <strong>{zone.label}</strong>
            </div>
          ))}

          {partners.map((partner) => {
            const x = partner.pin_x ?? 50;
            const y = partner.pin_y ?? 50;
            const active = selected?.id === partner.id;
            return (
              <button
                key={partner.id}
                type="button"
                className={`park-pin ${active ? "is-active" : ""}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                aria-pressed={active}
                aria-label={`${partner.name}，${partner.keyword}`}
                onClick={() => setPartnerId(partner.id)}
              >
                <i />
                <span>{partner.name}</span>
              </button>
            );
          })}
        </section>

        {selected ? (
          <section className="park-detail" aria-live="polite">
            <div className="park-detail-top">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={`${selected.name} logo`} className="park-detail-logo" />
              ) : (
                <div className="park-detail-logo fallback">{selected.keyword.slice(0, 4)}</div>
              )}
              <div>
                <p className="park-detail-meta">
                  {zoneLabel(selected.zone)}
                  {selected.booth_no ? ` · 展位 ${selected.booth_no}` : ""}
                  {" · "}
                  {selected.keyword}
                </p>
                <h2>{selected.name}</h2>
                <p>{selected.intro}</p>
              </div>
            </div>

            <dl className="park-detail-grid">
              <div>
                <dt>小任务</dt>
                <dd>{selected.task}</dd>
              </div>
              <div>
                <dt>奖励</dt>
                <dd>{selected.reward}</dd>
              </div>
              {selected.website ? (
                <div>
                  <dt>官网</dt>
                  <dd>
                    <a href={selected.website} target="_blank" rel="noreferrer">
                      {selected.website.replace(/^https?:\/\//, "")}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>

            {qr ? (
              <div className="park-qr">
                <p>现场二维码 / 物料</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={`${selected.name} 二维码`} />
              </div>
            ) : null}
          </section>
        ) : null}

        <label className="park-note">
          <span>现场小记（可选）</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={120}
          />
        </label>

        {error ? <p className="park-error">{error}</p> : null}

        <button
          type="submit"
          className="park-submit"
          disabled={submitting || !selected}
        >
          {submitting ? "正在收下这枚地图印章..." : "打卡完成，前往承诺池"}
        </button>
      </form>
    </main>
  );
}

export default function TavernParkPage() {
  return (
    <Suspense
      fallback={
        <main className="park-page">
          <p className="park-muted">正在打开游园地图...</p>
        </main>
      }
    >
      <ParkContent />
    </Suspense>
  );
}
