// 纯函数：日度复盘。根据执行记录生成"今日特调卡"。

import { nameDrink } from './plan.js'

// records: [{ todoId, status: completed|delayed|skipped, actualTime, estimatedTime, taskType }]
export function buildReviewCard({ date, todos, ingredients, recipe, bartender, drinkName, records }) {
  const total = todos.length || 1
  const done = records.filter((r) => r.status === 'completed').length
  const completionRate = +(done / total).toFixed(2)

  // 时间准确度：实际 vs 预计的接近程度（仅对有实际用时的任务）
  const timed = records.filter((r) => r.actualTime && r.estimatedTime)
  let timeAccuracy = 1
  if (timed.length) {
    const errs = timed.map((r) => Math.abs(r.actualTime - r.estimatedTime) / r.estimatedTime)
    const avgErr = errs.reduce((s, e) => s + e, 0) / errs.length
    timeAccuracy = +Math.max(0, 1 - avgErr).toFixed(2)
  }

  // 完成状态回写口感：未完成/延迟的类别 → 缺失或过浓
  const missing = []
  const recovered = new Set(records.filter((r) => r.status === 'completed').map((r) => r.taskType))
  if (!recovered.has('recovery')) missing.push('恢复奶泡')
  if (!recovered.has('review')) missing.push('肉桂封口')

  const heaviest = recipe[0]
  const overrun = timed.filter((r) => r.actualTime > r.estimatedTime * 1.2)

  let comment = `${bartender.name}：今天完成率 ${Math.round(completionRate * 100)}%。`
  if (overrun.length) comment += `有任务实际用时明显超预期，${heaviest?.name || '主茶底'}偏浓。`
  if (missing.length) comment += `缺了${missing.join('、')}，整杯偏紧。`
  if (!overrun.length && !missing.length) comment += '结构匀称，是杯耐喝的特调。'

  const suggestion = overrun.length
    ? '明天类似深度任务建议多预留 20% 时间。'
    : missing.includes('恢复奶泡')
    ? '明天在高强度任务后固定加一段恢复缓冲。'
    : '保持今天的节奏，注意复盘收口。'

  return {
    date,
    drinkName: drinkName || nameDrink(recipe),
    bartender: bartender.name,
    bartenderEmoji: bartender.emoji,
    completionRate,
    timeAccuracy,
    recipe,
    heaviest: heaviest?.name || '—',
    missing: missing.length ? missing.join('、') : '无',
    comment,
    suggestion,
  }
}
