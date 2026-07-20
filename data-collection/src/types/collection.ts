export type TemplateSlug =
  | "place"
  | "plant"
  | "weather"
  | "animal"
  | "story"
  | "custom"
  | "adventurex-profile"
  | "today-menu"
  | "booth-record"
  | "tavern-park"
  | "tavern-promise";

export type TemplateRenderType =
  | "form"
  | "result-card"
  | "archive"
  | "route-record";

export type EntryStatus = "draft" | "submitted";

export type GeneratedPageStatus = "pending" | "ready" | "failed";

export type FieldSchemaItem = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

export type Template = {
  id: string;
  slug: TemplateSlug;
  name: string;
  description: string | null;
  field_schema: FieldSchemaItem[] | unknown[];
  is_system: boolean;
  version: number;
  render_type: TemplateRenderType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Entry = {
  id: string;
  user_id: string;
  template_id: string;
  title: string;
  description: string | null;
  body: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  collected_at: string;
  extra: Record<string, unknown>;
  source: string | null;
  campaign: string | null;
  status: EntryStatus;
  is_public: boolean;
  submitted_at: string | null;
  template_version: number;
  created_at: string;
  updated_at: string;
};

export type EntryContact = {
  id: string;
  entry_id: string;
  wechat: string | null;
  email: string | null;
  join_beta: boolean;
  allow_research: boolean;
  allow_contact: boolean;
  created_at: string;
};

export type GeneratedPage = {
  id: string;
  entry_id: string;
  template_slug: string;
  share_slug: string;
  render_data: Record<string, unknown>;
  status: GeneratedPageStatus;
  error_message: string | null;
  /** Copied from entries.is_public on insert; used by public RLS */
  is_public: boolean;
  /** null = 未兑；有值 = 现场已核销 */
  redeemed_at: string | null;
  /** 可选：核销工作人员标识 */
  redeemed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EntryMedia = {
  id: string;
  entry_id: string;
  user_id: string;
  storage_path: string;
  public_url: string | null;
  mime_type: string | null;
  sort_order: number;
  created_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type EntryContactInput = {
  wechat?: string;
  email?: string;
  join_beta?: boolean;
  allow_research?: boolean;
  allow_contact?: boolean;
};

export type CreateEntryInput = {
  template_slug: TemplateSlug;
  title: string;
  description?: string;
  /** Free-form long text (e.g. booth notes). Not for structured answers. */
  body?: string;
  lat?: number;
  lng?: number;
  address?: string;
  collected_at?: string;
  tags?: string[];
  /** Shortcut: storage paths from uploadImage */
  media_paths?: string[];
  /** Prefer when you also have mime_type from uploadImage */
  media?: Array<{ storage_path: string; mime_type?: string | null }>;
  /**
   * Structured answers matching template.field_schema.
   * Do NOT put contact/consent here — use `contact`.
   */
  extra?: Record<string, unknown>;
  /** Traffic source: booth | poster | friend | partner | xiaohongshu … */
  source?: string;
  /** Campaign id, e.g. adventurex-2026 */
  campaign?: string;
  status?: EntryStatus;
  /** Whether a public result page may be generated/shared */
  is_public?: boolean;
  /** Optional contact + consents (written to entry_contacts, not extra) */
  contact?: EntryContactInput;
};

export const TEMPLATE_SLUGS: TemplateSlug[] = [
  "place",
  "plant",
  "weather",
  "animal",
  "story",
  "custom",
  "adventurex-profile",
  "today-menu",
  "booth-record",
  "tavern-park",
  "tavern-promise",
];

/** Storage bucket for entry images (private). */
export const ENTRY_IMAGES_BUCKET = "entry-images" as const;

export const ENTRY_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const ENTRY_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type EntryImageMimeType = (typeof ENTRY_IMAGE_MIME_TYPES)[number];

export type UploadImageResult = {
  storage_path: string;
  mime_type: string;
  /** Signed URL for short-lived preview (private bucket). */
  signed_url: string | null;
};
