import { createClient } from '@supabase/supabase-js'

export function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '')
  const anonKey = String(
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  ).trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return { url, anonKey, serviceKey }
}

export function hasSupabase() {
  const { url, serviceKey } = getSupabaseConfig()
  return Boolean(url && serviceKey)
}

export function hasSupabaseAuth() {
  const { url, anonKey } = getSupabaseConfig()
  return Boolean(url && anonKey)
}

let serviceClient = null

export function getServiceClient() {
  const { url, serviceKey } = getSupabaseConfig()
  if (!url || !serviceKey) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  if (!serviceClient) {
    serviceClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return serviceClient
}

export async function supabasePasswordGrant(email, password) {
  const { url, anonKey } = getSupabaseConfig()
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token) {
    return {
      ok: false,
      status: response.status,
      data,
      message: data.error_description || data.msg || data.error || '登录失败',
    }
  }
  return {
    ok: true,
    userId: data.user?.id,
    email: data.user?.email || email,
    data,
  }
}

export async function supabaseAdminCreateUser(email, password) {
  const { url, serviceKey } = getSupabaseConfig()
  if (!serviceKey) return { ok: false, missingServiceKey: true, data: {} }
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { ok: false, status: response.status, data }
  }
  return { ok: true, userId: data.id || data.user?.id, data }
}

export function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase().slice(0, 254)
}

export async function supabaseAdminGetUserByEmail(email) {
  const { url, serviceKey } = getSupabaseConfig()
  if (!serviceKey) return null
  const normalized = normalizeEmail(email)
  const response = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  )
  const data = await response.json().catch(() => ({}))
  const users = data.users || []
  if (!Array.isArray(users)) return null
  return users.find((user) => normalizeEmail(user.email) === normalized) || null
}
