// 七类基础原料定义。category 是 taskType 的产物，name 是展示用调酒语言。
// 视觉 token 用 emoji + 主色，第一版够用，后续替换为像素原料瓶。

export const INGREDIENTS = {
  deep_work: {
    category: 'deep_work',
    name: '深度茶底',
    emoji: '🍵',
    color: '#7EDFD8',
    method: 'slow_brew', // 慢萃
    desc: '深度工作与核心任务',
  },
  creative: {
    category: 'creative',
    name: '创意糖浆',
    emoji: '🍯',
    color: '#FFD978',
    method: 'ferment', // 发酵
    desc: '创作、构思与表达',
  },
  communication: {
    category: 'communication',
    name: '沟通气泡',
    emoji: '🫧',
    color: '#9DD3FF',
    method: 'aerate', // 打气
    desc: '会议、讨论与消息流',
  },
  admin: {
    category: 'admin',
    name: '琐事小料',
    emoji: '🧂',
    color: '#F8B1D4',
    method: 'quick_mix', // 速调
    desc: '碎片任务与杂事',
  },
  recovery: {
    category: 'recovery',
    name: '恢复奶泡',
    emoji: '🥛',
    color: '#FFF3B8',
    method: 'whip', // 打发
    desc: '休息、运动与状态恢复',
  },
  urgent: {
    category: 'urgent',
    name: '姜汁浓缩液',
    emoji: '🫚',
    color: '#FF9FBD',
    method: 'shot', // 浓缩
    desc: '紧急、截止与冲刺',
  },
  review: {
    category: 'review',
    name: '肉桂封口',
    emoji: '🍂',
    color: '#9BE8B6',
    method: 'seal', // 收束
    desc: '复盘与收束',
  },
}

export const TASK_TYPES = Object.values(INGREDIENTS).map((i) => ({
  value: i.category,
  label: `${i.emoji} ${i.name}`,
  desc: i.desc,
}))

export const ENERGY_LEVELS = [
  { value: 'low', label: '低', concentration: '淡' },
  { value: 'medium', label: '中', concentration: '适中' },
  { value: 'high', label: '高', concentration: '浓' },
]

export const EMOTION_LEVELS = [
  { value: 'low', label: '轻', flavor: '清爽' },
  { value: 'medium', label: '中', flavor: '复合' },
  { value: 'high', label: '重', flavor: '浓烈' },
]
