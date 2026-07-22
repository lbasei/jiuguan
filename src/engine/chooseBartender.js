// 「帮我选种种」：自然语言推荐 + 解锁过滤 + 随机兜底。

export function listAvailableBartenders(bartenders = [], visitDays = 1) {
  return (Array.isArray(bartenders) ? bartenders : []).filter(
    (b) => b && !b.placeholder && (!b.unlockDays || visitDays >= b.unlockDays),
  )
}

export function resolveChosenBartenderId({ suggestedId, available = [], currentId = '' } = {}) {
  const list = Array.isArray(available) ? available.filter(Boolean) : []
  if (!list.length) return ''

  if (suggestedId && list.some((b) => b.id === suggestedId)) return suggestedId

  if (list.length === 1) return list[0].id

  const currentIndex = list.findIndex((b) => b.id === currentId)
  const start = currentIndex >= 0 ? currentIndex : 0
  const offset = 1 + Math.floor(Math.random() * (list.length - 1))
  return list[(start + offset) % list.length].id
}

export async function chooseBartenderFromMood({
  text,
  available = [],
  currentId = '',
  suggest,
} = {}) {
  const trimmed = String(text || '').trim()
  const list = Array.isArray(available) ? available : []

  if (!trimmed) {
    return {
      id: resolveChosenBartenderId({ suggestedId: null, available: list, currentId }),
      source: 'random',
      note: '没说具体状态，先替你换一只试试。',
    }
  }

  if (typeof suggest !== 'function') {
    return {
      id: resolveChosenBartenderId({ suggestedId: null, available: list, currentId }),
      source: 'random',
      note: '推荐暂时不可用，先替你换一只试试。',
    }
  }

  try {
    const result = await suggest(trimmed)
    const id = resolveChosenBartenderId({
      suggestedId: result?.id,
      available: list,
      currentId,
    })
    return {
      id,
      source: result?.source || 'gemini',
      note: String(result?.note || '').slice(0, 40),
    }
  } catch {
    return {
      id: resolveChosenBartenderId({ suggestedId: null, available: list, currentId }),
      source: 'random',
      note: '推荐暂时不可用，先替你换一只试试。',
    }
  }
}
