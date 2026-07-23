import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { randomInt, randomUUID } from 'node:crypto'
import {
  hasSupabase,
  hasSupabaseAuth,
  supabaseAdminCreateUser,
  supabaseAdminGetUserByEmail,
  supabasePasswordGrant,
} from './lib/supabase.mjs'
import {
  addFriendship,
  createEvent,
  createInviteRow,
  createSession,
  createShare,
  findUserByEmail,
  findUserById,
  getInvite,
  getSession,
  listDrinks,
  listDrinksForReport,
  listFriendshipsForUser,
  listInvites,
  listMemories,
  loadDbSnapshot,
  markInviteUsed,
  persistReviewMemory,
  saveDrink,
  findHabitsByUserId,
  saveHabitsFromProfile,
  clearUserMemories,
  upsertUser,
} from './lib/store.mjs'
import {
  geminiParseTodos,
  geminiSuggestBartender,
  getGeminiConfig,
  hasGemini,
} from './lib/gemini.mjs'

let petProcess = null
const INVITE_THEMES = {
  mint: ['MINT', 'LEAF', 'SOFT'],
  lemon: ['LEMON', 'SUN', 'SPARK'],
  rosemary: ['ROSE', 'FOCUS', 'TOWER'],
  garlic: ['GARLIC', 'GUARD', 'GATE'],
  ginger: ['GINGER', 'FIRE', 'WARM'],
  cilantro: ['CILANTRO', 'BREEZE', 'GREEN'],
  osmanthus: ['OSMANTHUS', 'GOLD', 'BLOOM'],
  chili: ['CHILI', 'FLAME', 'BURST'],
  zhongzhong: ['ZHONG', 'ZHUZHU', 'TAVERN'],
}

function loadLocalEnv() {
  for (const file of ['.env', '.env.local']) {
    const envPath = path.resolve(process.cwd(), file)
    if (!existsSync(envPath)) continue
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index).trim()
      const rawValue = trimmed.slice(index + 1).trim()
      if (!key || process.env[key]) continue
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  }
}

loadLocalEnv()

function createId(prefix) {
  const random = randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${random}`
}

function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase().slice(0, 254)
}

function validateEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))
}

function validatePassword(password = '') {
  return String(password || '').length >= 6
}

function randomInviteCode(theme = 'zhongzhong') {
  const key = String(theme || 'zhongzhong').toLowerCase()
  const words = INVITE_THEMES[key] || INVITE_THEMES.zhongzhong
  const head = words[randomInt(0, words.length)]
  const tail = randomInt(1000, 9999)
  return `${head}${tail}`
}

async function createInvite(input = {}) {
  const theme = String(input.theme || input.bartenderId || 'zhongzhong').toLowerCase()
  const maxUses = Math.max(1, Math.min(9999, Number(input.maxUses || 1)))
  const label = String(input.label || '种种请柬').trim().slice(0, 32) || '种种请柬'
  let code = String(input.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18)
  for (let i = 0; !code || (await getInvite(code)); i += 1) {
    code = randomInviteCode(theme)
    if (i > 20) code = `${randomInviteCode(theme)}${randomInt(10, 99)}`
  }
  return createInviteRow({ code, label, theme, maxUses })
}

function publicUser(user = {}) {
  const email = normalizeEmail(user.email)
  const maskedEmail = email ? email.replace(/^(.).*(@.*)$/, (_, a, b) => `${a}***${b}`) : ''
  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName || user.name,
    gender: user.gender || 'neutral',
    locationLabel: user.locationLabel || '远方',
    coords: user.coords || null,
    email: maskedEmail,
    inviteCode: user.inviteCode || '',
    updatedAt: user.updatedAt,
  }
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.end(JSON.stringify(data))
}

function canManageInvites(req) {
  const adminKey = process.env.INVITE_ADMIN_KEY || ''
  if (!adminKey && !process.env.VERCEL) return true
  const headerKey = req.headers['x-admin-key'] || ''
  const authKey = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  return Boolean(adminKey && (headerKey === adminKey || authKey === adminKey))
}

async function requireAuthenticatedUser(req, res) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    sendJson(res, 401, { error: 'unauthorized', message: '请先登录。' })
    return null
  }
  const session = await getSession(token)
  if (!session || session.expiresAt < Date.now()) {
    sendJson(res, 401, { error: 'unauthorized', message: '登录已过期，请重新入座。' })
    return null
  }
  const user = await findUserById(session.userId)
  if (!user) {
    sendJson(res, 401, { error: 'user_missing', message: '没有找到当前用户。' })
    return null
  }
  return user
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

function normalizeUser(input = {}) {
  const id = input.id || createId('guest')
  const email = normalizeEmail(input.email)
  const fallbackName = email ? email.split('@')[0].slice(0, 24) : '无名旅人'
  const name = String(input.name || input.displayName || '').trim().slice(0, 24) || fallbackName
  const gender = ['male', 'female', 'neutral'].includes(input.gender) ? input.gender : 'neutral'
  const locationLabel = String(input.locationLabel || input.locationName || '').trim().slice(0, 36) || '远方'
  return {
    id,
    name,
    displayName: name,
    gender,
    locationLabel,
    coords: input.coords || null,
    email,
    inviteCode: input.inviteCode || '',
    updatedAt: new Date().toISOString(),
  }
}

async function ensureInvite(inviteCode = '') {
  const code = String(inviteCode || '').trim().toUpperCase()
  if (!code) return { ok: false, error: 'missing_invite' }
  const invite = await getInvite(code)
  if (!invite) return { ok: false, error: 'invalid_invite' }
  const usedBy = invite.usedBy || []
  if (invite.maxUses && usedBy.length >= invite.maxUses) return { ok: false, error: 'invite_full' }
  return { ok: true, code, invite }
}

async function emailPasswordAuth(email, password, inviteCode) {
  if (!hasSupabaseAuth()) {
    return {
      ok: false,
      error: 'supabase_not_configured',
      message: '邮箱登录未配置，请设置 SUPABASE_URL 和 SUPABASE_ANON_KEY。',
    }
  }

  const signedIn = await supabasePasswordGrant(email, password)
  if (signedIn.ok) {
    return { ok: true, created: false, userId: signedIn.userId, email: signedIn.email }
  }

  const existingProfile = await findUserByEmail(email)
  const authUser = await supabaseAdminGetUserByEmail(email)
  if (existingProfile || authUser) {
    return { ok: false, error: 'auth_invalid', message: '邮箱或密码不对。' }
  }

  const inviteCheck = await ensureInvite(inviteCode)
  if (!inviteCheck.ok) {
    return {
      ok: false,
      error: inviteCheck.error,
      message: '邀请码不对，先找酒馆掌柜要一张。',
    }
  }

  const created = await supabaseAdminCreateUser(email, password)
  if (!created.ok) {
    return { ok: false, error: 'auth_failed', message: '注册失败，请稍后再试。' }
  }

  const again = await supabasePasswordGrant(email, password)
  if (!again.ok) {
    return { ok: false, error: 'auth_failed', message: '注册成功但登录失败，请重试。' }
  }

  return {
    ok: true,
    created: true,
    userId: again.userId || created.userId,
    email,
    inviteCode: inviteCheck.code,
  }
}

function publicDrink(drink) {
  return {
    id: drink.id,
    drinkName: drink.drinkName,
    bartender: drink.bartender,
    date: drink.date,
    mode: drink.mode,
    completionRate: drink.completionRate,
    timeAccuracy: drink.timeAccuracy,
    recipe: drink.recipe || [],
    vessel: drink.vessel || 'highball',
    stars: drink.report?.score?.stars || 0,
    user: drink.user,
    savedAt: drink.savedAt,
  }
}

function sameDay(a, b) {
  return String(a || '').slice(0, 10) === String(b || '').slice(0, 10)
}

function sameWeek(dateText, now = new Date()) {
  const date = new Date(dateText)
  if (Number.isNaN(date.getTime())) return false
  const start = new Date(now)
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return date >= start && date < end
}

function periodFilter(period, now = new Date()) {
  const today = now.toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const year = today.slice(0, 4)
  if (period === 'year') return (drink) => String(drink.date || '').startsWith(year)
  if (period === 'month') return (drink) => String(drink.date || '').startsWith(month)
  if (period === 'week') return (drink) => sameWeek(drink.date, now)
  return (drink) => sameDay(drink.date, today)
}

function aggregateReport(drinks = [], period = 'day') {
  const count = drinks.length
  const avg = (key) => (count ? drinks.reduce((sum, drink) => sum + Number(drink[key] || 0), 0) / count : 0)
  const stars = count ? drinks.reduce((sum, drink) => sum + Number(drink.report?.score?.stars || 0), 0) / count : 0
  const categoryTime = new Map()
  for (const drink of drinks) {
    for (const item of drink.recipe || []) {
      const current = categoryTime.get(item.category) || { name: item.name, minutes: 0, color: item.color }
      current.minutes += item.minutes || item.estimatedTime || 0
      categoryTime.set(item.category, current)
    }
  }
  return {
    period,
    count,
    completionRate: Math.round(avg('completionRate') * 100),
    timeAccuracy: Math.round(avg('timeAccuracy') * 100),
    stars: Math.round(stars * 10) / 10,
    flavors: [...categoryTime.values()]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6),
    latest: drinks.slice(0, 5).map(publicDrink),
  }
}

function aggregateStats(db) {
  const users = Object.values(db.users || {})
  const locationMap = new Map()
  const events = db.events || []
  const eventMap = new Map()
  for (const user of users) {
    const label = user.locationLabel || '远方'
    locationMap.set(label, (locationMap.get(label) || 0) + 1)
  }
  for (const event of events) {
    const key = event.type || 'click'
    eventMap.set(key, (eventMap.get(key) || 0) + 1)
  }
  return {
    usersCount: users.length,
    drinksCount: db.drinks.length,
    sharesCount: db.shares.length,
    eventsCount: events.length,
    eventTypes: [...eventMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    activeLocations: [...locationMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    latestUsers: users
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, 6)
      .map((user) => ({
        id: user.id,
        name: user.name,
        gender: user.gender,
        locationLabel: user.locationLabel,
        updatedAt: user.updatedAt,
      })),
  }
}

function monthKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 7)
}

function aggregateOps(db) {
  const users = Object.values(db.users || {})
  const drinks = db.drinks || []
  const events = db.events || []
  const currentMonth = monthKey()
  const monthlyDrinks = drinks.filter((drink) => String(drink.date || drink.savedAt || '').startsWith(currentMonth))
  const monthlyEvents = events.filter((event) => String(event.createdAt || '').startsWith(currentMonth))
  const taskRows = drinks.flatMap((drink) =>
    (drink.report?.records || drink.records || []).map((record) => ({
      drinkId: drink.id,
      drinkName: drink.drinkName,
      date: drink.date,
      status: record.status,
      taskType: record.taskType,
      actualTime: record.actualTime || 0,
      estimatedTime: record.estimatedTime || 0,
    })),
  )
  const monthlyTasks = taskRows.filter((item) => String(item.date || '').startsWith(currentMonth))
  const completed = monthlyTasks.filter((item) => item.status === 'completed').length
  const eventByDay = new Map()
  for (const event of monthlyEvents) {
    const day = String(event.createdAt || '').slice(8, 10) || '??'
    eventByDay.set(day, (eventByDay.get(day) || 0) + 1)
  }
  return {
    month: currentMonth,
    stats: aggregateStats(db),
    monthly: {
      drinks: monthlyDrinks.length,
      events: monthlyEvents.length,
      tasks: monthlyTasks.length,
      completed,
      completionRate: monthlyTasks.length ? Math.round((completed / monthlyTasks.length) * 100) : 0,
      activeDays: eventByDay.size,
      eventByDay: [...eventByDay.entries()].map(([day, count]) => ({ day, count })),
    },
    latestEvents: events.slice(0, 24),
    latestSchedules: taskRows.slice(0, 36),
    latestUsers: users
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, 12)
      .map(publicUser),
    latestDrinks: drinks.slice(0, 12).map(publicDrink),
  }
}

async function proxySeedance(body = {}) {
  const apiKey = process.env.SEEDANCE_API_KEY || process.env.ARK_API_KEY || ''
  const apiUrl = process.env.SEEDANCE_API_URL || ''
  if (!apiKey || !apiUrl) {
    return {
      mode: 'css-fallback',
      status: 'fallback',
      message: 'Seedance API is not configured. Set SEEDANCE_API_KEY and SEEDANCE_API_URL on the local API server.',
    }
  }

  const prompt = String(body.prompt || '').slice(0, 2000)
  const payload = {
    model: process.env.SEEDANCE_MODEL || body.model || 'seedance-1-0-lite',
    prompt,
    duration: body.duration || 4,
    resolution: body.resolution || '720p',
    aspect_ratio: body.aspectRatio || '1:1',
    reference_image: body.referenceImage || body.image || undefined,
    metadata: {
      scene: body.scene || 'life-kitchen-pet-motion',
      mode: body.mode || 'daily',
    },
  }

  const upstream = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await upstream.json().catch(() => ({}))
  return { mode: 'seedance', ok: upstream.ok, status: upstream.status, data }
}

function startPetProcess() {
  if (petProcess && !petProcess.killed) {
    return { started: false, alreadyRunning: true }
  }
  petProcess = spawn('npm', ['run', 'pet'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  })
  petProcess.unref()
  return { started: true, alreadyRunning: false }
}

function requireStorage(res) {
  if (!hasSupabase()) {
    sendJson(res, 503, {
      error: 'supabase_not_configured',
      message: '数据库未配置，请设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。',
    })
    return false
  }
  return true
}

export async function handleApiRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }

  const url = new URL(req.url, 'http://life-kitchen.local')
  if (!url.pathname.startsWith('/api')) return false

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        name: 'Life Kitchen Cellar',
        storage: hasSupabase() ? 'supabase' : 'unconfigured',
        gemini: hasGemini() ? 'configured' : 'unconfigured',
      })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/llm/status') {
      const { model } = getGeminiConfig()
      sendJson(res, 200, {
        enabled: hasGemini(),
        provider: hasGemini() ? 'gemini' : null,
        model: hasGemini() ? model : null,
      })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/llm/parse-todos') {
      if (!hasGemini()) {
        sendJson(res, 503, {
          error: 'gemini_not_configured',
          message: 'Gemini 未配置，请设置服务端 GEMINI_API_KEY。',
        })
        return true
      }
      const body = await readBody(req)
      const text = String(body.text || '').trim()
      if (!text) {
        sendJson(res, 400, { error: 'missing_text', message: '请先说点今天想做的事。' })
        return true
      }
      try {
        const result = await geminiParseTodos(text)
        sendJson(res, 200, { ...result, source: 'gemini' })
      } catch (error) {
        sendJson(res, error.status || 502, {
          error: 'gemini_failed',
          message: error.message || 'Gemini 调用失败',
        })
      }
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/llm/suggest-bartender') {
      if (!hasGemini()) {
        sendJson(res, 503, {
          error: 'gemini_not_configured',
          message: 'Gemini 未配置，请设置服务端 GEMINI_API_KEY。',
        })
        return true
      }
      const body = await readBody(req)
      const text = String(body.text || '').trim()
      if (!text) {
        sendJson(res, 400, { error: 'missing_text', message: '请先描述今天想怎么被管理。' })
        return true
      }
      try {
        const result = await geminiSuggestBartender(text)
        sendJson(res, 200, { ...result, source: 'gemini' })
      } catch (error) {
        sendJson(res, error.status || 502, {
          error: 'gemini_failed',
          message: error.message || 'Gemini 调用失败',
        })
      }
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/send-code') {
      sendJson(res, 410, {
        error: 'deprecated',
        message: '手机验证码登录已停用，请使用邮箱密码登录。',
      })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/invites') {
      if (!canManageInvites(req)) {
        sendJson(res, 401, { error: 'unauthorized', message: '需要掌柜密钥。' })
        return true
      }
      if (!requireStorage(res)) return true
      const invites = await listInvites()
      sendJson(
        res,
        200,
        {
          invites: invites.map((invite) => ({
            code: invite.code,
            label: invite.label,
            theme: invite.theme || 'zhongzhong',
            maxUses: invite.maxUses || 1,
            used: (invite.usedBy || []).length,
            createdAt: invite.createdAt || '',
          })),
        },
      )
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/invites/generate') {
      if (!canManageInvites(req)) {
        sendJson(res, 401, { error: 'unauthorized', message: '需要掌柜密钥。' })
        return true
      }
      if (!requireStorage(res)) return true
      const body = await readBody(req)
      const count = Math.max(1, Math.min(50, Number(body.count || 1)))
      const invites = []
      for (let i = 0; i < count; i += 1) {
        invites.push(await createInvite(body))
      }
      sendJson(res, 200, { ok: true, invites })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      if (!requireStorage(res)) return true
      const body = await readBody(req)
      const email = normalizeEmail(body.email)
      const password = String(body.password || '')

      if (!validateEmail(email)) {
        sendJson(res, 400, { error: 'email_invalid', message: '邮箱不太对。' })
        return true
      }
      if (!validatePassword(password)) {
        sendJson(res, 400, { error: 'password_invalid', message: '密码至少 6 位。' })
        return true
      }

      const auth = await emailPasswordAuth(email, password, body.inviteCode)
      if (!auth.ok) {
        const status = auth.error === 'supabase_not_configured' ? 503 : 401
        if (auth.error === 'missing_invite' || auth.error === 'invalid_invite' || auth.error === 'invite_full') {
          sendJson(res, 403, { error: auth.error, message: auth.message })
          return true
        }
        sendJson(res, status, { error: auth.error || 'auth_failed', message: auth.message || '登录失败。' })
        return true
      }

      const existing = (await findUserByEmail(email)) || (auth.userId ? await findUserById(auth.userId) : null)
      const user = normalizeUser({
        ...(existing || {}),
        ...(body.profile || {}),
        id: existing?.id || auth.userId,
        email,
        inviteCode: auth.created ? auth.inviteCode || body.inviteCode || '' : existing?.inviteCode || '',
      })
      await upsertUser(user)
      if (auth.created && auth.inviteCode) {
        await markInviteUsed(auth.inviteCode, user.id)
      }

      const token = createId('session')
      await createSession(user.id, token, Date.now() + 1000 * 60 * 60 * 24 * 30)
      sendJson(res, 200, { token, user: publicUser(user), created: Boolean(auth.created) })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/me') {
      if (!requireStorage(res)) return true
      const user = await requireAuthenticatedUser(req, res)
      if (!user) return true
      sendJson(res, 200, { user: publicUser(user) })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/users') {
      if (!requireStorage(res)) return true
      const authenticatedUser = await requireAuthenticatedUser(req, res)
      if (!authenticatedUser) return true
      const body = await readBody(req)
      const profile = body.user || body
      const user = normalizeUser({
        ...authenticatedUser,
        ...profile,
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        inviteCode: authenticatedUser.inviteCode,
      })
      const saved = await upsertUser(user)
      if (profile.habitSummary || profile.preferences || profile.avoidances) {
        await saveHabitsFromProfile(saved, {
          habitSummary: profile.habitSummary,
          preferences: profile.preferences,
          avoidances: profile.avoidances,
        })
      }
      sendJson(res, 200, { user: publicUser(saved) })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/habits') {
      if (!requireStorage(res)) return true
      const user = await requireAuthenticatedUser(req, res)
      if (!user) return true
      const habit = await findHabitsByUserId(user.id)
      sendJson(res, 200, { habit })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/habits') {
      if (!requireStorage(res)) return true
      const authenticatedUser = await requireAuthenticatedUser(req, res)
      if (!authenticatedUser) return true
      const body = await readBody(req)
      const user = normalizeUser(authenticatedUser)
      const habit = await saveHabitsFromProfile(user, body.profile || body)
      sendJson(res, 200, { habit })
      return true
    }

    if (req.method === 'DELETE' && url.pathname === '/api/habits') {
      if (!requireStorage(res)) return true
      const user = await requireAuthenticatedUser(req, res)
      if (!user) return true
      await clearUserMemories(user.id)
      sendJson(res, 200, { ok: true })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/memories') {
      if (!requireStorage(res)) return true
      const user = await requireAuthenticatedUser(req, res)
      if (!user) return true
      const limit = Math.min(60, Number(url.searchParams.get('limit') || 30))
      const memories = await listMemories(user.id, limit)
      sendJson(res, 200, { memories })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/memories') {
      if (!requireStorage(res)) return true
      const authenticatedUser = await requireAuthenticatedUser(req, res)
      if (!authenticatedUser) return true
      const body = await readBody(req)
      const user = normalizeUser(authenticatedUser)
      const card = body.card || body.reviewCard
      if (!card) {
        sendJson(res, 400, { error: 'missing review card' })
        return true
      }
      const result = await persistReviewMemory(user, body.profile || user, card)
      sendJson(res, 200, result)
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/cellar') {
      if (!requireStorage(res)) return true
      const userId = url.searchParams.get('userId')
      const drinks = await listDrinks(userId)
      sendJson(res, 200, { drinks: drinks.map(publicDrink) })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/stats') {
      if (!requireStorage(res)) return true
      const db = await loadDbSnapshot()
      sendJson(res, 200, { stats: aggregateStats(db) })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/ops') {
      if (!requireStorage(res)) return true
      const db = await loadDbSnapshot()
      sendJson(res, 200, { ops: aggregateOps(db) })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/events') {
      if (!requireStorage(res)) return true
      const body = await readBody(req)
      const event = await createEvent({
        id: createId('event'),
        type: String(body.type || 'click').slice(0, 48),
        label: String(body.label || '').slice(0, 120),
        page: String(body.page || '').slice(0, 80),
        userId: body.userId || body.user?.id || '',
      })
      sendJson(res, 200, { event })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/friends') {
      if (!requireStorage(res)) return true
      const body = await readBody(req)
      const user = normalizeUser(body.user || { id: body.userId })
      const friend = normalizeUser(body.friend || { id: body.friendId, name: body.friendName })
      const friendships = await addFriendship(user, friend)
      sendJson(res, 200, { friends: friendships })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/friends') {
      if (!requireStorage(res)) return true
      const userId = url.searchParams.get('userId')
      const db = await loadDbSnapshot()
      const links = db.friendships.filter((item) => item.userId === userId || item.friendId === userId)
      const friends = links.map((item) => {
        const id = item.userId === userId ? item.friendId : item.userId
        const drinks = db.drinks.filter((drink) => drink.userId === id)
        return {
          ...(db.users[id] || { id, name: '好友' }),
          drinksCount: drinks.length,
          latestDrink: drinks[0] ? publicDrink(drinks[0]) : null,
        }
      })
      sendJson(res, 200, { friends })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/cellar') {
      if (!requireStorage(res)) return true
      const authenticatedUser = await requireAuthenticatedUser(req, res)
      if (!authenticatedUser) return true
      const body = await readBody(req)
      const user = normalizeUser(authenticatedUser)
      const card = body.card || {}
      if (!card.drinkName) {
        sendJson(res, 400, { error: 'missing drink card' })
        return true
      }
      const saved = await saveDrink(user, card)
      let memory = null
      let habit = null
      try {
        const persisted = await persistReviewMemory(user, body.profile || user, card)
        habit = persisted.habit
        memory = persisted.memory
      } catch {
        // cellar save should still succeed if memory persistence fails
      }
      sendJson(res, 200, { drink: publicDrink(saved), habit, memory })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/shares') {
      if (!requireStorage(res)) return true
      const body = await readBody(req)
      const share = await createShare({
        id: createId('share'),
        userId: body.userId || body.user?.id || null,
        drinkId: body.drinkId,
        visibility: body.visibility || 'friends',
      })
      sendJson(res, 200, { share })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      if (!requireStorage(res)) return true
      const userId = url.searchParams.get('userId')
      const period = url.searchParams.get('period') || 'day'
      const filter = periodFilter(period)
      const drinks = await listDrinksForReport(userId, filter)
      drinks.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      sendJson(res, 200, { report: aggregateReport(drinks, period) })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/pet/start') {
      const result = startPetProcess()
      sendJson(res, 200, { ok: true, ...result })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/seedance/generate') {
      const body = await readBody(req)
      const result = await proxySeedance(body)
      sendJson(res, result.ok === false ? 502 : 200, result)
      return true
    }

    sendJson(res, 404, { error: 'not found' })
    return true
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'server error' })
    return true
  }
}

export default async function handler(req, res) {
  return handleApiRequest(req, res)
}
