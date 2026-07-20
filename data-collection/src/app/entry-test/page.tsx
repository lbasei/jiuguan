"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  createEntry,
  listEntries,
  listTemplates,
} from "@/lib/collection/create-entry";
import { getCurrentLocation } from "@/lib/collection/get-location";
import { uploadImage } from "@/lib/collection/upload-image";
import {
  TEMPLATE_SLUGS,
  type Template,
  type TemplateSlug,
} from "@/types/collection";

type ListedEntry = Awaited<ReturnType<typeof listEntries>>[number];

export default function EntryTestPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSlug, setTemplateSlug] = useState<TemplateSlug>("plant");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ListedEntry[]>([]);

  async function onLocate() {
    setError(null);
    setLocating(true);
    try {
      const pos = await getCurrentLocation();
      setLat(String(pos.lat));
      setLng(String(pos.lng));
    } catch (err) {
      setError(err instanceof Error ? err.message : "定位失败");
    } finally {
      setLocating(false);
    }
  }

  async function refreshList() {
    const rows = await listEntries({ limit: 10 });
    setEntries(rows);
  }

  useEffect(() => {
    listTemplates()
      .then((rows) => {
        setTemplates(rows);
        if (rows[0]?.slug) setTemplateSlug(rows[0].slug as TemplateSlug);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "加载模板失败"),
      );
    refreshList().catch(() => {
      /* ignore first load errors until logged in */
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessId(null);
    setLoading(true);

    try {
      let media:
        | Array<{ storage_path: string; mime_type?: string | null }>
        | undefined;

      if (file) {
        const uploaded = await uploadImage(file);
        media = [
          {
            storage_path: uploaded.storage_path,
            mime_type: uploaded.mime_type,
          },
        ];
      }

      const created = await createEntry({
        template_slug: templateSlug,
        title,
        description: description || undefined,
        body: body || undefined,
        address: address || undefined,
        lat: lat === "" ? undefined : Number(lat),
        lng: lng === "" ? undefined : Number(lng),
        tags: tags
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean),
        media,
      });

      setSuccessId(created.id);
      setTitle("");
      setDescription("");
      setBody("");
      setAddress("");
      setLat("");
      setLng("");
      setTags("");
      setFile(null);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  const slugOptions =
    templates.length > 0
      ? templates.map((t) => t.slug as TemplateSlug)
      : TEMPLATE_SLUGS;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-6 px-6 py-16 font-sans">
      <div>
        <p className="text-sm text-zinc-500">种种 · data-collection</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          采集提交验收
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          后端验收用极简表单。未登录会自动创建访客会话（匿名用户），无需邮箱密码。
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span>模块</span>
          <select
            value={templateSlug}
            onChange={(e) => setTemplateSlug(e.target.value as TemplateSlug)}
            className="rounded border border-zinc-300 px-3 py-2"
          >
            {slugOptions.map((slug) => (
              <option key={slug} value={slug}>
                {slug}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span>标题 *</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>描述</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>文本</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>地址</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span>纬度</span>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>经度</span>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={locating}
            onClick={onLocate}
            className="rounded border border-zinc-300 px-3 py-2 text-left disabled:opacity-60"
          >
            {locating ? "定位中…" : "获取当前位置"}
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span>标签（逗号分隔）</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="春天,路边"
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>图片（可选）</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {error ? <p className="text-red-600">{error}</p> : null}
        {successId ? (
          <p className="text-zinc-700">
            提交成功，entry id：
            <code className="rounded bg-zinc-100 px-1 text-xs">{successId}</code>
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? "提交中…" : "提交"}
        </button>
      </form>

      <section className="space-y-2 text-sm text-zinc-700">
        <div className="flex items-center justify-between">
          <p className="font-medium text-zinc-900">最近条目</p>
          <button
            type="button"
            className="underline"
            onClick={() =>
              refreshList().catch((err) =>
                setError(err instanceof Error ? err.message : "刷新失败"),
              )
            }
          >
            刷新
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="text-zinc-500">暂无</p>
        ) : (
          <ul className="list-inside list-disc space-y-1">
            {entries.map((row) => (
              <li key={row.id}>
                [{row.templates?.slug ?? "?"}] {row.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-zinc-600">
        <Link href="/" className="underline">
          返回首页
        </Link>
        {" · "}
        <Link href="/upload-test" className="underline">
          仅上传
        </Link>
      </p>
    </main>
  );
}
