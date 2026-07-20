"use server";

import {
  lookupByShareSlug,
  redeemByShareSlug,
  verifyStaffPassword,
  type RedeemLookupResult,
  type RedeemResult,
} from "@/lib/collection/redeem";

export async function staffLookupAction(input: {
  password: string;
  code: string;
}): Promise<RedeemLookupResult | { ok: false; error: string; code: "unauthorized" }> {
  if (!verifyStaffPassword(input.password)) {
    return { ok: false, error: "口令错误", code: "unauthorized" };
  }
  return lookupByShareSlug(input.code);
}

export async function staffRedeemAction(input: {
  password: string;
  code: string;
  redeemedBy?: string;
}): Promise<RedeemResult> {
  if (!verifyStaffPassword(input.password)) {
    return { ok: false, error: "口令错误", code: "unauthorized" };
  }
  return redeemByShareSlug({
    code: input.code,
    redeemedBy: input.redeemedBy,
  });
}
