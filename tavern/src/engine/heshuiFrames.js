/** Catalog helpers for 种种「喝水」sequence frames under animation/heshui/. */

export const HESHUI_CHARACTER_IDS = ['chili', 'ginger', 'mint', 'lemon', 'garlic']

/**
 * Turn Vite `import.meta.glob` results into ordered frame URL lists per character.
 * @param {Record<string, string | { default?: string }>} modules
 * @returns {Record<string, string[]>}
 */
export function buildHeshuiCatalog(modules = {}) {
  const buckets = Object.create(null)

  for (const [path, mod] of Object.entries(modules)) {
    const match = path.match(/heshui\/([^/]+)\/[^/]+_(\d+)\.(?:png|jpe?g|webp)$/i)
    if (!match) continue
    const characterId = match[1]
    const index = Number(match[2])
    if (!Number.isFinite(index)) continue
    const url = typeof mod === 'string' ? mod : mod?.default
    if (!url) continue
    if (!buckets[characterId]) buckets[characterId] = []
    buckets[characterId].push({ index, url })
  }

  const catalog = Object.create(null)
  for (const [characterId, frames] of Object.entries(buckets)) {
    catalog[characterId] = frames
      .sort((a, b) => a.index - b.index)
      .map((frame) => frame.url)
  }
  return catalog
}

export function getHeshuiFrames(catalog, characterId) {
  if (!characterId || !catalog) return []
  return catalog[characterId] || []
}

export function hasHeshuiFrames(catalog, characterId) {
  return getHeshuiFrames(catalog, characterId).length > 0
}

/** Play drink animation only for recovery tasks when frames exist. */
export function shouldPlayHeshui(taskType, characterId, catalog) {
  return taskType === 'recovery' && hasHeshuiFrames(catalog, characterId)
}
