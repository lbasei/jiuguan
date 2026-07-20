import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-6 px-6 py-16 font-sans">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">种种 · data-collection</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
            信息收集系统后端
          </h1>
          <p className="mt-2 text-zinc-600">
            MVP：统一 Schema + Auth + Storage。六个模块共用 entries 表。
          </p>
        </div>
        {user ? <LogoutButton /> : null}
      </div>

      <section className="space-y-2 rounded border border-zinc-200 p-4 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">登录状态</p>
        {user ? (
          <ul className="list-inside list-disc space-y-1">
            <li>{user.is_anonymous ? "已登录（游客 / 匿名）" : "已登录"}</li>
            <li>
              邮箱：{user.email ?? "（匿名用户无邮箱）"}
            </li>
            <li>
              user_id：
              <code className="rounded bg-zinc-100 px-1 text-xs">{user.id}</code>
            </li>
            <li>profiles.display_name：{profile?.display_name ?? "（无）"}</li>
          </ul>
        ) : (
          <p>
            未登录。请先{" "}
            <Link href="/login" className="underline">
              登录 / 游客登录
            </Link>{" "}
            或{" "}
            <Link href="/signup" className="underline">
              注册
            </Link>
            。
          </p>
        )}
      </section>

      <section className="space-y-2 text-sm text-zinc-600">
        <p>
          种种酒馆现场流程：
          <Link
            href="/collect/tavern-park?source=booth&campaign=adventurex-2026"
            className="ml-1 underline"
          >
            进入联名游园
          </Link>
        </p>
        <p>
          现场动态表单：
          <Link
            href="/collect/adventurex-profile?source=poster"
            className="ml-1 underline"
          >
            /collect/adventurex-profile?source=poster
          </Link>
        </p>
        <p>
          图片上传：
          <Link href="/upload-test" className="ml-1 underline">
            /upload-test
          </Link>
        </p>
        <p>
          采集提交验收：
          <Link href="/entry-test" className="ml-1 underline">
            /entry-test
          </Link>
          （极简页；六个正式表单归同事 B）
        </p>
        <p>
          展位核销：
          <Link href="/staff/redeem" className="ml-1 underline">
            /staff/redeem
          </Link>
          （凭证 = share_slug）
        </p>
        <p>
          封装：
          <code className="rounded bg-zinc-100 px-1">
            uploadImage
          </code>
          {" + "}
          <code className="rounded bg-zinc-100 px-1">
            createEntry
          </code>
          （见{" "}
          <code className="rounded bg-zinc-100 px-1">src/lib/collection/</code>
          ）
        </p>
        <p>
          字段类型：{" "}
          <code className="rounded bg-zinc-100 px-1">src/types/collection.ts</code>
        </p>
      </section>
    </main>
  );
}
