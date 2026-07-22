/** Adventure field journey deep links. Keep deployment URLs in environment variables. */

const DEFAULTS = {
  collectBaseUrl: 'http://localhost:3000',
  campaign: 'adventurex-2026',
}

function trimSlash(value = '') {
  return String(value || '').trim().replace(/\/+$/, '')
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveCollectConfig(env = {}) {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const configuredCollectBaseUrl = trimSlash(env.VITE_COLLECT_BASE_URL)
  const configuredTavernBaseUrl = trimSlash(env.VITE_TAVERN_BASE_URL)
  return {
    collectBaseUrl: configuredCollectBaseUrl === 'same-origin'
      ? browserOrigin || DEFAULTS.collectBaseUrl
      : configuredCollectBaseUrl || DEFAULTS.collectBaseUrl,
    campaign: String(env.VITE_ADVENTURE_CAMPAIGN || DEFAULTS.campaign).trim() || DEFAULTS.campaign,
    tavernBaseUrl: configuredTavernBaseUrl === 'same-origin'
      ? browserOrigin
      : configuredTavernBaseUrl || browserOrigin,
  }
}

/**
 * @param {string} templateSlug
 * @param {{ source?: string, campaign?: string, returnTo?: string }} [options]
 */
export function buildCollectPath(templateSlug, { source = 'booth', campaign = DEFAULTS.campaign, returnTo = '' } = {}) {
  const params = new URLSearchParams({
    source: source || 'booth',
    campaign: campaign || DEFAULTS.campaign,
  })
  if (trimSlash(returnTo)) params.set('return_to', trimSlash(returnTo))
  return `/collect/${encodeURIComponent(templateSlug)}?${params.toString()}`
}

/**
 * @param {string} templateSlug
 * @param {{ source?: string, campaign?: string, returnTo?: string }} [options]
 * @param {Record<string, string | undefined>} [env]
 */
export function buildCollectUrl(templateSlug, options = {}, env = {}) {
  const cfg = resolveCollectConfig(env)
  const campaign = options.campaign || cfg.campaign
  const source = options.source || 'booth'
  const returnTo = options.returnTo || cfg.tavernBaseUrl
  return `${cfg.collectBaseUrl}${buildCollectPath(templateSlug, { source, campaign, returnTo })}`
}

/**
 * The tavern owns the first screen. Data collection owns each persisted step.
 * The second link is a recovery route for visitors who already toured offline.
 * @param {Record<string, string | undefined>} [env]
 */
export function getAdventureActions(env = {}) {
  const cfg = resolveCollectConfig(env)
  return [
    {
      id: 'park',
      label: '进入联名游园',
      hint: '在数字地图中选择一个摊位、角色或地点',
      href: buildCollectUrl('tavern-park', { source: 'booth' }, env),
    },
    {
      id: 'promise',
      label: '直接前往承诺池',
      hint: '已经逛完现场时，可从这里留下承诺',
      href: buildCollectUrl('tavern-promise', { source: 'booth' }, env),
    },
  ].map((item) => ({ ...item, campaign: cfg.campaign }))
}

export function getTavernGuideUrl(env = {}) {
  return buildCollectUrl('tavern-guide', { source: 'booth' }, env)
}

export function getAdventurePartnersUrl(env = {}) {
  const cfg = resolveCollectConfig(env)
  const params = new URLSearchParams({ campaign: cfg.campaign })
  return `${cfg.collectBaseUrl}/api/adventure-partners?${params.toString()}`
}
