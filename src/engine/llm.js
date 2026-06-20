// LLM 入口层。把"自然语言 → 结构化数据"的能力收口在这里。
// 当前接 DeepSeek（OpenAI 兼容）；有 key 时走真模型，否则静默降级规则解析。
// UI 永远只调这两个 async 函数，不关心底层是 LLM 还是规则。

import { parseTodos } from './parse.js'
import { BARTENDERS } from '../data/bartenders.js'
import { EVOMAP_EXPERIENCES } from '../data/evomap.js'

// 兼容旧变量名 VITE_ANTHROPIC_API_KEY，优先用新的 VITE_LLM_API_KEY
const API_KEY = import.meta.env.VITE_LLM_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY
const MODEL = import.meta.env.VITE_LLM_MODEL || 'deepseek-v4-flash'
// dev 走 Vite 代理 /deepseek 绕 CORS；可用 VITE_LLM_BASE_URL 覆盖
const BASE = import.meta.env.VITE_LLM_BASE_URL || '/deepseek'
const ENDPOINT = `${BASE}/chat/completions`
const OPENAI_BASE = import.meta.env.VITE_OPENAI_BASE_URL || '/openai'
const OPENAI_PLANNING_MODEL = import.meta.env.VITE_OPENAI_PLANNING_MODEL || 'gpt-5'
const OPENAI_PLANNING_ENDPOINT = `${OPENAI_BASE}/responses`

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

async function callOpenAIPlanner(text) {
  const evoMap = EVOMAP_EXPERIENCES.map((exp) => ({
    id: exp.id,
    name: exp.name,
    pattern: exp.pattern,
    strategy: exp.strategy,
    apply: exp.apply,
  }))
  const system = `你是 Life Kitchen 的规划抽取器，要从用户随口说的话里辨别真正可执行、可安排、可完成的事项。

抽取原则：
1. 只把"需要做的事 / 已承诺的事 / 要回复、写、讨论、整理、运动、复盘、购买、提交、处理"列入 todos。
2. 情绪、抱怨、背景、语气词不能单独成为 todo，例如"我好烦""今天很乱""有点累"。这些只能影响 emotionalLoad 或 ignoredContext。
3. 不要漏掉隐性任务：例如"设定表一直挂在心上"应抽成"整理/推进设定表"；"老师那边的信息"应抽成"回复老师信息"。
4. 如果一个句子里既有情绪又有行动，只保留行动标题，例如"我有点累但还想运动半小时"抽成"运动半小时"。
5. 标题要像用户能勾选的事项，不能写成情绪描述；每条标题 4-18 个汉字优先。
6. 不确定但可能需要安排的内容也放进 todos，并把 confidence 降低；不要因为语气含糊就漏掉。
7. estimatedTime 没明确给出时，结合 taskType 和复杂度估计分钟数。
8. 参考 Evo Map 配方，但不要输出配方文字到 title：${JSON.stringify(evoMap)}。

taskType 七选一：${TYPE_ENUM.join('/')}。
只输出符合 schema 的 JSON。`

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['todos', 'ignoredContext', 'evoSignals', 'note'],
    properties: {
      todos: {
        type: 'array',
        minItems: 0,
        maxItems: 12,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'title',
            'estimatedTime',
            'taskType',
            'energyCost',
            'emotionalLoad',
            'priority',
            'mustDo',
            'confidence',
            'evidence',
          ],
          properties: {
            title: { type: 'string' },
            estimatedTime: { type: 'integer', minimum: 1, maximum: 480 },
            taskType: { type: 'string', enum: TYPE_ENUM },
            energyCost: { type: 'string', enum: ['low', 'medium', 'high'] },
            emotionalLoad: { type: 'string', enum: ['low', 'medium', 'high'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            mustDo: { type: 'boolean' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            evidence: { type: 'string' },
          },
        },
      },
      ignoredContext: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'reason'],
          properties: {
            text: { type: 'string' },
            reason: { type: 'string', enum: ['emotion_only', 'background', 'tone', 'duplicate'] },
          },
        },
      },
      evoSignals: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'reason'],
          properties: {
            id: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
      note: { type: 'string' },
    },
  }

  const res = await fetch(OPENAI_PLANNING_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_PLANNING_MODEL,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'life_kitchen_planning_extract',
          strict: true,
          schema,
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = await res.json()
  const raw =
    data.output_text ||
    data.output?.flatMap((item) => item.content || [])?.find((part) => part.type === 'output_text')?.text ||
    ''
  if (!raw) throw new Error('OpenAI empty response')
  return JSON.parse(raw)
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
const ENERGY_ENUM = ['low', 'medium', 'high']
const PRIORITY_ENUM = ['low', 'medium', 'high']

function isEmotionOnly(title) {
  const cleaned = String(title)
    .replace(/[，。！？!?、\s]/g, '')
    .replace(/^(我|今天|现在|其实|真的|有点|特别|很|太)+/g, '')
  if (!cleaned) return true
  const emotionWords = /(乱|累|烦|焦虑|崩溃|低落|emo|没精神|不开心|压力大|难受|慌|卡住|头疼|烦躁|痛苦|不想干)/
  const actionWords = /(写|做|改|交|发|回|讨论|开会|整理|找|运动|复盘|提交|设计|生成|处理|确认|看|读|学|买|约|打|联系|准备|规划|排|修|完成|上传|下载|汇总|沟通)/
  return emotionWords.test(cleaned) && !actionWords.test(cleaned)
}

function isNonTaskFragment(title) {
  const cleaned = String(title || '')
    .replace(/[，。！？!?、\s]/g, '')
    .replace(/^(我|今天|现在|其实|真的|有点|特别|很|太|然后|另外|就是)+/g, '')
  if (!cleaned) return true
  const actionWords = /(写|做|改|交|发|回|讨论|开会|整理|找|运动|复盘|提交|设计|生成|处理|确认|看|读|学|买|约|打|联系|准备|规划|排|修|完成|上传|下载|汇总|沟通|推进|检查|测试|复习|背|练|预约|取|寄|付款|剪|拍|录|做完|弄|办)/
  const objectHints = /(作业|论文|报告|方案|文档|表|课|题|邮件|消息|会议|代码|设计|稿|图|视频|音频|材料|资料|账单|快递|运动|训练|复盘|项目|需求|接口|页面|简历)/
  const pureTime = /^(上午|下午|晚上|中午|早上|今晚|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}点|\d{1,3}(分钟|min|小时|h)|半小时|一小时)+$/
  const pureState = /^(累|困|烦|焦虑|开心|难受|崩溃|低落|不想干|没精神|压力大|卡住|很乱|太乱|好烦|有点烦|有点累|emo)+$/
  if (pureTime.test(cleaned) || pureState.test(cleaned)) return true
  return !actionWords.test(cleaned) && !objectHints.test(cleaned)
}

function cleanTitle(title) {
  return String(title || '')
    .replace(/^(我|今天|现在|其实|还是|还要|还得|想要|想把|想|需要|得|要)+/, '')
    .replace(/^(有点|特别|很|太)?(累|烦|焦虑|乱|低落|emo|没精神)(但|但是|不过|也)?/, '')
    .replace(/(上午|下午|晚上|中午|早上|今晚|明天|后天)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,3})点(钟)?(之前|以后|左右)?/g, '')
    .replace(/^(把|去|再)+/, '')
    .replace(/^(我|今天|现在|其实|还是|还要|还得|想要|想把|想|需要|得|要)+/, '')
    .trim()
}

function normalizeTodos(rawTodos, source) {
  const seen = new Set()
  return (Array.isArray(rawTodos) ? rawTodos : [])
    .map((t, i) => {
      const title = cleanTitle(t.title || t.evidence || '')
      const taskType = TYPE_ENUM.includes(t.taskType) ? t.taskType : 'admin'
      const energyCost = ENERGY_ENUM.includes(t.energyCost) ? t.energyCost : 'medium'
      const emotionalLoad = ENERGY_ENUM.includes(t.emotionalLoad) ? t.emotionalLoad : 'low'
      const priority = PRIORITY_ENUM.includes(t.priority) ? t.priority : 'medium'
      const estimatedTime = Math.max(1, Math.min(480, Number(t.estimatedTime) || 30))
      const key = title.replace(/\s/g, '')
      return {
        id: `todo_${Date.now()}_${i}`,
        title,
        estimatedTime,
        taskType,
        energyCost,
        emotionalLoad,
        priority,
        mustDo: Boolean(t.mustDo),
        confidence: Number(t.confidence) || (source === 'rule' ? 0.55 : 0.75),
        evidence: t.evidence || t.title || '',
        source,
        status: 'pending',
        _key: key,
      }
    })
    .filter((t) => t.title && t.title.length >= 2 && !isEmotionOnly(t.title) && !isNonTaskFragment(t.title))
    .filter((t) => {
      if (seen.has(t._key)) return false
      seen.add(t._key)
      return true
    })
    .map(({ _key, ...t }) => t)
}

// 模块九：吧台聊天 → Todo 列表
export async function parseTodosSmart(text) {
  try {
    const parsed = await callOpenAIPlanner(text)
    const todos = normalizeTodos(parsed.todos, 'openai-evomap')
    return {
      todos,
      source: 'openai-evomap',
      meta: {
        ignoredContext: parsed.ignoredContext || [],
        evoSignals: parsed.evoSignals || [],
        note: parsed.note || '',
      },
    }
  } catch (e) {
    console.warn('[llm] OpenAI planner fallback:', e.message)
  }

  if (!API_KEY) {
    const raw = parseTodos(text)
    return {
      todos: normalizeTodos(raw, 'rule'),
      source: 'rule',
      meta: {
        ignoredContext: raw.filter((t) => isEmotionOnly(t.title)).map((t) => ({ text: t.title, reason: 'emotion_only' })),
        evoSignals: [],
        note: '本地规则整理，已过滤纯情绪句。',
      },
    }
  }
  try {
    const system = `你是 Life Kitchen 的调酒师。用户不是在填待办表，而是在吧台随口聊今天发生的事、惦记的事、想处理的事；请从这段话里听出今天真正需要处理的事项，并拆成结构化待办。
重要：情绪、抱怨、背景、语气词不能单独成为待办。它们只能影响 emotionalLoad。不要把"我很累/今天很乱/有点焦虑"当作 title。
不要漏掉隐性任务：例如"设定表一直挂在心上"应抽成"整理设定表"。
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
    const todos = normalizeTodos(arr, 'llm')
    return {
      todos,
      source: 'llm',
      meta: { ignoredContext: [], evoSignals: [], note: '模型整理完成，已过滤纯情绪句。' },
    }
  } catch (e) {
    // 任何失败都兜回规则解析，绝不让 demo 卡住
    console.warn('[llm] parse fallback:', e.message)
    const raw = parseTodos(text)
    return {
      todos: normalizeTodos(raw, 'rule-fallback'),
      source: 'rule-fallback',
      meta: {
        ignoredContext: raw.filter((t) => isEmotionOnly(t.title)).map((t) => ({ text: t.title, reason: 'emotion_only' })),
        evoSignals: [],
        note: '接口暂时不可用，已用本地规则兜底。',
      },
    }
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
