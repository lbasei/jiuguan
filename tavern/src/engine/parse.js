// 纯函数：把一段自然语言拆成结构化 Todo 列表（规则版）。
// 这是 LLM 解析的兜底实现，零网络依赖、100% 离线稳定。

import { TYPE_KEYWORDS, PRIORITY_KEYWORDS, MUST_KEYWORDS, DEFAULT_TIME } from '../data/keywords.js'

// 按标点和连接词把一段话切成短句
function splitClauses(text) {
  return text
    .replace(/\n/g, '，')
    .replace(/和(?=(提交|整理|确认|补充|截图|截屏|录屏|录视频|拍视频|剪视频|写|做|改|修改|完成|推进|设计))/g, '，')
    .split(/[，,。；;、]|还要|还有|然后|另外|以及|同时|顺便|最好|但是|但|不过|而且|并且/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}

function uniqFragments(fragments) {
  const seen = new Set()
  return fragments
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .filter((s) => {
      const key = s.replace(/[，。！？!?、\s]/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// 语音输入经常是一大段口语，单纯按逗号切会把真正事项切散。
// 这里额外从整段话里抓"对象 + 要做什么"的组合，优先保留可勾选动作。
function extractActionPhrases(text) {
  const raw = String(text || '')
    .replace(/\s+/g, '')
    .replace(/和(?=(提交|整理|确认|补充|截图|截屏|录屏|录视频|拍视频|剪视频|写|做|改|修改|完成|推进|设计))/g, '，')
    .replace(/以及|同时|并且|另外|然后/g, '，')
  const patterns = [
    /([^，。；;！？!?]{1,18}?(?:消息|微信|邮件|私信|通知|信息))(?:要|得|需要|还没|没)?(回|回复)/g,
    /(回|回复|联系|约|打电话给)([^，。；;！？!?]{1,18})/g,
    /([^，。；;！？!?]{1,20}?(?:截图|资料|材料|文件|票据|账单|快递))(?:要|得|需要|还没|没)?(找|整理|处理|寄|取)/g,
    /(找|整理|处理|提交|上传|下载)([^，。；;！？!?]{1,22}?(?:截图|资料|材料|文件|票据|账单|报告|方案|文档|表|代码|需求|页面|简历))/g,
    /(写|改|修改|做|完成|推进|设计|复盘|检查|测试|复习|背|练)([^，。；;！？!?]{1,24}?(?:作业|论文|报告|方案|文档|设定表|表|课题|需求|页面|代码|稿|视频|作品集|简历|题))/g,
    /(截屏|截图|录屏|录视频|拍视频|剪视频)/g,
    /提交(?:一些)?需求和?UI素材/g,
    /(提交|整理|补充|确认)(?:一些)?([^，。；;！？!?]{0,24}(?:需求和?UI素材|需求和?素材|需求|UI素材|素材|资料|材料|设定|设定表|页面|图标|icon|logo|Logo))/g,
    /([^，。；;！？!?]{1,22}?(?:需求|素材|UI素材|资料|材料|设定|设定表|页面|图标|icon|logo|Logo))(?:要|得|需要|还没|没)?(提交|整理|补充|确认)/g,
    /([^，。；;！？!?]{1,20}?(?:作业|论文|报告|方案|文档|设定表|表|课题|需求|页面|代码|稿|作品集|简历))(?:一直)?(?:挂在心上|惦记|没弄完|没处理|还没弄|还没做|卡着|卡住了?)/g,
    /([^，。；;！？!?]{0,12}?(?:运动|训练|复盘|会议|讨论|开会|沟通))(\d+\s*(?:分钟|min|小时|h)|半小时|一小时|两小时)?/g,
  ]
  const hits = []
  patterns.forEach((pattern) => {
    for (const match of raw.matchAll(pattern)) hits.push(match[0])
  })
  return uniqFragments(hits)
}

function detectType(clause) {
  const lower = clause.toLowerCase()
  if (/(讨论|沟通|联系|回复|消息|邮件|开会|会议|对接)/.test(lower)) return 'communication'
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
  const actionWords = /(写|做|改|交|发|回|回复|讨论|开会|整理|找|运动|复盘|提交|设计|生成|处理|确认|看|读|学|买|约|打|联系|准备|规划|排|修|完成|上传|下载|汇总|沟通|推进|检查|测试|复习|背|练|预约|取|寄|付款|剪|拍|录|弄|办)/
  const objectHints = /(作业|论文|报告|方案|文档|表|课|题|邮件|消息|会议|代码|设计|设定|稿|图|视频|音频|材料|资料|素材|账单|快递|运动|训练|复盘|项目|需求|接口|页面|简历|logo|Logo|图标|icon)/
  const pureTime = /^(上午|下午|晚上|中午|早上|今晚|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}点|\d{1,3}(分钟|min|小时|h)|半小时|一小时)+$/
  const pureEmotion = /^(累|困|烦|焦虑|开心|难受|崩溃|低落|不想干|没精神|压力大|卡住|很乱|太乱|好烦|有点烦|有点累|emo)+$/
  const vagueAdvice = /^(能不能|可以不可以|不知道|想知道|我有一些|有一些|如果|假设|希望|感觉|觉得|想被|怎么|怎么办|如何).{0,18}(安排|管理|照顾|使用|规划|做什么|干嘛)?$/
  const pureBackground = /^(今天|最近|现在)?(状态|心情|脑子|事情)?(很|有点|特别|太)?(乱|累|烦|焦虑|空|碎|卡|迷茫)$/
  const pureQuestion = /^(可以|能不能|可不可以|有没有|怎么|怎样|如何|要不要|是不是|我该|应该).{0,24}(安排|做|管理|推进|处理|选择|开始|下手|规划|利用).*$/
  const noUsefulObject = /^(想|希望|需要)?(被)?(照顾|陪伴|鼓励|安慰|提醒|管理|安排)$/
  return !pureTime.test(cleaned)
    && !pureEmotion.test(cleaned)
    && !pureBackground.test(cleaned)
    && !vagueAdvice.test(cleaned)
    && !pureQuestion.test(cleaned)
    && !noUsefulObject.test(cleaned)
    && (actionWords.test(cleaned) || objectHints.test(cleaned))
}

function stripTimeWords(title) {
  return title
    .replace(/(上午|下午|晚上|中午|早上|凌晨|今晚|今天|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天])\s*/g, '')
    .replace(/\d{1,2}\s*[:：]\s*\d{1,2}/g, '')
    .replace(/(\d{1,2}|[一二两三四五六七八九十]{1,3})点(钟)?(之前|以后|左右|前|后)?/g, '')
    .replace(/(\d+(?:\.\d+)?)\s*(分钟|min|小时|h)/gi, '')
    .replace(/半小时|一小时|两小时/g, '')
}

function deriveImplicitAction(clause) {
  const cleaned = stripTimeWords(clause)
    .replace(/^(我|今天|现在|其实|还是|还要|还得|想要|想把|想|需要|得|要|把|去|再|先)+/, '')
    .replace(/(一直)?(挂在心上|惦记|放心不下|没弄完|没处理|没回|还没弄|还没做|卡着|卡住了?)$/, '')
    .replace(/那边的?/g, '')
    .replace(/关于/g, '')
    .replace(/\s/g, '')
  if (!cleaned) return ''
  if (/消息|微信|邮件|私信|通知/.test(cleaned)) return `回复${cleaned.replace(/信息$/, '消息')}`
  if (/截图|资料|材料|文件|票据|报销|账单/.test(cleaned)) return `整理${cleaned}`
  if (/截图|录屏|录视频|视频/.test(cleaned)) return cleaned.replace(/^录/, '录制')
  if (/表|设定|方案|文档|报告|论文|稿|页面|设计|代码|需求|项目|素材|图标|icon|logo|Logo/.test(cleaned)) return `推进${cleaned}`
  if (/运动|训练|复盘|会议|讨论/.test(cleaned)) return cleaned
  return ''
}

function cleanTaskTitle(title) {
  const stripped = stripTimeWords(title)
    .replace(/^(我|今天|现在|其实|想|要|得|还|得要|需要|然后|另外|可能|感觉|觉得|就是|那个|这个|帮我)+/, '')
    .replace(/^(有点|很|太|特别)?(累|烦|焦虑|乱|低落|emo|没精神)(但|但是|不过|也)?/, '')
    .replace(/^(我|今天|现在|其实|还是|还要|还得|想要|想把|想|需要|得|要|把|去|再|先|可能|感觉|觉得|就是|那个|这个|帮我)+/, '')
    .replace(/^(一件|一个|一下|一点|比较|点|些)+/, '')
    .replace(/一些/g, '')
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
    .replace(/的(?=(设计|设定|需求|素材|资料|材料|页面|图标|代码|方案|报告|文档|作品集)$)/g, '')
    .trim()
  if (/消息|微信|邮件|私信|通知|信息/.test(stripped) && !/^(回|回复|联系)/.test(stripped)) return `回复${stripped.replace(/信息$/, '消息')}`
  if (/截图|资料|材料|文件|票据|报销|账单/.test(stripped) && !/^(整理|找|处理)/.test(stripped)) return `整理${stripped}`
  if (/提交/.test(title) && /需求/.test(title) && /UI素材|素材/.test(title)) return '提交需求和UI素材'
  if (/写完/.test(title) && !/^(写|完成)/.test(stripped)) return `写完${stripped}`
  if (/做完/.test(title) && !/^(做|完成)/.test(stripped)) return `做完${stripped}`
  if (/完成/.test(title) && /设计|方案|页面|图标|logo|Logo/.test(stripped) && !/^完成/.test(stripped)) return `完成${stripped}`
  if (/论文|文档|报告|稿/.test(stripped) && /改|修改/.test(title)) return `修改${stripped.replace(/^(改|修改)/, '')}`
  if (/^(截屏|截图)录视频/.test(stripped)) return '截图并录制视频'
  if (/^录视频/.test(stripped)) return stripped.replace(/^录视频/, '录制视频')
  if (/^(截屏|截图|录屏|拍视频|剪视频)/.test(stripped)) return stripped
  if (/表|设定|方案|文档|报告|论文|稿|页面|设计|代码|需求|项目|作品集|作业|课题|素材|图标|icon|logo|Logo/.test(stripped) && !/^(推进|写|做|改|整理|讨论|设计|提交|补充|确认|完成|截图|截屏|录屏|录制|拍|剪)/.test(stripped)) return `推进${stripped}`
  return stripped || deriveImplicitAction(title)
}

export function parseTodos(text) {
  const clauses = uniqFragments([...extractActionPhrases(text), ...splitClauses(text)])
  const seen = new Set()
  const todos = clauses.filter(isProbablyTask).map((title, i) => {
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
  }).filter((todo) => {
    const key = todo.title.replace(/[，。！？!?、\s]/g, '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return todos.filter((todo, index) => {
    const key = todo.title.replace(/[，。！？!?、\s]/g, '')
    if (key === '提交需求' && todos.some((other) => /提交需求和?UI素材|提交需求和?素材/.test(other.title.replace(/[，。！？!?、\s]/g, '')))) return false
    if (key === '录制视频' && todos.some((other) => other.title.replace(/[，。！？!?、\s]/g, '') === '截图并录制视频')) return false
    if ((key === '截屏' || key === '截图') && todos.some((other) => other.title.replace(/[，。！？!?、\s]/g, '') === '截图并录制视频')) return false
    if (/和|以及|同时|并且/.test(key) && !/UI素材|素材/.test(key)) {
      const hasContainedTask = todos.some((other, otherIndex) => {
        if (otherIndex === index) return false
        const otherKey = other.title.replace(/[，。！？!?、\s]/g, '')
        return otherKey.length >= 3 && key.includes(otherKey)
      })
      if (hasContainedTask) return false
    }
    return true
  })
}
