// Pure functions: rhythm habit updates + order tweaks (no bartender tone changes).

const TAG_ENERGY_MORNING = '上午更清醒'
const TAG_AFTERNOON_BUFFER = '午后需要缓冲'
const TAG_STARTS_SLOW = '开始前会拖一下'
const TAG_WANTS_RECORD = '完成后想被记录'
const TAG_CHECKLIST = '适合边做边勾'
const TAG_DRINK_WATER = '需要提醒喝水'

function parseTags(text = '') {
  return String(text || '')
    .split(/[、,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function emptyRhythmProfile() {
  return {
    energyPattern: 'unknown',
    estimationBias: 'unknown',
    commonDelayTypes: [],
    blockerKeywords: [],
    lowEnergyStrategy: 'unknown',
    morningDeepWorkBoost: false,
    afternoonBuffer: false,
    needsIgniteStart: false,
    wantsCompletionRecord: false,
    prefersChecklist: false,
    needsHydrationReminder: false,
  }
}

function emptyStats() {
  return {
    completedSessions: 0,
    avgTimeAccuracy: 0,
    overrunRate: 0,
    underrunRate: 0,
    commonHeaviestCategory: '',
    lastMemoryDate: '',
  }
}

export function buildRhythmProfileFromProfileInput({ habitSummary = '', preferences = '', avoidances = '' } = {}) {
  const tags = [
    ...parseTags(habitSummary),
    ...parseTags(preferences),
    ...parseTags(avoidances),
  ]
  const profile = emptyRhythmProfile()
  if (tags.includes(TAG_ENERGY_MORNING) || /上午|早上|清晨/.test(habitSummary)) {
    profile.energyPattern = 'high_morning_low_evening'
    profile.morningDeepWorkBoost = true
  }
  if (tags.includes(TAG_AFTERNOON_BUFFER) || /午后|下午|傍晚/.test(habitSummary)) {
    profile.afternoonBuffer = true
    profile.lowEnergyStrategy = 'split_tasks'
  }
  if (tags.includes(TAG_STARTS_SLOW) || /拖|启动|开火/.test(habitSummary)) {
    profile.needsIgniteStart = true
    profile.commonDelayTypes = ['deep_work']
  }
  if (tags.includes(TAG_WANTS_RECORD)) profile.wantsCompletionRecord = true
  if (tags.includes(TAG_CHECKLIST)) profile.prefersChecklist = true
  if (tags.includes(TAG_DRINK_WATER)) profile.needsHydrationReminder = true
  if (/低估|超时|加时|余量/.test(`${preferences}${avoidances}`)) {
    profile.estimationBias = 'underestimate'
  }
  return profile
}

export function mergeRhythmFromReview(existing = {}, reviewCard = {}) {
  const report = reviewCard.report || {}
  const records = reviewCard.records || []
  const completed = records.filter((r) => r.status === 'completed')
  const timed = completed.filter((r) => r.actualTime && r.estimatedTime)
  const overrun = timed.filter((r) => r.actualTime > r.estimatedTime * 1.2)
  const underrun = timed.filter((r) => r.actualTime < r.estimatedTime * 0.75)
  const next = { ...emptyRhythmProfile(), ...existing }

  if (overrun.length >= underrun.length && overrun.length > 0) {
    next.estimationBias = 'underestimate'
  } else if (underrun.length > overrun.length) {
    next.estimationBias = 'overestimate'
  }

  const heaviestType = report.doneSummary?.[0]?.type || reviewCard.recipe?.[0]?.category || ''
  if (heaviestType) {
    next.commonDelayTypes = [...new Set([heaviestType, ...(next.commonDelayTypes || [])])].slice(0, 3)
  }

  if ((report.missing || []).some((item) => String(item).includes('恢复'))) {
    next.afternoonBuffer = true
    next.lowEnergyStrategy = 'add_recovery_buffer'
  }

  const habitMemory = report.habitMemory || {}
  for (const chip of habitMemory.chips || []) {
    if (String(chip).includes('加时')) next.estimationBias = 'underestimate'
    if (String(chip).includes('补缓冲')) {
      next.afternoonBuffer = true
      next.lowEnergyStrategy = 'add_recovery_buffer'
    }
    if (String(chip).includes('优先')) next.morningDeepWorkBoost = true
  }

  return next
}

export function mergeStatsFromReview(existing = {}, reviewCard = {}) {
  const report = reviewCard.report || {}
  const records = reviewCard.records || []
  const completed = records.filter((r) => r.status === 'completed')
  const timed = completed.filter((r) => r.actualTime && r.estimatedTime)
  const overrun = timed.filter((r) => r.actualTime > r.estimatedTime * 1.2)
  const underrun = timed.filter((r) => r.actualTime < r.estimatedTime * 0.75)
  const sessions = Number(existing.completedSessions || 0) + (completed.length ? 1 : 0)
  const prevAccuracy = Number(existing.avgTimeAccuracy || 0)
  const nextAccuracy = Number(reviewCard.timeAccuracy || 0)
  const avgTimeAccuracy = sessions <= 1
    ? nextAccuracy
    : +(((prevAccuracy * (sessions - 1)) + nextAccuracy) / sessions).toFixed(2)

  return {
    completedSessions: sessions,
    avgTimeAccuracy,
    overrunRate: timed.length ? +(overrun.length / timed.length).toFixed(2) : Number(existing.overrunRate || 0),
    underrunRate: timed.length ? +(underrun.length / timed.length).toFixed(2) : Number(existing.underrunRate || 0),
    commonHeaviestCategory: reviewCard.recipe?.[0]?.category || existing.commonHeaviestCategory || '',
    lastMemoryDate: reviewCard.date || existing.lastMemoryDate || '',
  }
}

export function buildDailyMemoryPayload(reviewCard = {}) {
  const report = reviewCard.report || {}
  return {
    drinkName: reviewCard.drinkName || '',
    date: reviewCard.date || '',
    completionRate: reviewCard.completionRate || 0,
    timeAccuracy: reviewCard.timeAccuracy || 0,
    habitMemory: report.habitMemory || null,
    memoryLine: report.memory || reviewCard.comment || '',
    agentEvolution: report.agentEvolution || null,
    timeTuning: report.timeTuning || [],
    nextPlan: report.nextPlan || [],
    doneSummary: report.doneSummary || [],
  }
}

export function buildDailyMemorySummary(reviewCard = {}) {
  const report = reviewCard.report || {}
  const memoryLine = report.memory || reviewCard.comment || ''
  const chips = report.habitMemory?.chips || []
  if (memoryLine) return memoryLine
  if (chips.length) return chips.join('、')
  return `完成率 ${Math.round((reviewCard.completionRate || 0) * 100)}%`
}

export function buildHabitRowFromInput(userId, input = {}, reviewCard = null) {
  const rhythmFromProfile = buildRhythmProfileFromProfileInput(input)
  const existingRhythm = input.rhythmProfile || input.rhythm_profile || {}
  const existingStats = input.stats || {}
  let rhythmProfile = { ...rhythmFromProfile, ...existingRhythm }
  let stats = { ...emptyStats(), ...existingStats }

  if (reviewCard) {
    rhythmProfile = mergeRhythmFromReview(rhythmProfile, reviewCard)
    stats = mergeStatsFromReview(stats, reviewCard)
  }

  return {
    userId,
    priorityFocus: 'rhythm',
    habitSummary: String(input.habitSummary || '').slice(0, 120),
    preferences: String(input.preferences || '').slice(0, 80),
    avoidances: String(input.avoidances || '').slice(0, 80),
    rhythmProfile,
    stats,
    sourceTags: parseTags(input.habitSummary),
    updatedAt: new Date().toISOString(),
  }
}

const isDeep = (t) => t.taskType === 'deep_work' || t.taskType === 'creative'
const isRecovery = (t) => t.taskType === 'recovery'

export function applyRhythmToOrder(todos, order, rhythmProfile = {}) {
  if (!order?.length) return order || []
  let next = [...order]

  if (rhythmProfile.needsIgniteStart) {
    const pending = next.filter((t) => !isRecovery(t))
    if (pending.length > 1) {
      const shortest = [...pending].sort((a, b) => (a.estimatedTime || 0) - (b.estimatedTime || 0))[0]
      next = [shortest, ...next.filter((t) => t.id !== shortest.id)]
    }
  }

  if (rhythmProfile.morningDeepWorkBoost) {
    const deep = next.filter(isDeep)
    const rest = next.filter((t) => !isDeep(t))
    next = [...deep, ...rest]
  }

  if (rhythmProfile.afternoonBuffer || rhythmProfile.lowEnergyStrategy === 'add_recovery_buffer') {
    const recoveries = next.filter(isRecovery)
    const others = next.filter((t) => !isRecovery(t))
    const out = []
    let r = 0
    others.forEach((task) => {
      out.push(task)
      if (task.energyCost === 'high' && r < recoveries.length) {
        out.push(recoveries[r])
        r += 1
      }
    })
    while (r < recoveries.length) {
      out.push(recoveries[r])
      r += 1
    }
    next = out
  }

  const seen = new Set()
  return next.filter((task) => {
    if (seen.has(task.id)) return false
    seen.add(task.id)
    return true
  })
}

export function buildRhythmAdvisoryTips(rhythmProfile = {}, stats = {}) {
  const tips = []
  if (rhythmProfile.estimationBias === 'underestimate' || Number(stats.overrunRate || 0) >= 0.4) {
    tips.push('你最近常低估用时，今天排程我会默认多留一点缓冲。')
  }
  if (rhythmProfile.morningDeepWorkBoost) {
    tips.push('你上午状态更好，深度任务会尽量往前放。')
  }
  if (rhythmProfile.afternoonBuffer) {
    tips.push('午后需要缓冲，高强度任务后我会帮你插休息。')
  }
  if (rhythmProfile.needsIgniteStart) {
    tips.push('你适合先做一个短任务点火，再进入主线。')
  }
  return tips.slice(0, 2)
}
