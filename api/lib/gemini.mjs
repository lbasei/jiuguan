// Server-side Gemini client. Key never leaves process.env.

import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici'
import { EVOMAP_EXPERIENCES } from '../../src/data/evomap.js'
import {
  buildParseTodosSystemPrompt,
  buildSuggestBartenderSystemPrompt,
} from './prompts/parse-todos.mjs'

const DEFAULT_MODEL = 'gemini-flash-latest'
const DEFAULT_BASE = 'https://generativelanguage.googleapis.com'
const BARTENDER_IDS = [
  'rosemary',
  'ginger',
  'mint',
  'lemon',
  'garlic',
  'cilantro',
  'osmanthus',
  'chili',
]

export function getGeminiConfig() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim()
  const model = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const apiBase = String(process.env.GEMINI_API_BASE || DEFAULT_BASE).trim().replace(/\/$/, '') || DEFAULT_BASE
  const proxyUrl = String(
    process.env.GEMINI_HTTPS_PROXY
      || process.env.HTTPS_PROXY
      || process.env.https_proxy
      || process.env.HTTP_PROXY
      || process.env.http_proxy
      || '',
  ).trim()
  return { apiKey, model, apiBase, proxyUrl }
}

export function hasGemini() {
  return Boolean(getGeminiConfig().apiKey)
}

function extractJSON(text) {
  const fence = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fence ? fence[1] : String(text || '')
  const start = raw.search(/[[{]/)
  if (start === -1) throw new Error('no json in gemini response')
  return JSON.parse(raw.slice(start))
}

function pickBartenderIdFromText(text) {
  const lower = String(text || '').toLowerCase()
  return BARTENDER_IDS.find((id) => lower.includes(id)) || ''
}

function pickText(data) {
  const parts = data?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((part) => part.text || '').join('').trim()
}

function createDispatcher(proxyUrl) {
  if (proxyUrl) return new ProxyAgent(proxyUrl)
  return new Agent({ connectTimeout: 20_000, headersTimeout: 60_000, bodyTimeout: 60_000 })
}

export async function callGemini({ system, user, maxTokens = 1500 }) {
  const { apiKey, model, apiBase, proxyUrl } = getGeminiConfig()
  if (!apiKey) {
    const error = new Error('gemini_not_configured')
    error.code = 'gemini_not_configured'
    throw error
  }

  const url = `${apiBase}/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const dispatcher = createDispatcher(proxyUrl)

  let response
  try {
    response = await undiciFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: user }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      }),
      dispatcher,
    })
  } catch (error) {
    const wrapped = new Error(
      `Gemini network error: ${error.cause?.message || error.message}. `
        + '若已开 VPN，请把代理写入 HTTPS_PROXY / GEMINI_HTTPS_PROXY（本机常见 Clash 混合端口：http://127.0.0.1:7897）。',
    )
    wrapped.cause = error
    throw wrapped
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || `Gemini ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }

  const text = pickText(data)
  if (!text) throw new Error('gemini_empty_response')
  return text
}

function evoMapForPrompt() {
  return EVOMAP_EXPERIENCES.map((exp) => ({
    id: exp.id,
    name: exp.name,
    pattern: exp.pattern,
    strategy: exp.strategy,
    apply: exp.apply,
  }))
}

export async function geminiParseTodos(text) {
  const out = await callGemini({
    system: buildParseTodosSystemPrompt(evoMapForPrompt()),
    user: String(text || '').slice(0, 4000),
    maxTokens: 1800,
  })
  const parsed = extractJSON(out)
  return {
    todos: Array.isArray(parsed.todos) ? parsed.todos : Array.isArray(parsed) ? parsed : [],
    ignoredContext: Array.isArray(parsed.ignoredContext) ? parsed.ignoredContext : [],
    evoSignals: Array.isArray(parsed.evoSignals) ? parsed.evoSignals : [],
    note: String(parsed.note || ''),
  }
}

export async function geminiSuggestBartender(text) {
  const options = BARTENDER_IDS.map((id) => `${id}`)
  const out = await callGemini({
    system: buildSuggestBartenderSystemPrompt(options),
    user: `${String(text || '').slice(0, 2000)}\n\n只返回 JSON：{"id":"...","note":"..."}`,
    maxTokens: 1024,
  })
  let parsed = null
  try {
    parsed = extractJSON(out)
  } catch {
    const fallbackId = pickBartenderIdFromText(out)
    if (!fallbackId) throw new Error('no json in gemini response')
    parsed = { id: fallbackId, note: '替你挑了一只合适的。' }
  }
  const id = BARTENDER_IDS.includes(parsed.id) ? parsed.id : pickBartenderIdFromText(out) || 'rosemary'
  return {
    id: BARTENDER_IDS.includes(id) ? id : 'rosemary',
    note: String(parsed.note || '').slice(0, 40),
  }
}
