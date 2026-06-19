// LLM 入口层。把"自然语言 → 结构化数据"的能力收口在这里。
// 当前接 DeepSeek（OpenAI 兼容）；有 key 时走真模型，否则静默降级规则解析。
// UI 永远只调这两个 async 函数，不关心底层是 LLM 还是规则。

import { parseTodos } from './parse.js'
import { BARTENDERS } from '../data/bartenders.js'

// 兼容旧变量名 VITE_ANTHROPIC_API_KEY，优先用新的 VITE_LLM_API_KEY
const API_KEY = import.meta.env.VITE_LLM_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY
const MODEL = import.meta.env.VITE_LLM_MODEL || 'deepseek-v4-flash'
// dev 走 Vite 代理 /deepseek 绕 CORS；可用 VITE_LLM_BASE_URL 覆盖
const BASE = import.meta.env.VITE_LLM_BASE_URL || '/deepseek'
const ENDPOINT = `${BASE}/chat/completions`

export const llmEnabled = () => Boolean(API_KEY)

// OpenAI 兼容的 chat/completions 调用（DeepSeek）
async function callLLM({ system, user, maxTokens = 1500 }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`LLM ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// 从模型返回里抠出第一个 JSON（容忍 ```json 包裹和前后废话）
function extractJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fence ? fence[1] : text
  const start = raw.search(/[[{]/)
  if (start === -1) throw new Error('no json')
  return JSON.parse(raw.slice(start))
}

const TYPE_ENUM = ['deep_work', 'creative', 'communication', 'admin', 'recovery', 'urgent', 'review']

// 模块九：自然语言倾倒 → Todo 列表
export async function parseTodosSmart(text) {
  if (!API_KEY) return { todos: parseTodos(text), source: 'rule' }
  try {
    const system = `你是 Life Kitchen 的调酒师，把用户一段混乱的自然语言拆成结构化待办。
只输出 JSON 数组，每个元素字段：
- title: 简短任务名（保留用户原话语气，不要改写润色）
- estimatedTime: 预计分钟数（整数，没说就按类型给经验值）
- taskType: 七选一 ${TYPE_ENUM.join('/')}
- energyCost: low/medium/high（精力消耗）
- emotionalLoad: low/medium/high（情绪负担）
- priority: low/medium/high
- mustDo: true/false（是否必须做）
类型含义：deep_work深度工作 creative创作 communication沟通会议 admin琐事杂务 recovery休息恢复 urgent紧急截止 review复盘。
只输出 JSON，不要解释。`
    const out = await callLLM({ system, user: text })
    const arr = extractJSON(out)
    const todos = arr.map((t, i) => ({
      id: `todo_${Date.now()}_${i}`,
      title: t.title || '未命名',
      estimatedTime: Number(t.estimatedTime) || 30,
      taskType: TYPE_ENUM.includes(t.taskType) ? t.taskType : 'admin',
      energyCost: t.energyCost || 'medium',
      emotionalLoad: t.emotionalLoad || 'low',
      priority: t.priority || 'medium',
      mustDo: Boolean(t.mustDo),
      status: 'pending',
    }))
    return { todos, source: 'llm' }
  } catch (e) {
    // 任何失败都兜回规则解析，绝不让 demo 卡住
    console.warn('[llm] parse fallback:', e.message)
    return { todos: parseTodos(text), source: 'rule-fallback' }
  }
}

// 规则版：从用户状态描述里挑最贴近的预设调酒师
function suggestBartenderRule(text) {
  if (/(累|疲|焦虑|低落|没精神|emo)/.test(text)) return 'mint'
  if (/(拖|不想开始|卡住|启动|懒)/.test(text)) return 'ginger'
  if (/(打断|消息|分心|专注)/.test(text)) return 'garlic'
  if (/(随便|宽松|别管|自由|抗拒)/.test(text)) return 'cilantro'
  return 'rosemary'
}

// 模块十一：自然语言 → 推荐/生成调酒师种种
export async function suggestBartenderSmart(text) {
  if (!API_KEY) return { id: suggestBartenderRule(text), source: 'rule', note: '' }
  try {
    const ids = BARTENDERS.map((b) => `${b.id}(${b.name}/${b.style})`).join('、')
    const system = `用户描述今天想被怎么管理。从这五位调酒师种种里选最合适的一位，并给一句温柔的理由。
候选：${ids}。
只输出 JSON：{"id":"...","note":"一句中文理由，20字内"}。只输出 JSON。`
    const out = await callLLM({ system, user: text, maxTokens: 300 })
    const obj = extractJSON(out)
    const id = BARTENDERS.some((b) => b.id === obj.id) ? obj.id : suggestBartenderRule(text)
    return { id, source: 'llm', note: obj.note || '' }
  } catch (e) {
    console.warn('[llm] bartender fallback:', e.message)
    return { id: suggestBartenderRule(text), source: 'rule-fallback', note: '' }
  }
}
