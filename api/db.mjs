import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const DB_DIR = path.resolve(process.cwd(), '.data')
const DB_FILE = path.join(DB_DIR, 'life-kitchen-db.json')
let petProcess = null

const emptyDb = () => ({
  users: {},
  drinks: [],
  friendships: [],
  shares: [],
})

async function readDb() {
  try {
    const raw = await readFile(DB_FILE, 'utf8')
    return { ...emptyDb(), ...JSON.parse(raw) }
  } catch {
    return emptyDb()
  }
}

async function writeDb(db) {
  await mkdir(DB_DIR, { recursive: true })
  await writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
}

function createId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${random}`
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.end(JSON.stringify(data))
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
    updatedAt: new Date().toISOString(),
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

    if (req.method === 'POST' && url.pathname === '/api/users') {
      const body = await readBody(req)
      const db = await readDb()
      const user = normalizeUser(body.user || body)
      db.users[user.id] = { ...(db.users[user.id] || {}), ...user }
      await writeDb(db)
      sendJson(res, 200, { user })
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
