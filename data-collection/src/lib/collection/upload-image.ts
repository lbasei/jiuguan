import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureGuestSession } from "@/lib/auth/ensure-guest-session";
import { createClient } from "@/lib/supabase/client";
import {
  ENTRY_IMAGE_MAX_BYTES,
  ENTRY_IMAGE_MIME_TYPES,
  ENTRY_IMAGES_BUCKET,
  type UploadImageResult,
} from "@/types/collection";

export type UploadImageOptions = {
  /** Inject client for tests / non-browser. Default: browser supabase client. */
  client?: SupabaseClient;
  /** Subfolder under user id. Default: draft */
  folder?: string;
  /** Original file name hint (Blob in Node may not have .name). */
  fileName?: string;
};

function isAllowedMime(type: string): boolean {
  return (ENTRY_IMAGE_MIME_TYPES as readonly string[]).includes(type);
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || "image";
  return base.replace(/[^\w.\-()+]/g, "_").slice(0, 120) || "image";
}

/**
 * Upload an image to the private `entry-images` bucket.
 * Path: `{user_id}/{folder}/{timestamp}-{filename}`
 */
export async function uploadImage(
  file: File | Blob,
  options: UploadImageOptions = {},
): Promise<UploadImageResult> {
  const supabase = options.client ?? createClient();
  const folder = options.folder ?? "draft";

  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedMime(mimeType)) {
    throw new Error(
      `不支持的图片类型：${mimeType}。仅支持 JPEG / PNG / WebP / GIF。`,
    );
  }

  if (file.size <= 0) {
    throw new Error("文件为空。");
  }

  if (file.size > ENTRY_IMAGE_MAX_BYTES) {
    throw new Error(
      `图片过大（${Math.ceil(file.size / 1024 / 1024)}MB），上限 10MB。`,
    );
  }

  const user = await ensureGuestSession(supabase);

  const rawName =
    options.fileName ||
    (typeof File !== "undefined" && file instanceof File ? file.name : "image");
  const safeName = sanitizeFileName(rawName);
  const storagePath = `${user.id}/${folder}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ENTRY_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(ENTRY_IMAGES_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (signedError) {
    // Upload succeeded; preview URL is optional.
    return {
      storage_path: storagePath,
      mime_type: mimeType,
      signed_url: null,
    };
  }

  return {
    storage_path: storagePath,
    mime_type: mimeType,
    signed_url: signed.signedUrl,
  };
}
