// 纯函数：进化层。把 EvoMap 经验匹配到当前配方，并模拟吸收后的进化。

import { EVOMAP_EXPERIENCES } from '../data/evomap.js'
import { judgeRecipe } from './plan.js'

// 哪些经验适用于当前配方/待办
export function matchExperiences(recipe, todos) {
  const get = (c) => recipe.find((r) => r.category === c)?.ratio || 0
  const deep = get('deep_work') + get('creative')
  const admin = get('admin')
  const recovery = get('recovery')
  const hasHighEmotion = todos.some((t) => t.emotionalLoad === 'high')
  const hasDeepHigh = todos.some(
    (t) => (t.taskType === 'deep_work' || t.taskType === 'creative') && t.priority === 'high',
  )

  return EVOMAP_EXPERIENCES.filter((exp) => {
    if (exp.condition === 'deep_high') return hasDeepHigh || deep < 0.3
    if (exp.condition === 'low_recovery') return recovery < 0.12 || hasHighEmotion
    if (exp.condition === 'admin_heavy') return admin >= 0.3
    return false
  })
}

// 吸收一条经验：改变调酒师策略、微调配方比例，产出进化后的配方。
// 比例调整是"建议目标配方"——把经验的方向可视化出来，真实时间占比仍由原料层决定。
export function applyExperience(exp, recipe, bartender) {
  const next = recipe.map((r) => ({ ...r }))
  const bump = (cat, delta) => {
    const r = next.find((x) => x.category === cat)
    if (r) r.ratio = Math.max(0, r.ratio + delta)
  }
  if (exp.apply === 'deep_first') {
    bump('deep_work', 0.12)
    bump('admin', -0.08)
    bump('communication', -0.04)
  } else if (exp.apply === 'recovery_buffer') {
    bump('recovery', 0.12)
    bump('deep_work', -0.06)
    bump('urgent', -0.06)
  } else if (exp.apply === 'batch_admin') {
    bump('admin', -0.05)
    bump('deep_work', 0.05)
  }
  // 归一化
  const sum = next.reduce((s, r) => s + r.ratio, 0) || 1
  next.forEach((r) => (r.ratio = +(r.ratio / sum).toFixed(4)))
  next.sort((a, b) => b.ratio - a.ratio)

  // 进化推荐：若当前调酒师不在推荐里，建议切到推荐的第一位
  const recommended = exp.recommendBartenders.includes(bartender.id)
    ? bartender.id
    : exp.recommendBartenders[0]

  return {
    recipe: next,
    newStrategy: exp.apply, // 排序策略随经验进化
    recommendedBartenderId: recommended,
    judge: judgeRecipe(next, bartender),
  }
}
