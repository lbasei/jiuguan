import { apiFetch } from './apiClient.js'

async function request(path, options = {}) {
  const res = await apiFetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.message || data.error || `Cellar API ${res.status}`)
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}

export async function saveUserProfile(user) {
  if (!user) return null
  const data = await request('/api/users', {
    method: 'POST',
    body: JSON.stringify({ user }),
  })
  return data.user
}

export async function fetchUserHabits(userId) {
  if (!userId) return null
  const data = await request(`/api/habits?userId=${encodeURIComponent(userId)}`)
  return data.habit
}

export async function saveReviewMemory(card, user, profile = {}) {
  if (!card || !user?.id) return null
  const data = await request('/api/memories', {
    method: 'POST',
    body: JSON.stringify({ card, user, profile }),
  })
  return data
}

export async function fetchUserMemories(userId, limit = 30) {
  if (!userId) return []
  const data = await request(`/api/memories?userId=${encodeURIComponent(userId)}&limit=${limit}`)
  return data.memories || []
}

export async function clearUserMemories(userId) {
  if (!userId) return null
  const data = await request(`/api/habits?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
  return data
}

export async function publishDrink(card, user) {
  if (!card) return null
  const data = await request('/api/cellar', {
    method: 'POST',
    body: JSON.stringify({
      card,
      user,
      profile: {
        habitSummary: user?.habitSummary,
        preferences: user?.preferences,
        avoidances: user?.avoidances,
      },
    }),
  })
  return data
}

export async function fetchPublicCellar() {
  const data = await request('/api/cellar')
  return data.drinks || []
}

export async function fetchUserCellar(userId) {
  if (!userId) return []
  const data = await request(`/api/cellar?userId=${encodeURIComponent(userId)}`)
  return data.drinks || []
}

export async function addFriend(user, friend) {
  const data = await request('/api/friends', {
    method: 'POST',
    body: JSON.stringify({ user, friend }),
  })
  return data.friends || []
}

export async function fetchFriends(userId) {
  if (!userId) return []
  const data = await request(`/api/friends?userId=${encodeURIComponent(userId)}`)
  return data.friends || []
}

export async function shareDrink(userId, drinkId, visibility = 'friends') {
  const data = await request('/api/shares', {
    method: 'POST',
    body: JSON.stringify({ userId, drinkId, visibility }),
  })
  return data.share
}

export async function fetchReviewReport(userId, period = 'day') {
  const params = new URLSearchParams()
  if (userId) params.set('userId', userId)
  params.set('period', period)
  const data = await request(`/api/reports?${params}`)
  return data.report
}

export async function fetchCellarStats() {
  const data = await request('/api/stats')
  return data.stats
}

export async function fetchOpsDashboard() {
  const data = await request('/api/ops')
  return data.ops
}

export async function recordEvent(event) {
  if (!event) return null
  const data = await request('/api/events', {
    method: 'POST',
    body: JSON.stringify(event),
  })
  return data.event
}

export async function generateInviteCodes({ theme = 'zhongzhong', count = 1, maxUses = 1, label = '种种请柬', adminKey = '' } = {}) {
  return request('/api/invites/generate', {
    method: 'POST',
    headers: adminKey ? { 'x-admin-key': adminKey } : {},
    body: JSON.stringify({ theme, count, maxUses, label }),
  })
}

export async function fetchInviteCodes(adminKey = '') {
  return request('/api/invites', {
    headers: adminKey ? { 'x-admin-key': adminKey } : {},
  })
}

export async function loginWithEmailPassword({ email, password, inviteCode, profile }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, inviteCode, profile }),
  })
}

export async function fetchCurrentUser(token) {
  if (!token) return null
  const data = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.user
}
