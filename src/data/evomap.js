// 第一版内置 3 条 EvoMap 经验（管理配方池）。
// condition 由 engine/evolve.js 在初始配方上做匹配判断。

export const EVOMAP_EXPERIENCES = [
  {
    id: 'deep_work_first',
    name: '先浓后淡配方',
    pattern: '高认知任务多，容易被琐事打断',
    condition: 'deep_high', // 存在高优先级深度任务 / 深度占比偏低
    strategy: '将深度任务前置，碎片任务后置，最后加入恢复时间',
    recommendBartenders: ['rosemary', 'garlic'],
    effect: '提升核心任务完成率，降低切换损耗',
    confidence: 0.84,
    apply: 'deep_first',
  },
  {
    id: 'recovery_buffer',
    name: '恢复奶泡缓冲',
    pattern: '高情绪负担任务多，疲劳易放弃',
    condition: 'low_recovery', // 恢复奶泡不足 / 存在高情绪负担任务
    strategy: '在高压任务后加入恢复任务或短休息',
    recommendBartenders: ['mint'],
    effect: '降低疲劳感和放弃率',
    confidence: 0.79,
    apply: 'recovery_buffer',
  },
  {
    id: 'batch_admin',
    name: '碎料集中处理',
    pattern: '琐碎任务多，切换损耗大',
    condition: 'admin_heavy', // 琐事小料占比过高
    strategy: '将 admin / communication 集中安排',
    recommendBartenders: ['garlic'],
    effect: '减少切换损耗',
    confidence: 0.81,
    apply: 'batch_admin',
  },
]
