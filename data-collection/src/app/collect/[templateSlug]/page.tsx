"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  createEntry,
  getTemplateBySlug,
} from "@/lib/collection/create-entry";
import { uploadImage } from "@/lib/collection/upload-image";
import type {
  FieldSchemaItem,
  Template,
  TemplateSlug,
} from "@/types/collection";

const DEFAULT_CAMPAIGN = "adventurex-2026";
const CONTACT_SLUGS = new Set<string>(["adventurex-profile"]);
const MEDIA_SLUGS = new Set<string>(["booth-record"]);

function asFieldSchema(raw: Template["field_schema"]): FieldSchemaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldSchemaItem[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as FieldSchemaItem).key === "string" &&
      typeof (item as FieldSchemaItem).label === "string"
    ) {
      out.push(item as FieldSchemaItem);
    }
  }
  return out;
}

function CollectForm() {
  const router = useRouter();
  const params = useParams<{ templateSlug: string }>();
  const searchParams = useSearchParams();
  const templateSlug = params.templateSlug;

  const source = searchParams.get("source")?.trim() || undefined;
  const campaign =
    searchParams.get("campaign")?.trim() || DEFAULT_CAMPAIGN;

  const [template, setTemplate] = useState<Template | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [isPublic, setIsPublic] = useState(true);
  const [wechat, setWechat] = useState("");
  const [email, setEmail] = useState("");
  const [joinBeta, setJoinBeta] = useState(false);
  const [allowResearch, setAllowResearch] = useState(false);
  const [allowContact, setAllowContact] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(
    () => (template ? asFieldSchema(template.field_schema) : []),
    [template],
  );
  const showContact = CONTACT_SLUGS.has(templateSlug);
  const showMedia = MEDIA_SLUGS.has(templateSlug);

  useEffect(() => {
    let cancelled = false;
    setLoadingTemplate(true);
    setError(null);

    getTemplateBySlug(templateSlug)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setTemplate(null);
          setError(`未找到模板：${templateSlug}`);
          return;
        }
        setTemplate(row);
        const initial: Record<string, string | boolean> = {};
        for (const field of asFieldSchema(row.field_schema)) {
          initial[field.key] = field.type === "boolean" ? false : "";
        }
        setValues(initial);
        setFile(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载模板失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [templateSlug]);

  function setField(key: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!template) return;

    setError(null);

    for (const field of fields) {
      if (!field.required) continue;
      const raw = values[field.key];
      if (field.type === "boolean") continue;
      if (typeof raw !== "string" || !raw.trim()) {
        setError(`请填写：${field.label}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const extra: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = values[field.key];
        if (field.type === "boolean") {
          extra[field.key] = Boolean(raw);
        } else if (typeof raw === "string") {
          const trimmed = raw.trim();
          if (trimmed) extra[field.key] = trimmed;
        }
      }

      const nickname =
        typeof extra.nickname === "string" ? extra.nickname.trim() : "";
      const title = nickname || template.name;

      const contact =
        showContact && (wechat.trim() || email.trim())
          ? {
              wechat: wechat.trim() || undefined,
              email: email.trim() || undefined,
              join_beta: joinBeta,
              allow_research: allowResearch,
              allow_contact: allowContact,
            }
          : undefined;

      let media:
        | Array<{ storage_path: string; mime_type?: string | null }>
        | undefined;
      if (showMedia && file) {
        const uploaded = await uploadImage(file);
        media = [
          {
            storage_path: uploaded.storage_path,
            mime_type: uploaded.mime_type,
          },
        ];
      }

      const created = await createEntry({
        template_slug: template.slug as TemplateSlug,
        title,
        extra,
        source,
        campaign,
        status: "submitted",
        is_public: isPublic,
        contact,
        media,
      });

      const q = new URLSearchParams({
        entry_id: created.id,
        template: created.template_slug,
      });
      if (source) q.set("source", source);
      router.replace(`/collect/success?${q.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingTemplate) {
    return (
      <main className="mx-auto px-6 py-16 text-sm text-zinc-600">加载中…</main>
    );
  }

  if (!template) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-6 py-16 font-sans">
        <h1 className="text-xl font-semibold text-zinc-900">模板不存在</h1>
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/" className="text-sm underline">
          返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-6 py-12 font-sans">
      <div>
        <p className="text-sm text-zinc-500">种种 · 现场采集</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {template.name}
        </h1>
        {template.description ? (
          <p className="mt-2 text-sm text-zinc-600">{template.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-400">
          {source ? `来源 source=${source}` : "来源未标注"} · campaign=
          {campaign}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {fields.map((field) => {
          if (field.type === "boolean") {
            return (
              <label
                key={field.key}
                className="flex items-center gap-2 text-sm text-zinc-800"
              >
                <input
                  type="checkbox"
                  checked={Boolean(values[field.key])}
                  onChange={(e) => setField(field.key, e.target.checked)}
                />
                <span>
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
              </label>
            );
          }

          if (field.type === "select" && field.options?.length) {
            return (
              <label key={field.key} className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-700">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <select
                  required={Boolean(field.required)}
                  value={String(values[field.key] ?? "")}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="rounded border border-zinc-300 px-3 py-2"
                >
                  <option value="">请选择</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (field.type === "textarea") {
            return (
              <label key={field.key} className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-700">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <textarea
                  required={Boolean(field.required)}
                  rows={4}
                  value={String(values[field.key] ?? "")}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="rounded border border-zinc-300 px-3 py-2"
                />
              </label>
            );
          }

          return (
            <label key={field.key} className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <input
                type="text"
                required={Boolean(field.required)}
                value={String(values[field.key] ?? "")}
                onChange={(e) => setField(field.key, e.target.value)}
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
          );
        })}

        {showMedia ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">现场图片（选填）</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {file ? (
              <span className="text-xs text-zinc-500">
                已选：{file.name}（{(file.size / 1024).toFixed(1)} KB）
              </span>
            ) : (
              <span className="text-xs text-zinc-400">
                支持 JPEG / PNG / WebP / GIF，最大 10MB
              </span>
            )}
          </label>
        ) : null}

        {showContact ? (
          <fieldset className="flex flex-col gap-3 rounded border border-zinc-200 p-3">
            <legend className="px-1 text-sm font-medium text-zinc-900">
              联系方式（选填）
            </legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">微信</span>
              <input
                type="text"
                value={wechat}
                onChange={(e) => setWechat(e.target.value)}
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">邮箱</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={joinBeta}
                onChange={(e) => setJoinBeta(e.target.checked)}
              />
              愿意加入内测
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowResearch}
                onChange={(e) => setAllowResearch(e.target.checked)}
              />
              允许研究使用
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowContact}
                onChange={(e) => setAllowContact(e.target.checked)}
              />
              允许后续联系
            </label>
          </fieldset>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          允许公开结果页（方便分享）
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {submitting ? (file ? "上传并提交中…" : "提交中…") : "提交"}
        </button>
      </form>
    </main>
  );
}

export default function CollectPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto px-6 py-16 text-sm text-zinc-600">加载中…</main>
      }
    >
      <CollectForm />
    </Suspense>
  );
}
