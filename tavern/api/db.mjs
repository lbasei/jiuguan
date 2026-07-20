import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto'

const DB_DIR = process.env.LIFE_KITCHEN_DB_DIR || (process.env.VERCEL ? '/tmp/life-kitchen-data' : path.resolve(process.cwd(), '.data'))
const DB_FILE = path.join(DB_DIR, 'life-kitchen-db.json')
let petProcess = null
const DEV_LOGIN_CODE = '123456'
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

const emptyDb = () => ({
  users: {},
  drinks: [],
  friendships: [],
  shares: [],
  events: [],
  verificationCodes: {},
  sessions: {},
  inviteCodes: {
    ZHONGZHONG: { code: 'ZHONGZHONG', label: '种种内测券', maxUses: 500, usedBy: [] },
    LIFE2026: { code: 'LIFE2026', label: 'Life Kitchen 邀请券', maxUses: 500, usedBy: [] },
  },
})

async function readDb() {
  try {
    const raw = await readFile(DB_FILE, 'utf8')
    const base = emptyDb()
    const saved = JSON.parse(raw)
    return {
      ...base,
      ...saved,
      users: { ...base.users, ...(saved.users || {}) },
      verificationCodes: { ...base.verificationCodes, ...(saved.verificationCodes || {}) },
      sessions: { ...base.sessions, ...(saved.sessions || {}) },
      inviteCodes: { ...base.inviteCodes, ...(saved.inviteCodes || {}) },
    }
  } catch {
    return emptyDb()
  }
}

async function writeDb(db) {
  await mkdir(DB_DIR, { recursive: true })
  await writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
}

function createId(prefix) {
  const random = randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${random}`
}

function normalizePhone(phone = '') {
  const clean = String(phone).trim().replace(/[^\d+]/g, '')
  if (clean.startsWith('+')) return clean.slice(0, 20)
  return clean.slice(0, 20)
}

function validatePhone(phone = '') {
  const normalized = normalizePhone(phone)
  const digits = normalized.replace(/\D/g, '')
  if (normalized.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15
  }
  if (digits.length === 11 && /^1[3-9]\d{9}$/.test(digits)) return true
  return digits.length >= 8 && digits.length <= 15
}

function hashCode(code = '') {
  return createHash('sha256').update(String(code)).digest('hex')
}

function hasSmsProvider() {
  return Boolean(
    (process.env.TENCENT_SECRET_ID &&
      process.env.TENCENT_SECRET_KEY &&
      process.env.TENCENT_SMS_SDK_APP_ID &&
      process.env.TENCENT_SMS_SIGN_NAME &&
      process.env.TENCENT_SMS_TEMPLATE_ID) ||
    (process.env.SMS_API_URL && process.env.SMS_API_KEY),
  )
}

function devLoginCode() {
  return DEV_LOGIN_CODE
}

function canUseDevLoginCode() {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL
}

function randomInviteCode(theme = 'zhongzhong') {
  const key = String(theme || 'zhongzhong').toLowerCase()
  const words = INVITE_THEMES[key] || INVITE_THEMES.zhongzhong
  const head = words[randomInt(0, words.length)]
  const tail = randomInt(1000, 9999)
  return `${head}${tail}`
}

function createInvite(db, input = {}) {
  const theme = String(input.theme || input.bartenderId || 'zhongzhong').toLowerCase()
  const maxUses = Math.max(1, Math.min(9999, Number(input.maxUses || 1)))
  const label = String(input.label || '种种请柬').trim().slice(0, 32) || '种种请柬'
  let code = String(input.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18)
  for (let i = 0; !code || db.inviteCodes?.[code]; i += 1) {
    code = randomInviteCode(theme)
    if (i > 20) code = `${randomInviteCode(theme)}${randomInt(10, 99)}`
  }
  const invite = {
    code,
    label,
    theme,
    maxUses,
    usedBy: [],
    createdAt: new Date().toISOString(),
  }
  db.inviteCodes = { ...(db.inviteCodes || {}), [code]: invite }
  return invite
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function publicUser(user = {}) {
  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName || user.name,
    gender: user.gender || 'neutral',
    locationLabel: user.locationLabel || '远方',
    coords: user.coords || null,
    phone: user.phone ? user.phone.replace(/(\d{3})\d+(\d{2})$/, '$1****$2') : '',
    inviteCode: user.inviteCode || '',
    updatedAt: user.updatedAt,
  }
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.end(JSON.stringify(data))
}

function canManageInvites(req) {
  const adminKey = process.env.INVITE_ADMIN_KEY || ''
  if (!adminKey && !process.env.VERCEL) return true
  const headerKey = req.headers['x-admin-key'] || ''
  const authKey = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  return Boolean(adminKey && (headerKey === adminKey || authKey === adminKey))
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
  const name = String(input.name || input.displayName || '').trim().slice(0, 24) || '无名旅人'
  const gender = ['male', 'female', 'neutral'].includes(input.gender) ? input.gender : 'neutral'
  const locationLabel = String(input.locationLabel || input.locationName || '').trim().slice(0, 36) || '远方'
  return {
    id,
    name,
    displayName: name,
    gender,
    locationLabel,
    coords: input.coords || null,
    phone: input.phone || '',
    inviteCode: input.inviteCode || '',
    updatedAt: new Date().toISOString(),
  }
}

function ensureInvite(db, inviteCode = '') {
  const code = String(inviteCode || '').trim().toUpperCase()
  if (!code) return { ok: false, error: 'missing_invite' }
  const invite = db.inviteCodes?.[code]
  if (!invite) return { ok: false, error: 'invalid_invite' }
  const usedBy = invite.usedBy || []
  if (invite.maxUses && usedBy.length >= invite.maxUses) return { ok: false, error: 'invite_full' }
  return { ok: true, code, invite }
}

function markInviteUsed(db, code, userId) {
  if (!code || !db.inviteCodes?.[code]) return
  const invite = db.inviteCodes[code]
  invite.usedBy = [...new Set([...(invite.usedBy || []), userId])]
}

async function sendSmsCode(phone, code) {
  if (process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY && process.env.TENCENT_SMS_SDK_APP_ID) {
    return sendTencentSmsCode(phone, code)
  }
  const smsUrl = process.env.SMS_API_URL || ''
  const smsKey = process.env.SMS_API_KEY || ''
  if (!smsUrl || !smsKey) {
    console.log(`[Life Kitchen dev sms] ${phone}: ${code}`)
    return { mode: 'dev-console' }
  }
  const upstream = await fetch(smsUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${smsKey}`,
    },
    body: JSON.stringify({
      phone,
      code,
      template: process.env.SMS_TEMPLATE || 'life-kitchen-login',
    }),
  })
  const data = await upstream.json().catch(async () => ({ message: await upstream.text().catch(() => '') }))
  return { mode: 'sms-provider', ok: upstream.ok, status: upstream.status, data }
}

async function sendTencentSmsCode(phone, code) {
  const required = [
    'TENCENT_SECRET_ID',
    'TENCENT_SECRET_KEY',
    'TENCENT_SMS_SDK_APP_ID',
    'TENCENT_SMS_SIGN_NAME',
    'TENCENT_SMS_TEMPLATE_ID',
  ]
  const missing = required.filter((key) => !process.env[key])
  if (missing.length) {
    return {
      mode: 'tencent-sms',
      ok: false,
      status: 'missing-config',
      data: { Response: { Error: { Message: `缺少短信配置：${missing.join(', ')}` } } },
    }
  }
  const host = 'sms.tencentcloudapi.com'
  const endpoint = `https://${host}`
  const service = 'sms'
  const action = 'SendSms'
  const version = '2021-01-11'
  const region = process.env.TENCENT_SMS_REGION || 'ap-guangzhou'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const normalizedPhone = phone.startsWith('+') ? phone : `+86${phone.replace(/\D/g, '')}`
  const payload = JSON.stringify({
    PhoneNumberSet: [normalizedPhone],
    SmsSdkAppId: process.env.TENCENT_SMS_SDK_APP_ID,
    SignName: process.env.TENCENT_SMS_SIGN_NAME,
    TemplateId: process.env.TENCENT_SMS_TEMPLATE_ID,
    TemplateParamSet: [code],
  })

  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256(payload),
  ].join('\n')
  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    timestamp,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n')
  const secretDate = hmac(`TC3${process.env.TENCENT_SECRET_KEY}`, date)
  const secretService = hmac(secretDate, service)
  const secretSigning = hmac(secretService, 'tc3_request')
  const signature = hmac(secretSigning, stringToSign, 'hex')
  const authorization = `TC3-HMAC-SHA256 Credential=${process.env.TENCENT_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      Host: host,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': version,
      'X-TC-Region': region,
    },
    body: payload,
  })
  const data = await upstream.json().catch(() => ({}))
  return {
    mode: 'tencent-sms',
    ok: upstream.ok && !data.Response?.Error,
    status: upstream.status,
    data,
  }
}

function findUserByPhone(db, phone) {
  return Object.values(db.users || {}).find((user) => user.phone === phone)
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

export async function handleApiRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }

  const url = new URL(req.url, 'http://life-kitchen.local')
  if (!url.pathname.startsWith('/api')) return false

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true, name: 'Life Kitchen Cellar' })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/invites') {
      if (!canManageInvites(req)) {
        sendJson(res, 401, { error: 'unauthorized', message: '需要掌柜密钥。' })
        return true
      }
      const db = await readDb()
      const invites = Object.values(db.inviteCodes || {}).map((invite) => ({
        code: invite.code,
        label: invite.label,
        theme: invite.theme || 'zhongzhong',
        maxUses: invite.maxUses || 1,
        used: (invite.usedBy || []).length,
        createdAt: invite.createdAt || '',
      }))
      sendJson(res, 200, { invites })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/invites/generate') {
      if (!canManageInvites(req)) {
        sendJson(res, 401, { error: 'unauthorized', message: '需要掌柜密钥。' })
        return true
      }
      const body = await readBody(req)
      const count = Math.max(1, Math.min(50, Number(body.count || 1)))
      const db = await readDb()
      const invites = []
      for (let i = 0; i < count; i += 1) {
        invites.push(createInvite(db, body))
      }
      await writeDb(db)
      sendJson(res, 200, { ok: true, invites })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/send-code') {
      const body = await readBody(req)
      const phone = normalizePhone(body.phone)
      const db = await readDb()
      const inviteCheck = ensureInvite(db, body.inviteCode)
      if (!validatePhone(phone)) {
        sendJson(res, 400, { error: 'phone_invalid', message: '手机号不太对。' })
        return true
      }
      if (!inviteCheck.ok) {
        sendJson(res, 403, { error: inviteCheck.error, message: '邀请码不对，先找酒馆掌柜要一张。' })
        return true
      }
      const usingSmsProvider = hasSmsProvider()
      if (!usingSmsProvider && !canUseDevLoginCode()) {
        sendJson(res, 503, {
          error: 'sms_not_configured',
          message: '短信登录暂未开放，请先使用现场体验入口。',
        })
        return true
      }
      const code = usingSmsProvider ? String(randomInt(100000, 999999)) : devLoginCode(phone)
      db.verificationCodes[phone] = {
        phone,
        codeHash: hashCode(code),
        inviteCode: inviteCheck.code,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0,
      }
      await writeDb(db)
      const sms = await sendSmsCode(phone, code)
      if (sms.ok === false) {
        sendJson(res, 502, {
          error: 'sms_failed',
          message: '短信没有发出去，请检查短信服务配置。',
          detail: sms.data?.Response?.Error?.Message || sms.status || '',
        })
        return true
      }
      sendJson(res, 200, {
        ok: true,
        expiresIn: 300,
        devCode: sms.mode === 'dev-console' ? code : undefined,
        provider: sms.mode,
        message: sms.mode === 'dev-console' ? '开发环境验证码已显示。' : '验证码已发送。',
      })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readBody(req)
      const phone = normalizePhone(body.phone)
      const code = String(body.code || '').trim()
      const db = await readDb()
      const inviteCheck = ensureInvite(db, body.inviteCode)
      const savedCode = db.verificationCodes[phone]
      if (!validatePhone(phone)) {
        sendJson(res, 400, { error: 'phone_invalid', message: '手机号不太对。' })
        return true
      }
      if (!inviteCheck.ok) {
        sendJson(res, 403, { error: inviteCheck.error, message: '邀请码不对。' })
        return true
      }
      if (!savedCode || savedCode.expiresAt < Date.now()) {
        const canUseDevCode = canUseDevLoginCode() && !hasSmsProvider() && code === devLoginCode(phone)
        if (!canUseDevCode) {
          sendJson(res, 400, { error: 'code_expired', message: '验证码过期了，再要一杯新的。' })
          return true
        }
      }
      if (savedCode && (savedCode.attempts >= 5 || savedCode.codeHash !== hashCode(code))) {
        savedCode.attempts = Number(savedCode.attempts || 0) + 1
        await writeDb(db)
        sendJson(res, 400, { error: 'code_invalid', message: '验证码不对。' })
        return true
      }
      const existing = findUserByPhone(db, phone)
      const user = normalizeUser({
        ...(existing || {}),
        ...(body.profile || {}),
        id: existing?.id || createId('user'),
        phone,
        inviteCode: inviteCheck.code,
      })
      db.users[user.id] = { ...(db.users[user.id] || {}), ...user }
      markInviteUsed(db, inviteCheck.code, user.id)
      delete db.verificationCodes[phone]
      const token = createId('session')
      db.sessions[token] = {
        token,
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
      }
      await writeDb(db)
      sendJson(res, 200, { token, user: publicUser(user) })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/me') {
      const db = await readDb()
      const auth = req.headers.authorization || ''
      const token = auth.replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || ''
      const session = db.sessions[token]
      if (!session || session.expiresAt < Date.now()) {
        sendJson(res, 401, { error: 'unauthorized' })
        return true
      }
      const user = db.users[session.userId]
      if (!user) {
        sendJson(res, 401, { error: 'user_missing' })
        return true
      }
      sendJson(res, 200, { user: publicUser(user) })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/users') {
      const body = await readBody(req)
      const db = await readDb()
      const user = normalizeUser(body.user || body)
      db.users[user.id] = { ...(db.users[user.id] || {}), ...user }
      await writeDb(db)
      sendJson(res, 200, { user: publicUser(user) })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/cellar') {
      const db = await readDb()
      const userId = url.searchParams.get('userId')
      const source = userId ? db.drinks.filter((drink) => drink.userId === userId) : db.drinks
      const drinks = source.slice(0, 60).map(publicDrink)
      sendJson(res, 200, { drinks })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/stats') {
      const db = await readDb()
      sendJson(res, 200, { stats: aggregateStats(db) })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/ops') {
      const db = await readDb()
      sendJson(res, 200, { ops: aggregateOps(db) })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/events') {
      const body = await readBody(req)
      const db = await readDb()
      const event = {
        id: createId('event'),
        type: String(body.type || 'click').slice(0, 48),
        label: String(body.label || '').slice(0, 120),
        page: String(body.page || '').slice(0, 80),
        userId: body.userId || body.user?.id || '',
        createdAt: new Date().toISOString(),
      }
      db.events = [event, ...(db.events || [])].slice(0, 1000)
      await writeDb(db)
      sendJson(res, 200, { event })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/friends') {
      const body = await readBody(req)
      const db = await readDb()
      const user = normalizeUser(body.user || { id: body.userId })
      const friend = normalizeUser(body.friend || { id: body.friendId, name: body.friendName })
      db.users[user.id] = { ...(db.users[user.id] || {}), ...user }
      db.users[friend.id] = { ...(db.users[friend.id] || {}), ...friend }
      const exists = db.friendships.some(
        (item) =>
          (item.userId === user.id && item.friendId === friend.id) ||
          (item.userId === friend.id && item.friendId === user.id),
      )
      if (!exists) {
        db.friendships.unshift({ id: createId('friend'), userId: user.id, friendId: friend.id, createdAt: new Date().toISOString() })
      }
      await writeDb(db)
      sendJson(res, 200, { friends: db.friendships.filter((item) => item.userId === user.id || item.friendId === user.id) })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/friends') {
      const db = await readDb()
      const userId = url.searchParams.get('userId')
      const links = db.friendships.filter((item) => item.userId === userId || item.friendId === userId)
      const friends = links.map((item) => {
        const id = item.userId === userId ? item.friendId : item.userId
        const drinks = db.drinks.filter((drink) => drink.userId === id)
        return { ...(db.users[id] || { id, name: '好友' }), drinksCount: drinks.length, latestDrink: drinks[0] ? publicDrink(drinks[0]) : null }
      })
      sendJson(res, 200, { friends })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/cellar') {
      const body = await readBody(req)
      const db = await readDb()
      const user = normalizeUser(body.user)
      const card = body.card || {}
      if (!card.drinkName) {
        sendJson(res, 400, { error: 'missing drink card' })
        return true
      }
      db.users[user.id] = { ...(db.users[user.id] || {}), ...user }
      const id = `${user.id}-${card.date || new Date().toISOString().slice(0, 10)}-${card.drinkName}`
      const saved = {
        ...card,
        id,
        userId: user.id,
        user,
        savedAt: new Date().toISOString(),
      }
      db.drinks = [saved, ...db.drinks.filter((item) => item.id !== id)].slice(0, 200)
      await writeDb(db)
      sendJson(res, 200, { drink: publicDrink(saved) })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/api/shares') {
      const body = await readBody(req)
      const db = await readDb()
      const share = {
        id: createId('share'),
        userId: body.userId || body.user?.id || 'guest',
        drinkId: body.drinkId,
        visibility: body.visibility || 'friends',
        createdAt: new Date().toISOString(),
      }
      db.shares.unshift(share)
      await writeDb(db)
      sendJson(res, 200, { share })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      const db = await readDb()
      const userId = url.searchParams.get('userId')
      const period = url.searchParams.get('period') || 'day'
      const filter = periodFilter(period)
      const drinks = db.drinks
        .filter((drink) => (!userId || drink.userId === userId) && filter(drink))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
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
