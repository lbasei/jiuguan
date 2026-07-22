import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const DEFAULT_CAMPAIGN = "adventurex-2026";

function responseHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  };
}

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { partners: [], error: "Partner data source is not configured." },
      { status: 500, headers: responseHeaders() },
    );
  }

  const requestedCampaign = new URL(request.url).searchParams
    .get("campaign")
    ?.trim();
  const campaign = requestedCampaign || DEFAULT_CAMPAIGN;
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("adventure_partners")
    .select("id, name, intro, keyword, task, reward, website")
    .eq("campaign", campaign)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { partners: [], error: "Partner wall is temporarily unavailable." },
      { status: 503, headers: responseHeaders() },
    );
  }

  return NextResponse.json(
    { partners: data ?? [] },
    { headers: responseHeaders() },
  );
}
