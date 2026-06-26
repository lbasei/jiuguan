async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Cellar API ${res.status}`)
  return res.json()
}

export async function saveUserProfile(user) {
  if (!user) return null
  const data = await request('/api/users', {
    method: 'POST',
    body: JSON.stringify({ user }),
  })
  return data.user
}

export async function publishDrink(card, user) {
  if (!card) return null
  const data = await request('/api/cellar', {
    method: 'POST',
    body: JSON.stringify({ card, user }),
  })
  return data.drink
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
