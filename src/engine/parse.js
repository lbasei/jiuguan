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

function isProbablyTask(clause) {
  const cleaned = clause.replace(/[，。！？!?、\s]/g, '')
  const actionWords = /(写|做|改|交|发|回|讨论|开会|整理|找|运动|复盘|提交|设计|生成|处理|确认|看|读|学|买|约|打|联系|准备|规划|排|修|完成|上传|下载|汇总|沟通|推进|检查|测试|复习|背|练|预约|取|寄|付款|剪|拍|录|弄|办)/
  const objectHints = /(作业|论文|报告|方案|文档|表|课|题|邮件|消息|会议|代码|设计|稿|图|视频|音频|材料|资料|账单|快递|运动|训练|复盘|项目|需求|接口|页面|简历)/
  const pureTime = /^(上午|下午|晚上|中午|早上|今晚|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}点|\d{1,3}(分钟|min|小时|h)|半小时|一小时)+$/
  const pureEmotion = /^(累|困|烦|焦虑|开心|难受|崩溃|低落|不想干|没精神|压力大|卡住|很乱|太乱|好烦|有点烦|有点累|emo)+$/
  return !pureTime.test(cleaned) && !pureEmotion.test(cleaned) && (actionWords.test(cleaned) || objectHints.test(cleaned))
}

function cleanTaskTitle(title) {
  return title
    .replace(/^(我|今天|现在|其实|想|要|得|还|得要|需要|然后|另外)+/, '')
    .replace(/(上午|下午|晚上|中午|早上|今晚|明天|后天)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,3})点(钟)?(之前|以后|左右)?/g, '')
    .replace(/^(有点|很|太|特别)?(累|烦|焦虑|乱|低落|emo|没精神)(但|但是|不过|也)?/, '')
    .replace(/^(我|今天|现在|其实|想|要|得|还|得要|需要|然后|另外)+/, '')
    .trim()
}

export function parseTodos(text) {
  const clauses = splitClauses(text)
  return clauses.filter(isProbablyTask).map((title, i) => {
    const taskType = detectType(title)
    const clean = cleanTaskTitle(title) || title
    return {
      id: `todo_${Date.now()}_${i}`,
      title: clean,
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
