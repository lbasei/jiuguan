/** Adventure / 展会深链：统一从环境变量拼 collection URL，换域名只改 env。 */

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
  return {
    collectBaseUrl: trimSlash(env.VITE_COLLECT_BASE_URL) || DEFAULTS.collectBaseUrl,
    campaign: String(env.VITE_ADVENTURE_CAMPAIGN || DEFAULTS.campaign).trim() || DEFAULTS.campaign,
    tavernBaseUrl: trimSlash(env.VITE_TAVERN_BASE_URL),
  }
}

/**
 * @param {string} templateSlug
 * @param {{ source?: string, campaign?: string }} [options]
 */
export function buildCollectPath(templateSlug, { source = 'booth', campaign = DEFAULTS.campaign } = {}) {
  const params = new URLSearchParams({
    source: source || 'booth',
    campaign: campaign || DEFAULTS.campaign,
  })
  return `/collect/${encodeURIComponent(templateSlug)}?${params.toString()}`
}

/**
 * @param {string} templateSlug
 * @param {{ source?: string, campaign?: string }} [options]
 * @param {Record<string, string | undefined>} [env]
 */
export function buildCollectUrl(templateSlug, options = {}, env = {}) {
  const cfg = resolveCollectConfig(env)
  const campaign = options.campaign || cfg.campaign
  const source = options.source || 'booth'
  return `${cfg.collectBaseUrl}${buildCollectPath(templateSlug, { source, campaign })}`
}

/**
 * Adventure 壳页按钮（极简，不做真地图）。
 * @param {Record<string, string | undefined>} [env]
 */
export function getAdventureActions(env = {}) {
  const cfg = resolveCollectConfig(env)
  return [
    {
      id: 'profile',
      label: '领取探险委托',
      hint: '登记身份与今日目标',
      href: buildCollectUrl('adventurex-profile', { source: 'booth' }, env),
    },
    {
      id: 'menu',
      label: '今日酒单',
      hint: '写下今天想调的事',
      href: buildCollectUrl('today-menu', { source: 'booth' }, env),
    },
    {
      id: 'booth',
      label: '展位打卡',
      hint: '联名展位记录',
      href: buildCollectUrl('booth-record', { source: 'partner' }, env),
    },
  ].map((item) => ({ ...item, campaign: cfg.campaign }))
}
