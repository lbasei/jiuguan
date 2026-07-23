import { randomUUID } from 'node:crypto'
import { getServiceClient } from './supabase.mjs'
import {
  buildDailyMemoryPayload,
  buildDailyMemorySummary,
  buildHabitRowFromInput,
} from './memory.mjs'

function rowToUser(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name || row.name,
    gender: row.gender || 'neutral',
    locationLabel: row.location_label || '远方',
    coords: row.coords || null,
    email: row.email || '',
    inviteCode: row.invite_code || '',
    updatedAt: row.updated_at,
  }
}

function userToRow(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    display_name: user.displayName || user.name,
    gender: user.gender || 'neutral',
    location_label: user.locationLabel || '远方',
    coords: user.coords || null,
    invite_code: user.inviteCode || null,
    updated_at: user.updatedAt || new Date().toISOString(),
  }
}

function rowToDrink(row) {
  const card = row.card || {}
  return {
    ...card,
    id: row.id,
    userId: row.user_id,
    drinkName: card.drinkName || row.drink_name,
    date: card.date || row.drink_date,
    savedAt: row.saved_at,
  }
}

function rowToFriendship(row) {
  return {
    id: row.id,
    userId: row.user_id,
    friendId: row.friend_id,
    createdAt: row.created_at,
  }
}

function rowToShare(row) {
  return {
    id: row.id,
    userId: row.user_id,
    drinkId: row.drink_id,
    visibility: row.visibility,
    createdAt: row.created_at,
  }
}

function rowToEvent(row) {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    page: row.page,
    userId: row.user_id || '',
    createdAt: row.created_at,
  }
}

function rowToInvite(row) {
  if (!row) return null
  return {
    code: row.code,
    label: row.label,
    theme: row.theme || 'zhongzhong',
    maxUses: row.max_uses || 1,
    usedBy: row.used_by || [],
    createdAt: row.created_at,
  }
}

function rowToSession(row) {
  return {
    token: row.token,
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: new Date(row.expires_at).getTime(),
  }
}

export async function loadDbSnapshot() {
  const supabase = getServiceClient()
  const [usersRes, drinksRes, friendshipsRes, sharesRes, eventsRes, invitesRes, sessionsRes] =
    await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('drinks').select('*').order('saved_at', { ascending: false }).limit(500),
      supabase.from('friendships').select('*').order('created_at', { ascending: false }),
      supabase.from('shares').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('events').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('invite_codes').select('*'),
      supabase.from('sessions').select('*'),
    ])

  for (const res of [usersRes, drinksRes, friendshipsRes, sharesRes, eventsRes, invitesRes, sessionsRes]) {
    if (res.error) throw new Error(res.error.message)
  }

  const users = {}
  for (const row of usersRes.data || []) {
    users[row.id] = rowToUser(row)
  }

  const inviteCodes = {}
  for (const row of invitesRes.data || []) {
    inviteCodes[row.code] = rowToInvite(row)
  }

  const sessions = {}
  for (const row of sessionsRes.data || []) {
    sessions[row.token] = rowToSession(row)
  }

  return {
    users,
    drinks: (drinksRes.data || []).map(rowToDrink),
    friendships: (friendshipsRes.data || []).map(rowToFriendship),
    shares: (sharesRes.data || []).map(rowToShare),
    events: (eventsRes.data || []).map(rowToEvent),
    inviteCodes,
    sessions,
  }
}

export async function findUserByEmail(email) {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle()
  if (error) throw new Error(error.message)
  return rowToUser(data)
}

export async function findUserById(id) {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return rowToUser(data)
}

export async function upsertUser(user) {
  const supabase = getServiceClient()
  const row = userToRow(user)
  const { data, error } = await supabase.from('users').upsert(row).select('*').single()
  if (error) throw new Error(error.message)
  return rowToUser(data)
}

export async function createSession(userId, token, expiresAtMs) {
  const supabase = getServiceClient()
  const expiresAt = new Date(expiresAtMs).toISOString()
  const { error } = await supabase.from('sessions').insert({
    token,
    user_id: userId,
    expires_at: expiresAt,
  })
  if (error) throw new Error(error.message)
  return { token, userId, expiresAt: expiresAtMs }
}

export async function getSession(token) {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('sessions').select('*').eq('token', token).maybeSingle()
  if (error) throw new Error(error.message)
  return rowToSession(data)
}

export async function listInvites() {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('invite_codes').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(rowToInvite)
}

export async function getInvite(code) {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('invite_codes').select('*').eq('code', code).maybeSingle()
  if (error) throw new Error(error.message)
  return rowToInvite(data)
}

export async function createInviteRow(invite) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('invite_codes')
    .insert({
      code: invite.code,
      label: invite.label,
      theme: invite.theme,
      max_uses: invite.maxUses,
      used_by: [],
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToInvite(data)
}

export async function markInviteUsed(code, userId) {
  const invite = await getInvite(code)
  if (!invite) return
  const usedBy = [...new Set([...(invite.usedBy || []), userId])]
  const supabase = getServiceClient()
  const { error } = await supabase.from('invite_codes').update({ used_by: usedBy }).eq('code', code)
  if (error) throw new Error(error.message)
}

export async function listDrinks(userId) {
  const supabase = getServiceClient()
  let query = supabase.from('drinks').select('*').order('saved_at', { ascending: false }).limit(60)
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []).map(rowToDrink)
}

export async function saveDrink(user, card) {
  const supabase = getServiceClient()
  await upsertUser(user)
  const id = `${user.id}-${card.date || new Date().toISOString().slice(0, 10)}-${card.drinkName}`
  const savedAt = new Date().toISOString()
  const payload = {
    ...card,
    id,
    userId: user.id,
    user,
    savedAt,
  }
  const { data, error } = await supabase
    .from('drinks')
    .upsert({
      id,
      user_id: user.id,
      drink_name: card.drinkName,
      drink_date: card.date || null,
      card: payload,
      saved_at: savedAt,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToDrink(data)
}

export async function listFriendshipsForUser(userId) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
  if (error) throw new Error(error.message)
  return (data || []).map(rowToFriendship)
}

export async function addFriendship(user, friend) {
  const supabase = getServiceClient()
  await upsertUser(user)
  await upsertUser(friend)

  const { data: existing, error: findError } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${user.id})`,
    )
    .limit(1)
  if (findError) throw new Error(findError.message)

  if (!existing?.length) {
    const { error } = await supabase.from('friendships').insert({
      id: `friend-${randomUUID()}`,
      user_id: user.id,
      friend_id: friend.id,
    })
    if (error) throw new Error(error.message)
  }

  return listFriendshipsForUser(user.id)
}

export async function createShare(share) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('shares')
    .insert({
      id: share.id,
      user_id: share.userId,
      drink_id: share.drinkId,
      visibility: share.visibility,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToShare(data)
}

export async function createEvent(event) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('events')
    .insert({
      id: event.id,
      type: event.type,
      label: event.label,
      page: event.page,
      user_id: event.userId || null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToEvent(data)
}

export async function listDrinksForReport(userId, periodFilterFn) {
  const supabase = getServiceClient()
  let query = supabase.from('drinks').select('*').order('drink_date', { ascending: false })
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []).map(rowToDrink).filter(periodFilterFn)
}

function rowToHabit(row) {
  if (!row) return null
  return {
    userId: row.user_id,
    priorityFocus: row.priority_focus || 'rhythm',
    habitSummary: row.habit_summary || '',
    preferences: row.preferences || '',
    avoidances: row.avoidances || '',
    rhythmProfile: row.rhythm_profile || {},
    stats: row.stats || {},
    sourceTags: row.source_tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function habitToRow(habit) {
  return {
    user_id: habit.userId,
    priority_focus: habit.priorityFocus || 'rhythm',
    habit_summary: habit.habitSummary || '',
    preferences: habit.preferences || '',
    avoidances: habit.avoidances || '',
    rhythm_profile: habit.rhythmProfile || {},
    stats: habit.stats || {},
    source_tags: habit.sourceTags || [],
    updated_at: habit.updatedAt || new Date().toISOString(),
  }
}

function rowToMemory(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    memoryDate: row.memory_date,
    memoryType: row.memory_type,
    summary: row.summary || '',
    payload: row.payload || {},
    createdAt: row.created_at,
  }
}

export async function findHabitsByUserId(userId) {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('user_habits').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return rowToHabit(data)
}

export async function upsertHabits(habit) {
  const supabase = getServiceClient()
  const row = habitToRow(habit)
  const { data, error } = await supabase.from('user_habits').upsert(row).select('*').single()
  if (error) throw new Error(error.message)
  return rowToHabit(data)
}

export async function saveHabitsFromProfile(user, profileInput = {}, reviewCard = null) {
  if (!user?.id) throw new Error('user id required')
  await upsertUser(user)
  const existing = await findHabitsByUserId(user.id)
  const habit = buildHabitRowFromInput(user.id, {
    habitSummary: profileInput.habitSummary ?? existing?.habitSummary ?? '',
    preferences: profileInput.preferences ?? existing?.preferences ?? '',
    avoidances: profileInput.avoidances ?? existing?.avoidances ?? '',
    rhythmProfile: existing?.rhythmProfile,
    stats: existing?.stats,
  }, reviewCard)
  return upsertHabits(habit)
}

export async function saveDailyMemory(user, reviewCard) {
  if (!user?.id) throw new Error('user id required')
  const memoryDate = reviewCard.date || new Date().toISOString().slice(0, 10)
  const id = `memory-${user.id}-${memoryDate}`
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('agent_memories')
    .upsert({
      id,
      user_id: user.id,
      memory_date: memoryDate,
      memory_type: 'daily_review',
      summary: buildDailyMemorySummary(reviewCard),
      payload: buildDailyMemoryPayload(reviewCard),
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToMemory(data)
}

export async function listMemories(userId, limit = 30) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('agent_memories')
    .select('*')
    .eq('user_id', userId)
    .order('memory_date', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data || []).map(rowToMemory)
}

export async function clearUserMemories(userId) {
  const supabase = getServiceClient()
  const { error: memoryError } = await supabase.from('agent_memories').delete().eq('user_id', userId)
  if (memoryError) throw new Error(memoryError.message)
  const { error: habitError } = await supabase.from('user_habits').delete().eq('user_id', userId)
  if (habitError) throw new Error(habitError.message)
  return { ok: true }
}

export async function persistReviewMemory(user, profileInput, reviewCard) {
  const habit = await saveHabitsFromProfile(user, profileInput, reviewCard)
  const memory = await saveDailyMemory(user, reviewCard)
  return { habit, memory }
}
