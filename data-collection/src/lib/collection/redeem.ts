import { createServiceClient } from "../supabase/admin";

export type RedeemLookupResult =
  | {
      ok: true;
      page: {
        id: string;
        share_slug: string;
        entry_id: string;
        template_slug: string;
        status: string;
        is_public: boolean;
        redeemed_at: string | null;
        redeemed_by: string | null;
        created_at: string;
      };
    }
  | { ok: false; error: string; code: "not_found" | "not_ready" };

export type RedeemResult =
  | {
      ok: true;
      already?: boolean;
      page: {
        id: string;
        share_slug: string;
        redeemed_at: string;
        redeemed_by: string | null;
      };
    }
  | {
      ok: false;
      error: string;
      code: "not_found" | "not_ready" | "unauthorized" | "server";
    };

type SchemaMode = "columns" | "json";

let cachedMode: SchemaMode | null = null;

type PageRow = {
  id: string;
  share_slug: string;
  entry_id: string;
  template_slug: string;
  status: string;
  is_public: boolean;
  created_at: string;
  render_data?: Record<string, unknown> | null;
  redeemed_at?: string | null;
  redeemed_by?: string | null;
};

function normalizeCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.includes("://") || trimmed.startsWith("/")) {
      const url = trimmed.startsWith("/")
        ? new URL(trimmed, "http://local")
        : new URL(trimmed);
      const fromQuery =
        url.searchParams.get("code") ?? url.searchParams.get("slug");
      if (fromQuery?.trim()) return fromQuery.trim();
      const parts = url.pathname.split("/").filter(Boolean);
      const shareIdx = parts.indexOf("share");
      if (shareIdx >= 0 && parts[shareIdx + 1]) {
        return decodeURIComponent(parts[shareIdx + 1]);
      }
      return decodeURIComponent(parts[parts.length - 1] ?? "");
    }
  } catch {
    // treat as raw slug
  }

  return trimmed;
}

export function extractShareSlug(raw: string): string {
  return normalizeCode(raw);
}

function redeemFromRenderData(
  render_data: Record<string, unknown> | null | undefined,
): {
  redeemed_at: string | null;
  redeemed_by: string | null;
} {
  const meta = render_data?.__redeem;
  if (meta && typeof meta === "object" && meta !== null) {
    const m = meta as Record<string, unknown>;
    return {
      redeemed_at: typeof m.at === "string" ? m.at : null,
      redeemed_by: typeof m.by === "string" ? m.by : null,
    };
  }
  return { redeemed_at: null, redeemed_by: null };
}

function mergeRedeemIntoRenderData(
  render_data: Record<string, unknown> | null | undefined,
  redeemed_at: string,
  redeemed_by: string | null,
): Record<string, unknown> {
  return {
    ...(render_data ?? {}),
    __redeem: {
      at: redeemed_at,
      by: redeemed_by,
    },
  };
}

async function detectSchemaMode(): Promise<SchemaMode> {
  if (cachedMode) return cachedMode;
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("generated_pages")
    .select("redeemed_at")
    .limit(1);

  if (error && /redeemed_at/i.test(error.message)) {
    cachedMode = "json";
  } else {
    cachedMode = "columns";
  }
  return cachedMode;
}

function toPage(data: PageRow) {
  const fromJson = redeemFromRenderData(data.render_data);
  return {
    id: data.id,
    share_slug: data.share_slug,
    entry_id: data.entry_id,
    template_slug: data.template_slug,
    status: data.status,
    is_public: data.is_public,
    redeemed_at: data.redeemed_at ?? fromJson.redeemed_at,
    redeemed_by: data.redeemed_by ?? fromJson.redeemed_by,
    created_at: data.created_at,
  };
}

export async function lookupByShareSlug(
  rawCode: string,
): Promise<RedeemLookupResult> {
  const share_slug = extractShareSlug(rawCode);
  if (!share_slug) {
    return { ok: false, error: "请输入凭证编号", code: "not_found" };
  }

  const mode = await detectSchemaMode();
  const supabase = createServiceClient();

  const query =
    mode === "columns"
      ? supabase
          .from("generated_pages")
          .select(
            "id, share_slug, entry_id, template_slug, status, is_public, redeemed_at, redeemed_by, created_at, render_data",
          )
          .eq("share_slug", share_slug)
          .maybeSingle()
      : supabase
          .from("generated_pages")
          .select(
            "id, share_slug, entry_id, template_slug, status, is_public, created_at, render_data",
          )
          .eq("share_slug", share_slug)
          .maybeSingle();

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return { ok: false, error: "找不到该凭证", code: "not_found" };
  }

  const page = toPage(data as unknown as PageRow);
  if (page.status !== "ready") {
    return {
      ok: false,
      error: `结果尚未就绪（status=${page.status}）`,
      code: "not_ready",
    };
  }

  return { ok: true, page };
}

export async function redeemByShareSlug(input: {
  code: string;
  redeemedBy?: string;
}): Promise<RedeemResult> {
  const looked = await lookupByShareSlug(input.code);
  if (!looked.ok) {
    return looked;
  }

  if (looked.page.redeemed_at) {
    return {
      ok: true,
      already: true,
      page: {
        id: looked.page.id,
        share_slug: looked.page.share_slug,
        redeemed_at: looked.page.redeemed_at,
        redeemed_by: looked.page.redeemed_by,
      },
    };
  }

  const redeemed_at = new Date().toISOString();
  const redeemed_by = input.redeemedBy?.trim() || null;
  const mode = await detectSchemaMode();
  const supabase = createServiceClient();

  if (mode === "columns") {
    const { data, error } = await supabase
      .from("generated_pages")
      .update({ redeemed_at, redeemed_by })
      .eq("id", looked.page.id)
      .is("redeemed_at", null)
      .select("id, share_slug, redeemed_at, redeemed_by")
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message, code: "server" };
    }

    if (!data) {
      const again = await lookupByShareSlug(input.code);
      if (again.ok && again.page.redeemed_at) {
        return {
          ok: true,
          already: true,
          page: {
            id: again.page.id,
            share_slug: again.page.share_slug,
            redeemed_at: again.page.redeemed_at,
            redeemed_by: again.page.redeemed_by,
          },
        };
      }
      return { ok: false, error: "核销失败，请重试", code: "server" };
    }

    return {
      ok: true,
      already: false,
      page: {
        id: data.id,
        share_slug: data.share_slug,
        redeemed_at: data.redeemed_at!,
        redeemed_by: data.redeemed_by,
      },
    };
  }

  // Fallback before migration: stamp __redeem into render_data
  const { data: current, error: readError } = await supabase
    .from("generated_pages")
    .select("id, share_slug, render_data")
    .eq("id", looked.page.id)
    .maybeSingle();

  if (readError || !current) {
    return {
      ok: false,
      error: readError?.message ?? "核销失败，请重试",
      code: "server",
    };
  }

  const existing = redeemFromRenderData(
    current.render_data as Record<string, unknown> | null,
  );
  if (existing.redeemed_at) {
    return {
      ok: true,
      already: true,
      page: {
        id: current.id,
        share_slug: current.share_slug,
        redeemed_at: existing.redeemed_at,
        redeemed_by: existing.redeemed_by,
      },
    };
  }

  const nextRender = mergeRedeemIntoRenderData(
    current.render_data as Record<string, unknown> | null,
    redeemed_at,
    redeemed_by,
  );

  const { data, error } = await supabase
    .from("generated_pages")
    .update({ render_data: nextRender })
    .eq("id", current.id)
    .select("id, share_slug, render_data")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "核销失败，请重试",
      code: "server",
    };
  }

  const stamped = redeemFromRenderData(
    data.render_data as Record<string, unknown> | null,
  );

  return {
    ok: true,
    already: false,
    page: {
      id: data.id,
      share_slug: data.share_slug,
      redeemed_at: stamped.redeemed_at!,
      redeemed_by: stamped.redeemed_by,
    },
  };
}

export function verifyStaffPassword(password: string): boolean {
  const expected = process.env.STAFF_REDEEM_PASSWORD;
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false;
    return password === "" || password === "dev";
  }
  return password === expected;
}
