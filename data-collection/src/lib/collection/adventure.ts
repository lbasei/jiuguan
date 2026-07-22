import { createClient } from "@/lib/supabase/client";
import { resolveTodaySpecial } from "@/lib/collection/today-special-engine";

/** Legacy map stops kept for older vouchers; park UI selects DB partners. */
export const ADVENTURE_PARK_STOPS = [
  {
    id: "co-brand-booth",
    label: "联名摊位",
    kind: "摊位",
    description: "从一个让你好奇的联名摊位开始，留下今天的第一枚印章。",
    hint: "摊主说：好奇心会替你打开下一扇门。",
    task: "找到一个想继续了解的联名摊位",
  },
  {
    id: "character-corner",
    label: "角色角落",
    kind: "角色",
    description: "和一位角色停一会儿，收下一句只属于现场的提示。",
    hint: "桂花说：先说出你想带走的那件小事。",
    task: "记下一句想带走的话",
  },
  {
    id: "story-landmark",
    label: "故事地标",
    kind: "地点",
    description: "在地图上选一个地点，把线下逛展变成自己的数字路线。",
    hint: "这里藏着一条通往承诺池的小路。",
    task: "记录一个让你想再回来的地点",
  },
  {
    id: "promise-pool",
    label: "承诺池",
    kind: "地点",
    description: "在水面上投下一颗种子，等它长成下一次出发的理由。",
    hint: "池边提示：承诺不必很大，只要真的属于你。",
    task: "准备一件愿意完成的小事",
  },
] as const;

export type AdventureParkStop = (typeof ADVENTURE_PARK_STOPS)[number];

export function findAdventureParkStop(id: string | null | undefined) {
  return ADVENTURE_PARK_STOPS.find((stop) => stop.id === id) ?? null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPart(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function createPublicCode(prefix: string) {
  return `${prefix}-${randomPart(4)}-${randomPart(4)}-${randomPart(4)}`;
}

export function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export type IssueAdventureVoucherInput = {
  entryId: string;
  campaign: string;
  promise: string;
  deadline: string;
  importance: number;
  timeCommitment: string;
  parkStop: AdventureParkStop | null;
  returnTo?: string | null;
};

export type IssuedAdventureVoucher = {
  shareSlug: string;
};

export type IssueTodaySpecialInput = {
  entryId: string;
  campaign: string;
  identity: string;
  state: string;
  task: string;
  blocker: string;
  returnTo?: string | null;
};

/**
 * A voucher is a public, bearer-style field card. Personal contact data stays
 * in entry_contacts and is intentionally excluded from render_data.
 */
export async function issueAdventureVoucher(
  input: IssueAdventureVoucherInput,
): Promise<IssuedAdventureVoucher> {
  const supabase = createClient();
  const returnTo = safeExternalUrl(input.returnTo);
  const account = process.env.NEXT_PUBLIC_TAVERN_ACCOUNT?.trim() || "种种酒馆";
  const contact =
    process.env.NEXT_PUBLIC_TAVERN_CONTACT?.trim() || "请前往种种酒馆展位咨询";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shareSlug = createPublicCode("ADV");
    const { error } = await supabase.from("generated_pages").insert({
      entry_id: input.entryId,
      template_slug: "tavern-promise",
      share_slug: shareSlug,
      status: "ready",
      is_public: true,
      render_data: {
        kind: "tavern-field-voucher",
        version: 1,
        campaign: input.campaign,
        issued_at: new Date().toISOString(),
        promise: input.promise,
        deadline: input.deadline,
        importance: input.importance,
        time_commitment: input.timeCommitment,
        park_stop: input.parkStop
          ? {
              id: input.parkStop.id,
              label: input.parkStop.label,
              kind: input.parkStop.kind,
            }
          : null,
        tavern: { account, contact },
        return_to: returnTo,
      },
    });

    if (!error) return { shareSlug };
    if (!/duplicate key|unique/i.test(error.message) || attempt === 2) {
      throw new Error(error.message);
    }
  }

  throw new Error("体验码生成失败，请稍后重试。");
}

export async function issueTodaySpecial(
  input: IssueTodaySpecialInput,
): Promise<IssuedAdventureVoucher> {
  const supabase = createClient();
  const returnTo = safeExternalUrl(input.returnTo);
  const account = process.env.NEXT_PUBLIC_TAVERN_ACCOUNT?.trim() || "种种酒馆";
  const contact =
    process.env.NEXT_PUBLIC_TAVERN_CONTACT?.trim() || "请在展位添加微信";
  const special = resolveTodaySpecial(input);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shareSlug = createPublicCode("MENU");
    const { error } = await supabase.from("generated_pages").insert({
      entry_id: input.entryId,
      template_slug: "tavern-guide",
      share_slug: shareSlug,
      status: "ready",
      is_public: true,
      render_data: {
        kind: "tavern-today-special",
        version: 1,
        campaign: input.campaign,
        issued_at: new Date().toISOString(),
        identity: input.identity,
        state: input.state,
        task: input.task,
        blocker: input.blocker || null,
        special,
        tavern: { account, contact },
        return_to: returnTo,
      },
    });

    if (!error) return { shareSlug };
    if (!/duplicate key|unique/i.test(error.message) || attempt === 2) {
      throw new Error(error.message);
    }
  }

  throw new Error("今日特调生成失败，请稍后重试。");
}
