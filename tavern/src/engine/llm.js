// LLM 入口层。前端只请求自家后端 /api/llm/*，Gemini key 永不进浏览器。
// 有 Gemini 时走真模型；失败或未配置时静默降级规则解析。UI 只调这两个 async 函数。

import { parseTodos } from './parse.js'
import { BARTENDERS } from '../data/bartenders.js'
import { apiFetch } from './apiClient.js'

const TYPE_ENUM = ['deep_work', 'creative', 'communication', 'admin', 'recovery', 'urgent', 'review']
const ENERGY_ENUM = ['low', 'medium', 'high']
const PRIORITY_ENUM = ['low', 'medium', 'high']

let cachedEnabled = null

export async function llmEnabled() {
  if (cachedEnabled !== null) return cachedEnabled
  try {
    const res = await apiFetch('/api/llm/status')
    const data = await res.json().catch(() => ({}))
    cachedEnabled = Boolean(res.ok && data.enabled)
  } catch {
    cachedEnabled = false
  }
  return cachedEnabled
}

async function requestLlm(path, text) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.message || data.error || `LLM API ${res.status}`)
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}

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

function ruleParseResult(text, source = 'rule') {
  const raw = parseTodos(text)
  return {
    todos: normalizeTodos(raw, source),
    source,
    meta: {
      ignoredContext: raw.filter((t) => isEmotionOnly(t.title)).map((t) => ({ text: t.title, reason: 'emotion_only' })),
      evoSignals: [],
      note: source === 'rule-fallback' ? '接口暂时不可用，已用本地规则兜底。' : '本地规则整理，已过滤纯情绪句。',
    },
  }
}

// 模块九：吧台聊天 → Todo 列表
export async function parseTodosSmart(text) {
  try {
    const parsed = await requestLlm('/api/llm/parse-todos', text)
    const todos = normalizeTodos(parsed.todos, 'gemini')
    return {
      todos,
      source: 'gemini',
      meta: {
        ignoredContext: parsed.ignoredContext || [],
        evoSignals: parsed.evoSignals || [],
        note: parsed.note || '模型整理完成，已过滤纯情绪句。',
      },
    }
  } catch (e) {
    console.warn('[llm] gemini parse fallback:', e.message)
    return ruleParseResult(text, 'rule-fallback')
  }
}

function suggestBartenderRule(text) {
  if (/(累|疲|焦虑|低落|没精神|emo)/.test(text)) return 'mint'
  if (/(拖|不想开始|卡住|启动|懒)/.test(text)) return 'ginger'
  if (/(打断|消息|分心|专注)/.test(text)) return 'garlic'
  if (/(随便|宽松|别管|自由|抗拒)/.test(text)) return 'cilantro'
  return 'rosemary'
}

// 模块十一：自然语言 → 推荐/生成调酒师种种
export async function suggestBartenderSmart(text) {
  try {
    const obj = await requestLlm('/api/llm/suggest-bartender', text)
    const id = BARTENDERS.some((b) => b.id === obj.id) ? obj.id : suggestBartenderRule(text)
    return { id, source: 'gemini', note: obj.note || '' }
  } catch (e) {
    console.warn('[llm] gemini bartender fallback:', e.message)
    return { id: suggestBartenderRule(text), source: 'rule-fallback', note: '' }
  }
}
