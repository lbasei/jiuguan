// 纯函数：调酒师层 + 今日特调规划。
// 输入待办+调酒师策略，输出排序后的执行顺序、特调名、风险提醒、点评。

import { formatDuration } from './time.js'

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }
const isDeep = (t) => t.taskType === 'deep_work' || t.taskType === 'creative'
const isFragment = (t) => t.taskType === 'admin' || t.taskType === 'communication'

// —— 五种调酒师排序策略 ——
const STRATEGIES = {
  // 迷迭香：高优先级深度任务前置，碎片后置，复盘收尾
  deep_first(todos) {
    return [...todos].sort((a, b) => {
      const da = isDeep(a) ? 0 : 1
      const db = isDeep(b) ? 0 : 1
      if (da !== db) return da - db
      if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority])
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      return rankTail(a) - rankTail(b)
    })
  },
  // 姜味：先放一个最短任务点火，再按深度优先
  ignite_first(todos) {
    const rest = [...todos]
    rest.sort((a, b) => a.estimatedTime - b.estimatedTime)
    const igniter = rest.shift()
    const ordered = STRATEGIES.deep_first(rest)
    return igniter ? [igniter, ...ordered] : ordered
  },
  // 薄荷：深度优先，但每个高强度任务后插入恢复任务做缓冲
  recovery_buffer(todos) {
    const recoveries = todos.filter((t) => t.taskType === 'recovery')
    const others = STRATEGIES.deep_first(todos.filter((t) => t.taskType !== 'recovery'))
    const out = []
    let r = 0
    others.forEach((t, i) => {
      out.push(t)
      if (t.energyCost === 'high' && r < recoveries.length) out.push(recoveries[r++])
    })
    while (r < recoveries.length) out.push(recoveries[r++])
    return out
  },
  // 蒜香：深度块前置且连续，admin/communication 合并成一坨后置
  batch_admin(todos) {
    const deep = STRATEGIES.deep_first(todos.filter((t) => !isFragment(t) && t.taskType !== 'review' && t.taskType !== 'recovery'))
    const fragments = todos.filter(isFragment)
    const tail = todos.filter((t) => t.taskType === 'review' || t.taskType === 'recovery')
    return [...deep, ...fragments, ...tail]
  },
  // 香菜：从低压力（低优先级/低精力）任务进入
  light_first(todos) {
    return [...todos].sort((a, b) => {
      const ea = a.energyCost === 'low' ? 0 : a.energyCost === 'medium' ? 1 : 2
      const eb = b.energyCost === 'low' ? 0 : b.energyCost === 'medium' ? 1 : 2
      if (ea !== eb) return ea - eb
      return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    })
  },
}

// 收尾排序：recovery、review 永远靠后
function rankTail(t) {
  if (t.taskType === 'review') return 3
  if (t.taskType === 'recovery') return 2
  if (isFragment(t)) return 1
  return 0
}

export function orderTodos(todos, strategy) {
  const fn = STRATEGIES[strategy] || STRATEGIES.deep_first
  return fn(todos)
}

// —— 今日特调命名 ——
const NAME_PREFIX = {
  deep_work: '深焙', creative: '果香', communication: '气泡',
  admin: '小料', recovery: '奶霜', urgent: '辛姜', review: '肉桂',
}
const NAME_SUFFIX = {
  deep_work: '冷萃', creative: '特调', communication: '苏打',
  admin: '拿铁', recovery: '轻乳茶', urgent: '浓缩', review: '收口茶',
}

export function nameDrink(recipe) {
  const top = recipe.slice(0, 2)
  if (top.length === 0) return '空杯'
  const a = NAME_PREFIX[top[0].category] || '今日'
  const b = NAME_SUFFIX[(top[1] || top[0]).category] || '特调'
  return `${a}${b}`
}

// —— 小精灵优化建议（只讲任务，不剧透原料/茶底，保留揭晓惊喜）——
// 在优化阶段用这个，而不是 judgeRecipe（后者会点名"茶底/奶泡"=剧透）。
export function adviseManagement(todos, bartender) {
  const total = todos.reduce((s, t) => s + (t.estimatedTime || 0), 0) || 1
  const share = (pred) => todos.filter(pred).reduce((s, t) => s + t.estimatedTime, 0) / total
  const deep = share((t) => t.taskType === 'deep_work' || t.taskType === 'creative')
  const admin = share((t) => t.taskType === 'admin' || t.taskType === 'communication')
  const recovery = share((t) => t.taskType === 'recovery')
  const urgent = share((t) => t.taskType === 'urgent')

  const tips = []
  if (admin >= 0.35 && deep <= 0.25)
    tips.push('今日酒单里细碎委托太多，主炉火不够旺。把零散纸条先收进同一只托盘，等钟声响起时一口气处理。')
  if (recovery < 0.08) tips.push('酒馆长廊里少了一盏回神灯。请在高塔任务之后留一小段月光缓冲，让种种把魔力重新续上。')
  if (urgent >= 0.3) tips.push('急件像火焰符咒一样堆在吧台上。先挑最烫手的一两张封印，别把整座酒馆都点燃。')
  if (deep >= 0.4 && recovery < 0.12)
    tips.push('高塔里的专注咒语排得很密。每完成一段长咒，都让种种替你合上魔法书，喘一口气再开下一页。')
  if (!tips.length) tips.push('今日酒单的酸甜与火候很稳。照着种种排好的杯序走，城堡钟楼会替你守住节奏。')

  return {
    tips,
    comment: `${bartender.name} 为你写下今日酒单：${tips[0]}`,
  }
}

// —— 碎片时间建议：给桌宠用的轻量推荐 ——
// 基于排序后的执行顺序和已完成记录，推荐一条可以在间隙处理的碎片任务。
// 只返回用户输入的任务标题，不剧透原料/茶底/特调名。
export function suggestFragment(order, records, _now = new Date()) {
  if (!order || order.length === 0) return null
  const pending = order.filter((t) => {
    const st = records?.[t.id]?.status
    return st !== 'completed' && st !== 'skipped'
  })
  if (pending.length === 0) return null
  const next = pending[0]
  const fragments = pending.filter(isFragment)
  if (fragments.length === 0) return null

  // 下一项本身就是碎片任务，直接推荐顺手做掉
  if (isFragment(next)) {
    return {
      text: `下一件「${next.title}」只要 ${formatDuration(next.estimatedTime)}，顺手做了吧`,
      taskId: next.id,
    }
  }

  // 下一项是深度任务，推荐在它之前插一条碎片任务
  const t = fragments[0]
  return {
    text: `做「${next.title}」前，可以插一段「${t.title}」（${formatDuration(t.estimatedTime)}）`,
    taskId: t.id,
  }
}

// —— Agent 判断：基于配方比例给风险提醒和点评（揭晓阶段用，会点名原料）——
export function judgeRecipe(recipe, bartender) {
  const get = (c) => recipe.find((r) => r.category === c)?.ratio || 0
  const deep = get('deep_work') + get('creative')
  const admin = get('admin')
  const recovery = get('recovery')
  const urgent = get('urgent')
  const warnings = []
  if (admin >= 0.35 && deep <= 0.25)
    warnings.push('琐事小料偏多、深度茶底不足，今天容易变成"碎料奶茶"。')
  if (recovery < 0.08)
    warnings.push('恢复奶泡偏少，休息被压缩了，整杯偏浓。')
  if (urgent >= 0.3)
    warnings.push('姜汁浓缩液过量，全天冲刺会透支精力。')
  if (deep >= 0.4 && recovery < 0.12)
    warnings.push('深度浓度高，建议高强度任务后留一段缓冲。')

  const comment = warnings.length
    ? `${bartender.name}：${warnings[0]}`
    : `${bartender.name}：主茶底稳，结构均衡，今天这杯调得不错。`
  return { warnings, comment, metrics: { deep, admin, recovery, urgent } }
}
