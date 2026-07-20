"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const entryId = searchParams.get("entry_id");
  const template = searchParams.get("template");
  const source = searchParams.get("source");

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-6 py-16 font-sans">
      <div>
        <p className="text-sm text-zinc-500">种种 · 现场采集</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">提交成功</h1>
        <p className="mt-2 text-sm text-zinc-600">
          答卷已保存。结果页生成中（小吴）；生成后将可通过 /share/[shareSlug]
          打开。
        </p>
      </div>

      <section className="space-y-2 rounded border border-zinc-200 p-4 text-sm text-zinc-700">
        <p>
          entry_id：
          <code className="ml-1 break-all rounded bg-zinc-100 px-1 text-xs">
            {entryId ?? "（缺失）"}
          </code>
        </p>
        {template ? <p>模板：{template}</p> : null}
        {source ? <p>source：{source}</p> : null}
      </section>

      <div className="flex flex-col gap-2 text-sm">
        {template ? (
          <Link
            href={`/collect/${template}${source ? `?source=${encodeURIComponent(source)}` : ""}`}
            className="underline"
          >
            再填一份
          </Link>
        ) : null}
        <Link href="/" className="underline">
          返回首页
        </Link>
      </div>
    </main>
  );
}

export default function CollectSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto px-6 py-16 text-sm text-zinc-600">加载中…</main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
