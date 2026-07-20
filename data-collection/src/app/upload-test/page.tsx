"use client";

import Link from "next/link";
import { useState } from "react";
import { uploadImage } from "@/lib/collection/upload-image";
import type { UploadImageResult } from "@/types/collection";

export default function UploadTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadImageResult | null>(null);

  async function onUpload() {
    if (!file) {
      setError("请先选择图片。");
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const uploaded = await uploadImage(file);
      setResult(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-6 py-16 font-sans">
      <div>
        <p className="text-sm text-zinc-500">种种 · data-collection</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">图片上传</h1>
        <p className="mt-2 text-sm text-zinc-600">
          上传到私有桶 <code className="rounded bg-zinc-100 px-1">entry-images</code>
          ，路径为 <code className="rounded bg-zinc-100 px-1">{"{user_id}/draft/..."}</code>
          。MVP 验收用，不做美化。
        </p>
      </div>

      <div className="flex flex-col gap-3 text-sm">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
          }}
        />
        <button
          type="button"
          onClick={onUpload}
          disabled={loading || !file}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? "上传中…" : "上传"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {result ? (
        <section className="space-y-2 rounded border border-zinc-200 p-4 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">上传成功</p>
          <p>
            path：
            <code className="break-all rounded bg-zinc-100 px-1 text-xs">
              {result.storage_path}
            </code>
          </p>
          <p>mime：{result.mime_type}</p>
          {result.signed_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.signed_url}
              alt="preview"
              className="mt-2 max-h-64 w-full object-contain"
            />
          ) : null}
        </section>
      ) : null}

      <p className="text-sm text-zinc-600">
        <Link href="/" className="underline">
          返回首页
        </Link>
      </p>
    </main>
  );
}
