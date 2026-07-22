import { Capacitor } from '@capacitor/core'

const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim()
let apiAuthToken = ''

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

export function getApiBaseUrl() {
  if (!rawApiBaseUrl) return ''

  try {
    const url = new URL(rawApiBaseUrl)
    if (isNativeApp() && url.protocol !== 'https:') return ''
    return trimTrailingSlash(url.toString())
  } catch {
    return ''
  }
}

export function setApiAuthToken(token) {
  apiAuthToken = String(token || '').trim()
}

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  if (!path.startsWith('/')) throw new Error(`API path must begin with "/": ${path}`)

  const baseUrl = getApiBaseUrl()
  if (baseUrl) return `${baseUrl}${path}`
  if (isNativeApp()) {
    throw new Error('iOS production API is not configured. Set VITE_API_BASE_URL to your HTTPS Vercel API domain before building.')
  }
  return path
}

export function apiFetch(path, options) {
  return Promise.resolve().then(() => {
    const headers = new Headers(options?.headers || {})
    if (apiAuthToken && path.startsWith('/api/') && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${apiAuthToken}`)
    }
    return fetch(apiUrl(path), { ...options, headers })
  })
}
