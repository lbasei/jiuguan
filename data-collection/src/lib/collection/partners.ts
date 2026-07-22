import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type PartnerMediaKind = "logo" | "qr" | "booth" | "cover";

export type MapZone =
  | "ai_lab"
  | "knowledge_tree"
  | "tavern"
  | "creative"
  | "amusement"
  | "onchain"
  | "friendship";

export type PartnerMedia = {
  id: string;
  partner_id: string;
  kind: PartnerMediaKind;
  storage_path: string;
  public_url: string | null;
  mime_type: string | null;
  sort_order: number;
};

export type AdventurePartner = {
  id: string;
  slug: string;
  name: string;
  intro: string;
  keyword: string;
  task: string;
  reward: string;
  website: string | null;
  campaign: string;
  sort_order: number;
  is_active: boolean;
  zone: MapZone | null;
  pin_x: number | null;
  pin_y: number | null;
  booth_no: string | null;
  media: PartnerMedia[];
};

export type ListAdventurePartnersOptions = {
  client?: SupabaseClient;
  campaign?: string;
};

export const MAP_ZONE_LANDMARKS: Array<{
  id: MapZone;
  label: string;
  seed: string;
  x: number;
  y: number;
}> = [
  { id: "ai_lab", label: "AI 实验室", seed: "AI", x: 74, y: 14 },
  { id: "knowledge_tree", label: "知识之树", seed: "知识", x: 18, y: 38 },
  { id: "tavern", label: "种种酒馆", seed: "BAR", x: 48, y: 48 },
  { id: "creative", label: "创意工坊", seed: "创作", x: 80, y: 46 },
  { id: "amusement", label: "游乐乐园", seed: "游戏", x: 20, y: 70 },
  { id: "onchain", label: "链上花园", seed: "Web3", x: 78, y: 72 },
  { id: "friendship", label: "友谊驿站", seed: "社交", x: 48, y: 86 },
];

const DEFAULT_CAMPAIGN = "adventurex-2026";

type PartnerRow = Omit<AdventurePartner, "media" | "pin_x" | "pin_y"> & {
  pin_x: number | string | null;
  pin_y: number | string | null;
  partner_media?: PartnerMedia[] | null;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function partnerLogoUrl(partner: AdventurePartner): string | null {
  const logo = partner.media
    .filter((item) => item.kind === "logo")
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return logo?.public_url ?? null;
}

export function partnerQrUrl(partner: AdventurePartner): string | null {
  const qr = partner.media
    .filter((item) => item.kind === "qr")
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return qr?.public_url ?? null;
}

export function partnerBoothImageUrl(partner: AdventurePartner): string | null {
  const booth = partner.media
    .filter((item) => item.kind === "booth" || item.kind === "cover")
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return booth?.public_url ?? partnerLogoUrl(partner);
}

export async function listAdventurePartners(
  options: ListAdventurePartnersOptions = {},
): Promise<AdventurePartner[]> {
  const supabase = options.client ?? createClient();
  const campaign = options.campaign?.trim() || DEFAULT_CAMPAIGN;

  const { data, error } = await supabase
    .from("adventure_partners")
    .select(
      "id, slug, name, intro, keyword, task, reward, website, campaign, sort_order, is_active, zone, pin_x, pin_y, booth_no, partner_media ( id, partner_id, kind, storage_path, public_url, mime_type, sort_order )",
    )
    .eq("campaign", campaign)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data as PartnerRow[] | null) ?? []).map((row) => {
    const media = [...(row.partner_media ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      intro: row.intro,
      keyword: row.keyword,
      task: row.task,
      reward: row.reward,
      website: row.website,
      campaign: row.campaign,
      sort_order: row.sort_order,
      is_active: row.is_active,
      zone: row.zone,
      pin_x: toNumber(row.pin_x),
      pin_y: toNumber(row.pin_y),
      booth_no: row.booth_no,
      media,
    };
  });
}

export function findAdventurePartner(
  partners: AdventurePartner[],
  idOrSlug: string | null | undefined,
) {
  if (!idOrSlug) return null;
  return (
    partners.find((partner) => partner.id === idOrSlug) ??
    partners.find((partner) => partner.slug === idOrSlug) ??
    null
  );
}

export function zoneLabel(zone: MapZone | null | undefined) {
  if (!zone) return "未分区";
  return MAP_ZONE_LANDMARKS.find((item) => item.id === zone)?.label ?? zone;
}
