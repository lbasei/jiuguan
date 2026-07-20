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
  const system = `你是 Life Kitchen 的规划抽取器，要从用户随口说的话里辨别真正可执行、可安排、可完成的事项。你的目标不是安慰用户，而是把口语段落拆成可打勾、可计时、可完成的动作。

抽取原则：
1. 先做信息筛选：把原话拆成"动作对象 / 时间 / 情绪 / 背景 / 诉求"。只有同时具备动作或明确对象的内容才能进入 todos。
2. 只把"需要做的事 / 已承诺的事 / 要回复、写、讨论、整理、运动、复盘、购买、提交、处理、拍摄、录屏、截图、补充素材"列入 todos。
3. 情绪、抱怨、背景、语气词不能单独成为 todo，例如"我好烦""今天很乱""有点累""不知道空闲时间干嘛"。这些只能进入 ignoredContext。
4. 不要漏掉隐性任务：例如"设定表一直挂在心上"应抽成"推进设定表"；"老师那边的信息"应抽成"回复老师信息"；"材料很散"若有明确目标，应抽成"整理材料"。
5. 如果一个句子里既有情绪又有行动，只保留行动标题，例如"我有点累但还想运动半小时"抽成 title="运动"，estimatedTime=30。
6. 标题要像用户能勾选的事项，不能写成情绪描述，也不要把"上午/下午/晚上/45分钟"写进 title；时间放 estimatedTime。
7. 口语里的"能不能/我想/感觉/就是/那个/比较/怎么安排/想被照顾"不是任务内容，除非后面接了具体事项。
8. 不确定但可能需要安排的内容也放进 todos，并把 confidence 降低；不要因为语气含糊就漏掉具体对象。
9. estimatedTime 没明确给出时，结合 taskType 和复杂度估计分钟数。
10. evidence 必须是触发这个任务的原话片段，用于后续校验，不要写推理过程。
11. 参考 Evo Map 配方，但不要输出配方文字到 title：${JSON.stringify(evoMap)}。
12. 一个片段里有多个对象时要拆开。例如"完成 Logo 设计、截图录视频、提交需求和 UI 素材"应拆成"完成 Logo 设计"、"截图并录制视频"、"提交需求和 UI 素材"。
13. 如果用户明确在问"有一段空闲时间怎么安排"，且给了时长或状态，可以生成 2-3 个轻量动作：一个低阻力推进、一个喝水/远眺/走动恢复、一个记录下一步。它们必须是能马上做的短动作，不要写成泛泛建议。

例子：
- "我今天很烦，脑子乱，不知道空闲时间做什么" => todos=[]，ignoredContext 包含情绪和空闲困惑。
- "我现在有40分钟空闲，有点累，不想浪费" => todos=["挑一件不用硬撑的小事","喝水远眺让眼睛离开屏幕","记下回来要接的下一步"]。
- "我有点烦，但PRD要写完，老师消息也要回" => todos=["写完PRD","回复老师消息"]。
- "设定表一直挂在心上，截图还没找" => todos=["推进设定表","整理截图"]。
- "今天要完成关于Logo的设计，截图录视频，以及提交一些需求和UI素材" => todos=["完成Logo设计","截图并录制视频","提交需求和UI素材"]。

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

function stripTimeWords(title) {
  return String(title || '')
    .replace(/(上午|下午|晚上|中午|早上|凌晨|今晚|今天|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天])\s*/g, '')
    .replace(/\d{1,2}\s*[:：]\s*\d{1,2}/g, '')
    .replace(/(\d{1,2}|[一二两三四五六七八九十]{1,3})点(钟)?(之前|以后|左右|前|后)?/g, '')
    .replace(/(\d+(?:\.\d+)?)\s*(分钟|min|小时|h)/gi, '')
    .replace(/半小时|一小时|两小时/g, '')
}

function deriveImplicitAction(fragment) {
  const cleaned = stripTimeWords(fragment)
    .replace(/[，。！？!?、\s]/g, '')
    .replace(/^(我|今天|现在|其实|还是|还要|还得|想要|想把|想|需要|得|要|把|去|再|先|那个|这个)+/, '')
    .replace(/(一直)?(挂在心上|惦记|放心不下|没弄完|没处理|没回|还没弄|还没做|卡着|卡住了?|有点卡|比较卡)$/, '')
    .replace(/那边的?/g, '')
  if (!cleaned) return ''
  if (/消息|微信|邮件|私信|通知|信息/.test(cleaned)) return `回复${cleaned.replace(/信息$/, '消息')}`
  if (/截图|资料|材料|文件|票据|报销|账单/.test(cleaned)) return `整理${cleaned}`
  if (/表|设定|方案|文档|报告|论文|稿|页面|设计|代码|需求|项目|作品集|作业|课题/.test(cleaned)) return `推进${cleaned}`
  if (/运动|训练|复盘|会议|讨论/.test(cleaned)) return cleaned
  return ''
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
  const pureQuestion = /^(可以|能不能|可不可以|有没有|怎么|怎样|如何|要不要|是不是|我该|应该).{0,24}(安排|做|管理|推进|处理|选择|开始|下手|规划|利用).*$/
  const noUsefulObject = /^(想|希望|需要)?(被)?(照顾|陪伴|鼓励|安慰|提醒|管理|安排)$/
  if (pureTime.test(cleaned) || pureState.test(cleaned) || pureQuestion.test(cleaned) || noUsefulObject.test(cleaned)) return true
  return !actionWords.test(cleaned) && !objectHints.test(cleaned)
}

function cleanTitle(title, evidence = '') {
  const raw = String(title || evidence || '')
  const cleaned = stripTimeWords(raw)
    .replace(/^(我|今天|现在|其实|还是|还要|还得|想要|想把|想|需要|得|要)+/, '')
    .replace(/^(有点|特别|很|太)?(累|烦|焦虑|乱|低落|emo|没精神)(但|但是|不过|也)?/, '')
    .replace(/^(把|去|再)+/, '')
    .replace(/^(我|今天|现在|其实|还是|还要|还得|想要|想把|想|需要|得|要)+/, '')
    .replace(/^(一件|一个|一下|点|些)+/, '')
    .replace(/(一直)?(挂在心上|惦记|放心不下|没弄完|没处理|没回|还没弄|还没做|卡着|卡住了?)$/, '')
    .replace(/也?(要|得|没|还没)?(回|回复)$/, '')
    .replace(/也?(要|得|没|还没)?(找|找一下|处理|处理一下|整理|整理一下|弄|弄一下)$/, '')
    .replace(/还没(改完|写完|做完|弄完|处理完)$/, '')
    .replace(/(改完|写完|做完|弄完|处理完)$/, '')
    .replace(/[要得需还]+$/, '')
    .replace(/也$/, '')
    .replace(/^(能|可以|最好能|最好可以)/, '')
    .replace(/一下/g, '')
    .replace(/那边的?/g, '')
    .replace(/^关于/, '')
    .replace(/关于/g, '')
    .trim()
  if (/消息|微信|邮件|私信|通知|信息/.test(cleaned) && !/^(回|回复|联系)/.test(cleaned)) return `回复${cleaned.replace(/信息$/, '消息')}`
  if (/截图|资料|材料|文件|票据|报销|账单/.test(cleaned) && !/^(整理|找|处理)/.test(cleaned)) return `整理${cleaned}`
  if (/写完/.test(raw) && !/^(写|完成)/.test(cleaned)) return `写完${cleaned}`
  if (/做完/.test(raw) && !/^(做|完成)/.test(cleaned)) return `做完${cleaned}`
  if (/论文|文档|报告|稿/.test(cleaned) && /改|修改/.test(raw)) return `修改${cleaned.replace(/^(改|修改)/, '')}`
  if (/^(截屏|截图|录屏|录视频|拍视频|剪视频)/.test(cleaned)) return cleaned.replace(/^录视频/, '录制视频')
  if (/表|设定|方案|文档|报告|论文|稿|页面|设计|代码|需求|项目|作品集|作业|课题|素材|图标|icon|logo|Logo/.test(cleaned) && !/^(推进|写|做|改|整理|讨论|设计|提交|补充|确认|截图|截屏|录屏|录制|拍|剪)/.test(cleaned)) return `推进${cleaned}`
  if (cleaned && !isNonTaskFragment(cleaned) && !isEmotionOnly(cleaned)) return cleaned
  return deriveImplicitAction(evidence || title)
}

function normalizeTodos(rawTodos, source) {
  const seen = new Set()
  return (Array.isArray(rawTodos) ? rawTodos : [])
    .map((t, i) => {
      const title = cleanTitle(t.title, t.evidence)
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
重要：情绪、抱怨、背景、语气词不能单独成为待办。它们只能影响 emotionalLoad。不要把"我很累/今天很乱/有点焦虑/怎么安排/想被照顾"当作 title。
如果用户明确是在问一段空闲时间怎么用，并给了时长或状态，可以生成轻量行动，例如"挑一件不用硬撑的小事"、"喝水远眺让眼睛离开屏幕"、"记下回来要接的下一步"。
不要漏掉隐性任务：例如"设定表一直挂在心上"应抽成"整理设定表"。
一个长句中出现多个对象或动作时要拆开，例如"Logo设计、截图录视频、提交需求和UI素材"要拆成三个任务。
如果原话是"我有点累但还想运动半小时"，title 写"运动"，estimatedTime 写 30。
只输出 JSON 数组，每个元素字段：
- title: 简短可勾选任务名，不含情绪词、时段词和分钟数
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
