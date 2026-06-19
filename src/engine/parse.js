// 纯函数：把一段自然语言拆成结构化 Todo 列表（规则版）。
// 这是 LLM 解析的兜底实现，零网络依赖、100% 离线稳定。

import { TYPE_KEYWORDS, PRIORITY_KEYWORDS, MUST_KEYWORDS, DEFAULT_TIME } from '../data/keywords.js'

// 按标点和连接词把一段话切成短句
function splitClauses(text) {
  return text
    .replace(/\n/g, '，')
    .split(/[，,。；;、]|还要|还有|然后|另外|以及|顺便|最好/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}

function detectType(clause) {
  const lower = clause.toLowerCase()
  for (const [type, words] of Object.entries(TYPE_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return type
  }
  return 'admin' // 兜底归为琐事小料
}

function detectPriority(clause) {
  if (PRIORITY_KEYWORDS.high.some((w) => clause.includes(w))) return 'high'
  if (PRIORITY_KEYWORDS.low.some((w) => clause.includes(w))) return 'low'
  return 'medium'
}

// 从短句里抽出"X分钟/半小时/一小时"这类时间信息
function detectTime(clause, type) {
  const m = clause.match(/(\d+)\s*(分钟|min)/)
  if (m) return parseInt(m[1], 10)
  if (clause.includes('半小时')) return 30
  const h = clause.match(/(\d+)\s*(小时|h)/)
  if (h) return parseInt(h[1], 10) * 60
  return DEFAULT_TIME[type] || 30
}

function detectEnergy(type) {
  if (type === 'deep_work' || type === 'urgent') return 'high'
  if (type === 'admin' || type === 'recovery' || type === 'review') return 'low'
  return 'medium'
}

function detectEmotion(clause, type) {
  if (clause.includes('累') || clause.includes('烦') || clause.includes('焦虑')) return 'high'
  if (type === 'communication' || type === 'urgent') return 'medium'
  return 'low'
}

export function parseTodos(text) {
  const clauses = splitClauses(text)
  return clauses.map((title, i) => {
    const taskType = detectType(title)
    return {
      id: `todo_${Date.now()}_${i}`,
      title: title.replace(/^(我|今天|想|要|得|还|得要)+/, '').trim() || title,
      estimatedTime: detectTime(title, taskType),
      taskType,
      energyCost: detectEnergy(taskType),
      emotionalLoad: detectEmotion(title, taskType),
      priority: detectPriority(title),
      mustDo: MUST_KEYWORDS.some((w) => title.includes(w)) || detectPriority(title) === 'high',
      status: 'pending',
    }
  })
}
