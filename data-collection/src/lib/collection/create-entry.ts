import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureGuestSession } from "@/lib/auth/ensure-guest-session";
import { createClient } from "@/lib/supabase/client";
import type {
  CreateEntryInput,
  Entry,
  EntryContact,
  EntryContactInput,
  EntryMedia,
  EntryStatus,
  Template,
  TemplateSlug,
} from "@/types/collection";

export type CreateEntryOptions = {
  client?: SupabaseClient;
};

export type CreatedEntry = Entry & {
  template_slug: TemplateSlug;
  tags: string[];
  media: Pick<EntryMedia, "id" | "storage_path" | "mime_type" | "sort_order">[];
  contact: EntryContact | null;
};

export type ListEntriesOptions = {
  client?: SupabaseClient;
  template_slug?: TemplateSlug;
  limit?: number;
};

function resolveClient(client?: SupabaseClient) {
  return client ?? createClient();
}

async function requireUser(supabase: SupabaseClient) {
  return ensureGuestSession(supabase);
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function resolveMedia(
  input: CreateEntryInput,
): Array<{ storage_path: string; mime_type: string | null }> {
  const fromMedia =
    input.media?.map((m) => ({
      storage_path: m.storage_path,
      mime_type: m.mime_type ?? null,
    })) ?? [];
  const fromPaths =
    input.media_paths?.map((storage_path) => ({
      storage_path,
      mime_type: null as string | null,
    })) ?? [];

  const seen = new Set<string>();
  const out: Array<{ storage_path: string; mime_type: string | null }> = [];
  for (const item of [...fromMedia, ...fromPaths]) {
    const path = item.storage_path.trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push({ storage_path: path, mime_type: item.mime_type });
  }
  return out;
}

function normalizeContact(
  contact: EntryContactInput | undefined,
): {
  wechat: string | null;
  email: string | null;
  join_beta: boolean;
  allow_research: boolean;
  allow_contact: boolean;
} | null {
  if (!contact) return null;

  const wechat = contact.wechat?.trim() || null;
  const email = contact.email?.trim() || null;
  if (!wechat && !email) return null;

  return {
    wechat,
    email,
    join_beta: Boolean(contact.join_beta),
    allow_research: Boolean(contact.allow_research),
    allow_contact: Boolean(contact.allow_contact),
  };
}

function resolveStatus(status: EntryStatus | undefined): EntryStatus {
  return status === "draft" ? "draft" : "submitted";
}

export async function listTemplates(
  options: { client?: SupabaseClient; activeOnly?: boolean } = {},
): Promise<Template[]> {
  const supabase = resolveClient(options.client);
  let query = supabase.from("templates").select("*").order("slug", {
    ascending: true,
  });

  if (options.activeOnly !== false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Template[];
}

export async function getTemplateBySlug(
  slug: string,
  options: { client?: SupabaseClient; activeOnly?: boolean } = {},
): Promise<Template | null> {
  const supabase = resolveClient(options.client);
  let query = supabase.from("templates").select("*").eq("slug", slug);

  if (options.activeOnly !== false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Template | null) ?? null;
}

/**
 * Create a collection entry with optional tags, media, campaign fields, and contact.
 * Media files must already be uploaded (e.g. via uploadImage).
 * Contact/consent go to entry_contacts — never into extra.
 */
export async function createEntry(
  input: CreateEntryInput,
  options: CreateEntryOptions = {},
): Promise<CreatedEntry> {
  const supabase = resolveClient(options.client);
  const user = await requireUser(supabase);

  const title = input.title?.trim() ?? "";
  if (!title) {
    throw new Error("标题不能为空。");
  }

  if (input.lat != null && (input.lat < -90 || input.lat > 90)) {
    throw new Error("纬度超出范围（-90 ~ 90）。");
  }
  if (input.lng != null && (input.lng < -180 || input.lng > 180)) {
    throw new Error("经度超出范围（-180 ~ 180）。");
  }

  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("id, slug, version, is_active")
    .eq("slug", input.template_slug)
    .maybeSingle();

  if (templateError) throw new Error(templateError.message);
  if (!template) {
    throw new Error(`未知模块：${input.template_slug}`);
  }
  if (template.is_active === false) {
    throw new Error(`模板已停用：${input.template_slug}`);
  }

  const media = resolveMedia(input);
  for (const item of media) {
    if (!item.storage_path.startsWith(`${user.id}/`)) {
      throw new Error(
        `图片路径不属于当前用户：${item.storage_path}`,
      );
    }
  }

  const status = resolveStatus(input.status);
  const submittedAt =
    status === "submitted" ? new Date().toISOString() : null;
  const contactPayload = normalizeContact(input.contact);

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .insert({
      user_id: user.id,
      template_id: template.id,
      title,
      description: input.description?.trim() || null,
      body: input.body?.trim() || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      address: input.address?.trim() || null,
      collected_at: input.collected_at || new Date().toISOString(),
      extra: input.extra ?? {},
      source: input.source?.trim() || null,
      campaign: input.campaign?.trim() || null,
      status,
      is_public: Boolean(input.is_public),
      submitted_at: submittedAt,
      template_version: template.version ?? 1,
    })
    .select("*")
    .single();

  if (entryError) throw new Error(entryError.message);

  let contact: EntryContact | null = null;
  if (contactPayload) {
    const { data: contactRow, error: contactError } = await supabase
      .from("entry_contacts")
      .insert({
        entry_id: entry.id,
        ...contactPayload,
      })
      .select("*")
      .single();

    if (contactError) throw new Error(contactError.message);
    contact = contactRow as EntryContact;
  }

  const tagNames = normalizeTags(input.tags);
  const tagIds: string[] = [];

  for (const name of tagNames) {
    const { data: existing, error: findError } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", name)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    if (existing) {
      tagIds.push(existing.id);
      continue;
    }

    const { data: createdTag, error: tagError } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name })
      .select("id")
      .single();

    if (tagError) {
      const { data: again, error: againError } = await supabase
        .from("tags")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", name)
        .maybeSingle();
      if (againError || !again) throw new Error(tagError.message);
      tagIds.push(again.id);
      continue;
    }

    tagIds.push(createdTag.id);
  }

  if (tagIds.length) {
    const { error: linkError } = await supabase.from("entry_tags").insert(
      tagIds.map((tag_id) => ({
        entry_id: entry.id,
        tag_id,
      })),
    );
    if (linkError) throw new Error(linkError.message);
  }

  if (media.length) {
    const { error: mediaError } = await supabase.from("entry_media").insert(
      media.map((item, index) => ({
        entry_id: entry.id,
        user_id: user.id,
        storage_path: item.storage_path,
        mime_type: item.mime_type,
        sort_order: index,
      })),
    );
    if (mediaError) throw new Error(mediaError.message);
  }

  const { data: mediaRows, error: mediaReadError } = await supabase
    .from("entry_media")
    .select("id, storage_path, mime_type, sort_order")
    .eq("entry_id", entry.id)
    .order("sort_order", { ascending: true });

  if (mediaReadError) throw new Error(mediaReadError.message);

  return {
    ...(entry as Entry),
    template_slug: template.slug as TemplateSlug,
    tags: tagNames,
    media: mediaRows ?? [],
    contact,
  };
}

export async function listEntries(
  options: ListEntriesOptions = {},
): Promise<
  Array<
    Entry & {
      templates: { slug: TemplateSlug; name: string } | null;
    }
  >
> {
  const supabase = resolveClient(options.client);
  await requireUser(supabase);

  let query = supabase
    .from("entries")
    .select("*, templates ( slug, name )")
    .order("collected_at", { ascending: false })
    .limit(options.limit ?? 20);

  if (options.template_slug) {
    const { data: template, error } = await supabase
      .from("templates")
      .select("id")
      .eq("slug", options.template_slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!template) return [];
    query = query.eq("template_id", template.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<
    Entry & { templates: { slug: TemplateSlug; name: string } | null }
  >;
}
