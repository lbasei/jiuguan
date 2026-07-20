// 纯函数：日度复盘。根据执行记录生成"今日特调卡"。

import { nameDrink } from './plan.js'
import { matchExperiences } from './evolve.js'
import { formatDuration } from './time.js'
import { getRecipeVolumeLayers } from './recipeVolume.js'

const ROLE_TEXT = {
  deep_work: '主要花在主线推进。',
  creative: '留了创作和构思。',
  communication: '沟通协作占了一部分。',
  admin: '零碎事务比较多。',
  recovery: '有留恢复时间。',
  urgent: '有需要立刻处理的事。',
  review: '最后有收口和整理。',
}

const BARTENDER_SPECIALS = {
  rosemary: {
    title: '主线压舱',
    method: '主线优先，杂事收边。',
    bestWith: ['deep_work', 'urgent'],
    caution: '如果小料太多，迷迭香会把它们压到后段集中处理，避免整杯散味。',
  },
  ginger: {
    title: '十分钟点火',
    method: '先动一下，再进主菜。',
    bestWith: ['urgent', 'deep_work', 'creative'],
    caution: '适合破冰，不适合把所有事情都做成冲刺；后面要补一点缓冲。',
  },
  mint: {
    title: '缓冲奶盖',
    method: '高耗能后必须留空。',
    bestWith: ['recovery', 'deep_work'],
    caution: '如果主味很浓但没有恢复层，明天需要把休息写进酒单，而不是靠硬扛。',
  },
  lemon: {
    title: '清醒开场',
    method: '第一步要短、亮、好入口。',
    bestWith: ['urgent', 'communication', 'creative'],
    caution: '酸味能提神，但不适合一直催；超过两段冲刺后要降速。',
  },
  garlic: {
    title: '边界盐口',
    method: '打断集中处理。',
    bestWith: ['admin', 'communication'],
    caution: '如果杯里全是小料，说明今天不是不努力，而是边界被切碎了。',
  },
  cilantro: {
    title: '随手加料',
    method: '先从轻的一口开始。',
    bestWith: ['admin', 'recovery', 'creative'],
    caution: '自由度高的时候，要在最后补一个收口，不然方法很难留进冰柜。',
  },
  osmanthus: {
    title: '桂香收口',
    method: '开场放轻，按节奏推进。',
    bestWith: ['review', 'deep_work', 'recovery'],
    caution: '桂花会把事情排得更有礼貌：不抢、不乱，但最后一定要收尾。',
  },
  chili: {
    title: '一口点火',
    method: '只给关键处开火。',
    bestWith: ['urgent', 'deep_work'],
    caution: '辣椒适合破拖延，不适合全程猛冲；点完火要立刻降温。',
  },
  mint_osmanthus: {
    title: '清香双调',
    method: '先降温，再收住节奏。',
    bestWith: ['recovery', 'review', 'deep_work'],
    caution: '适合想稳住一天但不想被催太狠的时候。',
  },
  lemon_chili: {
    title: '醒神双调',
    method: '先切清楚，再点一把火。',
    bestWith: ['urgent', 'creative', 'deep_work'],
    caution: '适合启动困难的日子；冲刺只能放在最关键的一口。',
  },
}

const BARTENDER_REVIEW_VOICES = {
  rosemary: {
    title: '吧台边的主线批注',
    line: ({ heaviest, overrun }) =>
      overrun.length
        ? `先别急着把所有事都端上来。${heaviest?.name || '主线'}这口太重，明天我会把它放到最前面，小事等它结束再排队。`
        : `${heaviest?.name || '主线'}今天站得住。明天照这个开场来，别让碎事先摸到杯底。`,
    actions: ({ missing, overrun }) => [
      overrun.length ? '主线多留 15 分钟' : '第一段留给主线',
      missing.length ? '最后补 5 分钟收口' : '碎事集中一盘',
    ],
  },
  ginger: {
    title: '先把火点起来',
    line: ({ completionRate }) =>
      completionRate < 0.5 ? '别坐着等状态来。明天第一步我给你切到十分钟，热锅先响，后面的事才会跟上。' : '今天开火不慢。下次还是先用一件短事热锅，别一上来就硬炖大菜。',
    actions: ({ overrun }) => [
      '开局 10 分钟',
      overrun.length ? '冲刺后降温' : '热身后接主菜',
    ],
  },
  mint: {
    title: '先留一口凉的',
    line: ({ missing }) =>
      missing.includes('恢复奶泡') ? '你今天有点把自己煮干了。明天我会把休息写进清单里，不许它再被当成“有空再说”。' : '今天没有太冲，这样挺好。缓冲别删掉，它不是偷懒，是让下一口还能喝下去。',
    actions: ({ overrun }) => [
      overrun.length ? '长任务后休 10 分钟' : '保留喝水点',
      '晚上不塞新主线',
    ],
  },
  lemon: {
    title: '把话切短一点',
    line: ({ heaviest }) => `${heaviest?.name || '这件事'}别再写成一坨了。明天我只留一个动词，一个入口，酸一点，但清楚。`,
    actions: ({ overrun }) => [
      '每项只留一个动词',
      overrun.length ? '超时就切段' : '先做清爽一件',
    ],
  },
  garlic: {
    title: '门我来守',
    line: ({ heaviest }) =>
      heaviest?.category === 'communication' || heaviest?.category === 'admin'
        ? '消息和杂事今天咬了你太多口。明天我把它们收进同一个盘子，别让它们到处跑。'
        : '今天主线还没被切碎，保持。明天继续关一段门，谁敲都先等着。',
    actions: () => ['消息集中两次', '主线时段不开口'],
  },
  cilantro: {
    title: '先挑顺手的那口',
    line: ({ missing }) =>
      missing.length ? '不用把清单当命令。明天先挑最顺手的一件，做完再看下一口；不过最后要留一句收尾，别偷偷溜走。' : '今天这个入口挺顺。下次还从这里进，别一开始就把自己绑住。',
    actions: () => ['先做最轻一件', '结束留一句'],
  },
  osmanthus: {
    title: '慢慢把香气收住',
    line: () => '今天不用被催得那么响。明天我给你留一个温和开场，收尾写一句就够，让这份出品有余味。',
    actions: () => ['温和开场', '一句收尾'],
  },
  chili: {
    title: '火只点在关键处',
    line: ({ overrun }) =>
      overrun.length ? '今天火开太久了，辣是辣，但会糊。明天只给一件事开冲刺，做完立刻降温。' : '劲儿别到处撒。明天还是抓最关键那一下，烧准一点。',
    actions: () => ['只冲刺一件', '结束马上降温'],
  },
  mint_osmanthus: {
    title: '先凉下来，再慢慢收香',
    line: ({ missing, heaviest }) =>
      missing.length
        ? `今天有点把${heaviest?.name || '主味'}泡急了。明天先留一口凉的，再慢慢收住，不用一开始就全倒进去。`
        : '今天的节奏是能入口的。明天还照这个来：先稳住，再收漂亮。',
    actions: () => ['先留缓冲', '最后收香'],
  },
  lemon_chili: {
    title: '清醒一点，火别乱烧',
    line: ({ overrun, heaviest }) =>
      overrun.length
        ? `${heaviest?.name || '这件事'}烧得久了点。明天入口切短，只冲最关键一口，做完马上撤火。`
        : '今天有劲儿，也没太糊。明天继续：先说清楚，再开一小段火。',
    actions: () => ['入口切短', '只冲关键'],
  },
}

const EXTRACTED_ACTIONS = {
  deep_work: '先保留一段不被打断的主线时间，把最重要的推进放在杯底。',
  creative: '把创作和构思放在清醒时段，先产出草稿，再慢慢修味。',
  communication: '把消息、会议和回复合并成固定入口，减少整天被气泡打散。',
  admin: '把零碎事务收成一盘小料，集中处理，不让它们占满整杯。',
  recovery: '把休息、喝水和运动写成正式配料，放在高消耗任务后面。',
  urgent: '先处理最烫手的截止项，但不要让整天都靠冲刺推进。',
  review: '最后留一小段复盘收口，把今天有效的方法存成下次可复用的配方。',
}

function sumTime(items) {
  return items.reduce((sum, item) => sum + (item.estimatedTime || item.actualTime || 0), 0)
}

function getSpecialRecipe(bartender, recipe, { isEmptyCup, heaviest, missing, overrun }) {
  if (isEmptyCup) {
    return {
      title: '空杯样本',
      method: '先完成一件小事。',
      fit: '待验证',
      summary: '明天先倒第一层。',
    }
  }
  const mainLayer = heaviest || recipe[0]
  const secondLayer = recipe.find((layer) => layer.category !== mainLayer?.category)
  const mainRatio = Math.round((mainLayer?.ratio || 0) * 100)
  const secondText = secondLayer ? ` + ${secondLayer.name}` : ''
  const method = `${mainLayer?.name || '主味'} ${mainRatio}%${secondText}`
  const summary = overrun.length
    ? '时间加 20%'
    : missing.length
    ? `补 ${missing[0]}`
    : '可存为固定配方'
  return {
    title: `${mainLayer?.name || '今日主味'}主导`,
    method,
    fit: missing.length || overrun.length ? '可调优' : '可复用',
    summary,
  }
}

function getManagementRelation({ recipe, bartender, heaviest, missing, overrun, underrun, timeAccuracy, completionRate, isEmptyCup }) {
  if (isEmptyCup) {
    return {
      title: '方法还没有被验证',
      points: [
        '空杯',
        '先做 10 分钟',
      ],
    }
  }
  const categories = new Set(recipe.map((r) => r.category))
  const points = []
  if (heaviest?.category === 'admin' || heaviest?.category === 'communication') {
    points.push('碎事偏多')
  } else if (heaviest?.category === 'deep_work' || heaviest?.category === 'creative') {
    points.push('主线清楚')
  } else if (heaviest?.category === 'urgent') {
    points.push('冲刺偏多')
  }
  if (!categories.has('recovery')) points.push('缺恢复层')
  if (!categories.has('review')) points.push('缺收口')
  if (overrun.length || timeAccuracy < 0.65) points.push('时间偏紧')
  if (!overrun.length && underrun.length) points.push('预估可缩短')
  if (completionRate >= 0.8 && timeAccuracy >= 0.75 && !missing.length) {
    points.push('可存冰柜')
  }
  return {
    title: '今天的节奏',
    points: points.slice(0, 3),
  }
}

function makeStateProfile({ isEmptyCup, completionRate, timeAccuracy, overrun, missing, heaviest }) {
  if (isEmptyCup) {
    return {
      title: '今天还没开杯',
      summary: '先不评价。明天只放一件很小的事，让杯底先有第一层味道。',
    }
  }
  if (completionRate >= 0.8 && timeAccuracy >= 0.75 && !missing.length) {
    return {
      title: '这杯很稳',
      summary: '今天的顺序是顺手的，时间也没跑太远。下次可以直接沿用这个开场。',
    }
  }
  if (overrun.length >= 2 || timeAccuracy < 0.55) {
    return {
      title: '火候偏满',
      summary: '有几件事比想象中更占火。下次同类任务先多留一点气口。',
    }
  }
  if (missing.length) {
    return {
      title: '少了一口缓冲',
      summary: `今天主味是${heaviest?.name || '这件事'}，但中间太少喘口气。明天别把休息挤到最后。`,
    }
  }
  return {
    title: '顺序成形',
    summary: '今天已经跑出一条可用顺序。下一次少调几步，从这份出品继续。',
  }
}

function makeScore({ completionRate, timeAccuracy, recipe, missing, isEmptyCup }) {
  if (isEmptyCup) return { total: 0, stars: 0, parts: { completion: 0, timing: 0, balance: 0 } }
  const hasRecovery = recipe.some((r) => r.category === 'recovery')
  const hasReview = recipe.some((r) => r.category === 'review')
  const balance = Math.max(0, 1 - missing.length * 0.22) * 0.55 + (hasRecovery ? 0.25 : 0) + (hasReview ? 0.2 : 0)
  const completion = Math.round(completionRate * 55)
  const timing = Math.round(timeAccuracy * 25)
  const balanceScore = Math.round(Math.min(1, balance) * 20)
  const total = Math.max(0, Math.min(100, completion + timing + balanceScore))
  return {
    total,
    stars: Math.max(1, Math.min(5, Math.ceil(total / 20))),
    parts: { completion, timing, balance: balanceScore },
  }
}

function makeFlavorTuning({ recipe, timeAccuracy, completionRate, missing, overrun }) {
  const get = (category) => recipe.find((r) => r.category === category)?.ratio || 0
  const deep = get('deep_work') + get('creative')
  const admin = get('admin') + get('communication')
  const recovery = get('recovery')
  const urgent = get('urgent')
  const review = get('review')
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)))
  const concentration = clamp(deep * 70 + urgent * 55 + (1 - timeAccuracy) * 26)
  const sweetness = clamp(recovery * 62 + review * 36 + Math.max(0, 0.75 - completionRate) * 22)
  const fizz = clamp(admin * 70 + urgent * 24)
  const finish = clamp(review * 58 + recovery * 22 + timeAccuracy * 20)
  const tuning = []
  if (concentration >= 72) tuning.push('浓度偏高：下一杯把深度任务切成两段，中间加 10 分钟缓冲。')
  if (fizz >= 62) tuning.push('气泡偏多：沟通和杂事集中到固定时段，减少整天被打断。')
  if (sweetness <= 24) tuning.push('甜度偏低：加入明确休息、喝水或散步，不要等耗尽才恢复。')
  if (finish <= 32 || missing.includes('肉桂封口')) tuning.push('收口不足：最后留 5 分钟复盘，让这杯酒下次能复刻。')
  if (overrun.length) tuning.push('火候偏长：同类任务预估上调 20%，别让计划表太乐观。')
  if (!tuning.length) tuning.push('比例稳定：这份出品可以存进冰柜，作为下次的基础配方。')
  return [
    { key: 'concentration', label: '主线压力', value: concentration, target: concentration > 70 ? '需要切小' : '可以保持' },
    { key: 'sweetness', label: '恢复余量', value: sweetness, target: sweetness < 30 ? '要补休息' : '余量够用' },
    { key: 'fizz', label: '碎片干扰', value: fizz, target: fizz > 60 ? '集中处理' : '干扰可控' },
    { key: 'finish', label: '复盘收口', value: finish, target: finish < 35 ? '补 5 分钟' : '收口稳定' },
  ].map((item, index) => ({ ...item, advice: tuning[index] || tuning[0] }))
}

function bartenderKey(bartender = {}) {
  const text = `${bartender.id || ''} ${bartender.plant || ''} ${bartender.name || ''}`.toLowerCase()
  if (/mint_osmanthus|mint-osmanthus|薄荷桂花/.test(text)) return 'mint_osmanthus'
  if (/lemon_chili|lemon-chili|柠檬辣椒/.test(text)) return 'lemon_chili'
  if (/rosemary|迷迭香/.test(text)) return 'rosemary'
  if (/ginger|姜/.test(text)) return 'ginger'
  if (/mint|薄荷/.test(text)) return 'mint'
  if (/lemon|柠檬/.test(text)) return 'lemon'
  if (/garlic|葱|蒜/.test(text)) return 'garlic'
  if (/cilantro|香菜/.test(text)) return 'cilantro'
  if (/osmanthus|桂花/.test(text)) return 'osmanthus'
  if (/chili|pepper|辣椒/.test(text)) return 'chili'
  return 'mint'
}

function makeBartenderAdvice({ bartender, heaviest, missing, overrun, completionRate, timeAccuracy }) {
  const voice = BARTENDER_REVIEW_VOICES[bartenderKey(bartender)] || BARTENDER_REVIEW_VOICES.mint
  const context = { heaviest, missing, overrun, completionRate, timeAccuracy }
  const actions = typeof voice.actions === 'function' ? voice.actions(context) : voice.actions
  return {
    title: voice.title,
    line: voice.line(context),
    actions: actions.slice(0, 2),
  }
}

function makeProgressCharts({ completionRate, timeAccuracy, completedCount, totalCount, evoTips, overrun, underrun, isEmptyCup }) {
  const evoBase = isEmptyCup ? 8 : 42 + Math.min(28, evoTips.length * 9)
  const timingValue = Math.round(timeAccuracy * 100)
  const drift = overrun.length + underrun.length
  return [
    {
      key: 'completion',
      label: '完成',
      value: Math.round(completionRate * 100),
      detail: `${completedCount}/${Math.max(1, totalCount)}`,
      tone: 'mint',
    },
    {
      key: 'timing',
      label: '时间贴合',
      value: timingValue,
      detail: drift ? `${drift} 处校准` : '手感稳定',
      tone: 'gold',
    },
    {
      key: 'evo',
      label: '记忆',
      value: Math.min(96, evoBase + Math.round(completionRate * 18) + (timingValue > 80 ? 8 : 0)),
      detail: evoTips.length ? `${evoTips.length} 条习惯` : '待记录',
      tone: 'pink',
    },
  ]
}

function makeHabitMemory({ recipe, heaviest, missing, overrun, underrun, completedCount, isEmptyCup }) {
  if (isEmptyCup) {
    return {
      title: '还没记入口味',
      chips: ['先完成一件', '记录启动时间', '明天再调'],
      note: '空杯不打分，只记一个入口。',
    }
  }
  const chips = []
  if (heaviest?.name) chips.push(`${heaviest.name}优先`)
  if (overrun.length) chips.push('同类加时')
  if (underrun.length) chips.push('预估可降')
  if (missing.length) chips.push('补缓冲')
  if (!chips.length) chips.push('可存固定杯')
  return {
    title: '下次默认记住',
    chips: chips.slice(0, 4),
    note: `这次记住 ${completedCount} 个完成样本。下次会先按这个顺序起步，再让种种微调。`,
    palette: recipe.slice(0, 4).map((r) => r.color),
  }
}

function makeBartenderComment({ bartender, isEmptyCup, completionRate, heaviest, missing, overrun }) {
  const key = bartenderKey(bartender)
  const main = heaviest?.name || '今天这杯'
  const stable = completionRate >= 0.8 && !overrun.length && !missing.length
  if (isEmptyCup) {
    const emptyLines = {
      rosemary: '今天先不端上桌。明天挑一件最该先做的，我替你压住场。',
      ginger: '锅还没热。明天别想太久，先用十分钟把第一口炒出来。',
      mint: '今天这杯先放着。明天从轻一点的事开始，别一上来就把自己泡皱。',
      lemon: '空杯没关系。明天只写一个动作，短一点，清楚一点。',
      garlic: '今天先关门。明天我守着入口，你只放一件真的要做的事进来。',
      cilantro: '那就先不装满。明天随手挑一件，看顺不顺口再说。',
      osmanthus: '今天香气还没落杯。明天从一件温和的小事开始。',
      chili: '火还没点。明天只冲一件，冲完就收。',
    }
    return emptyLines[key] || emptyLines.mint
  }
  const lines = {
    rosemary: stable
      ? `${main}今天压得住场。明天继续让主线先上桌，碎事别抢开场。`
      : `${main}有点占杯。明天我先替它留位，小事晚一点再端。`,
    ginger: overrun.length
      ? `今天火开得久了点。${main}可以先切小，热起来就别硬烧。`
      : `今天起势不差。明天还是先点一小段火，再接主菜。`,
    mint: missing.includes('恢复奶泡')
      ? `你今天太少给自己留凉口。${main}之后要休一下，不然下一口会涩。`
      : `今天没有把自己逼太紧。这个节奏可以留着，喝水和停顿别删。`,
    lemon: `${main}可以更利落。明天每件事只留一个入口，别让句子拖住手。`,
    garlic: heaviest?.category === 'communication' || heaviest?.category === 'admin'
      ? '消息和杂事今天跑得太散。明天我把它们收成一盘，别让它们满场乱窜。'
      : `${main}还算完整。明天继续留一段不被敲门的时间。`,
    cilantro: stable
      ? '今天这口挺顺，别把它改复杂。下次从最顺手的地方开局。'
      : '不用把清单当军令。先挑能动起来的一口，做完再换下一口。',
    osmanthus: stable
      ? '今天收得很温柔。明天照这个香气来，最后仍然留一句收尾。'
      : `今天的香气有点散。${main}要慢慢放稳，别急着全倒进去。`,
    chili: overrun.length
      ? '今天辣得有点过头。明天只给关键事开火，做完马上降温。'
      : '今天有劲儿。明天别到处撒火，抓最要紧那一下就够。',
  }
  return lines[key] || lines.mint
}

function makeBartenderSuggestion({ bartender, isEmptyCup, missing, overrun, underrun, heaviest }) {
  const key = bartenderKey(bartender)
  if (isEmptyCup) {
    const starts = {
      rosemary: '明天第一杯：只排一件主线，完成后再加小料。',
      ginger: '明天第一步：开一个 10 分钟短火，不等状态。',
      mint: '明天第一步：选最轻的一件，旁边留一口休息。',
      lemon: '明天第一步：把任务改成一个动词，越短越好。',
      garlic: '明天第一步：先关掉打断，再开始。',
      cilantro: '明天第一步：随手挑一件，做完再决定下一口。',
      osmanthus: '明天第一步：温和开场，别把清单倒满。',
      chili: '明天第一步：只冲一件，别分火。',
    }
    return starts[key] || starts.mint
  }
  if (overrun.length) {
    const overtime = {
      rosemary: `${heaviest?.name || '主线'}下次多留一格时间，别让它挤坏后面的味道。`,
      ginger: '同类任务先切成两段，第一段只负责起火。',
      mint: '长任务后面补一段空白，不然会越做越钝。',
      lemon: '超时的事改成两句短指令，别一口吞。',
      garlic: '容易拖长的事先挡住外界消息，做完再开门。',
      cilantro: '超时就换成小步走，别跟它硬耗。',
      osmanthus: '把慢任务提早一点，给它留香气散开的时间。',
      chili: '冲刺只留给一件事，其他都别跟着烧。',
    }
    return overtime[key] || overtime.mint
  }
  if (missing.includes('恢复奶泡')) {
    const rest = {
      rosemary: '主线后面必须留缓冲，不然整张酒单会塌。',
      ginger: '冲完要降温，休息不是拖慢，是防止糊锅。',
      mint: '休息写进清单里，别等累了才想起来。',
      lemon: '加一个短暂停顿，让下一件事入口更清楚。',
      garlic: '恢复时间也要守住，别让别人顺手拿走。',
      cilantro: '中间塞一口轻的，清单会更好继续。',
      osmanthus: '留一段安静，香气才收得住。',
      chili: '火太密会辣到自己，记得留降温段。',
    }
    return rest[key] || rest.mint
  }
  if (underrun.length) {
  return key === 'ginger' || key === 'chili'
      ? '有些事比想象快，下次可以用它们做开场热身。'
      : '提前完成的事可以存成短配方，下次别给它留太满。'
  }
  const keep = {
    rosemary: '今天前三步可以留作固定开场。',
    ginger: '保留今天的起势，别把开局改得太重。',
    mint: '这个节奏挺舒服，明天照着来就好。',
    lemon: '保持清爽，不要再加太多说明。',
    garlic: '边界守得住，明天继续集中处理碎事。',
    cilantro: '顺手的入口留住，别过度整理。',
    osmanthus: '今天的余味可以存起来。',
    chili: '劲儿用得准，明天继续只冲关键点。',
  }
  return keep[key] || keep.mint
}

function makeNextPlan({ bartender, isEmptyCup, heaviest, missing, overrun, underrun }) {
  const key = bartenderKey(bartender)
  const main = heaviest?.name || '今天这口'
  if (isEmptyCup) {
    const firstPour = {
      rosemary: ['明天只端一件主线到吧台。', '做完再让小料上桌。'],
      ginger: ['明天先开 10 分钟短火。', '热起来后再接下一口。'],
      mint: ['明天挑一件不费劲的小事。', '旁边留一口喝水和喘气。'],
      lemon: ['明天把入口写短。', '只留一个动作，先做起来。'],
      garlic: ['明天先关掉会打断你的东西。', '只放一件真的要做的事进来。'],
      cilantro: ['明天先挑顺手的一件。', '做完再看下一口。'],
      osmanthus: ['明天温温地开场。', '最后留一句收尾，别急着倒满。'],
      chili: ['明天只冲一件。', '冲完就降温，不连烧。'],
      mint_osmanthus: ['明天先留缓冲。', '再把一件主线慢慢收住。'],
      lemon_chili: ['明天入口切短。', '只给最关键的事点火。'],
    }
    return firstPour[key] || firstPour.mint
  }

  const notes = []
  if (overrun.length) {
    const line = {
      rosemary: `${main}下次多留一格，不要挤坏后面的顺序。`,
      ginger: '烧久的事先切两段，第一段只负责开火。',
      mint: '长任务后面留空白，不要把自己泡到发苦。',
      lemon: '超时的事改成短句，别一口吞下去。',
      garlic: '会拖长的事先挡消息，做完再开门。',
      cilantro: '卡住就换小步走，别跟它硬耗。',
      osmanthus: '慢任务提早上桌，让香气有时间散开。',
      chili: '冲刺只给一件事，其他别跟着烧。',
      mint_osmanthus: '重的事情后面留凉口，收尾慢一点。',
      lemon_chili: '只烧关键那一下，超时就立刻切段。',
    }
    notes.push(line[key] || line.mint)
  }
  if (missing.includes('恢复奶泡')) {
    const rest = {
      rosemary: '主线后必须留缓冲，不然酒单会塌。',
      ginger: '冲完要降温，休息不是偷懒。',
      mint: '把休息写进清单里，别等累透才补。',
      lemon: '加一个短停顿，下一口会更清楚。',
      garlic: '恢复时间也要守住，别让别人拿走。',
      cilantro: '中间塞一口轻的，清单会更好继续。',
      osmanthus: '留一段安静，香气才收得住。',
      chili: '火太密会辣到自己，记得降温。',
      mint_osmanthus: '先凉一口，再继续也来得及。',
      lemon_chili: '点火之后马上喝水，别硬撑。',
    }
    notes.push(rest[key] || rest.mint)
  }
  if (heaviest?.category === 'admin' || heaviest?.category === 'communication') {
    notes.push(key === 'garlic' ? '消息和杂事收进同一盘。' : '碎事集中成一段，不让它们满场跑。')
  }
  if (heaviest?.category === 'deep_work' || heaviest?.category === 'creative') {
    notes.push(key === 'osmanthus' ? '主线慢慢喝，最后留余味。' : '主线保留，后面接一口短休息。')
  }
  if (!overrun.length && underrun.length) {
    notes.push(key === 'ginger' || key === 'chili' ? '快完成的小事可当开场热身。' : '提前完成的事，下次别给太满。')
  }
  if (missing.includes('肉桂封口')) {
    notes.push(key === 'osmanthus' ? '最后留一句漂亮收尾。' : '最后留 5 分钟，把有效做法记住。')
  }
  if (!notes.length) {
    const keep = {
      rosemary: '今天前三步可以留作固定开场。',
      ginger: '保留这个起势，别把开局改重。',
      mint: '这个节奏舒服，明天照着来。',
      lemon: '保持清爽，不再加长说明。',
      garlic: '边界守得住，继续集中处理碎事。',
      cilantro: '顺手的入口留住，别过度整理。',
      osmanthus: '今天的余味可以存起来。',
      chili: '劲儿用得准，继续只冲关键点。',
      mint_osmanthus: '先缓后收，这个手感可以留。',
      lemon_chili: '先醒神再冲刺，这口可以复用。',
    }
    notes.push(keep[key] || keep.mint)
  }
  return [...new Set(notes)].slice(0, 3)
}

function makeBartenderMemoryLine({ bartender, completedCount, heaviest, isEmptyCup }) {
  const key = bartenderKey(bartender)
  if (isEmptyCup) {
    const empty = {
      rosemary: '今晚先不入档，等第一件主线落杯。',
      ginger: '我先记住：你需要一个能立刻开火的入口。',
      mint: '我先记住：明天要从轻一点开始。',
      lemon: '我先记住：下次入口要更短。',
      garlic: '我先记住：先挡打断，再开工。',
      cilantro: '我先记住：别逼太满，先挑顺手的。',
      osmanthus: '我先记住：从温和的小事开始。',
      chili: '我先记住：只点一处火。',
    }
    return empty[key] || empty.mint
  }
  const main = heaviest?.name || '今天的主味'
  const done = completedCount || 0
  const lines = {
    rosemary: `已记住：${main}适合放在前段，今天完成 ${done} 件。`,
    ginger: `已记住：你开局需要一点热度，今天完成 ${done} 件。`,
    mint: `已记住：你需要缓冲跟着主线走，今天完成 ${done} 件。`,
    lemon: `已记住：短入口更适合你，今天完成 ${done} 件。`,
    garlic: `已记住：碎事要集中守门，今天完成 ${done} 件。`,
    cilantro: `已记住：顺手开局比较适合你，今天完成 ${done} 件。`,
    osmanthus: `已记住：温和收尾会让你更容易复刻，今天完成 ${done} 件。`,
    chili: `已记住：关键冲刺有效，但要及时降温，今天完成 ${done} 件。`,
  }
  return lines[key] || lines.mint
}

function makeAgentEvolution({ bartender, completedCount, heaviest, missing, overrun, underrun, timeAccuracy, isEmptyCup }) {
  const key = bartenderKey(bartender)
  const main = heaviest?.name || '今天的主味'
  if (isEmptyCup) {
    return {
      title: '先记一个入口',
      level: 12,
      nextDefault: '明天只放一件小事',
      chips: ['入口', '启动', '轻一点'],
      note: makeBartenderMemoryLine({ bartender, completedCount, heaviest, isEmptyCup }),
    }
  }
  const chips = []
  if (heaviest?.name) chips.push(`${main}优先`)
  if (overrun.length) chips.push('同类加时')
  if (underrun.length) chips.push('缩短预估')
  if (missing.includes('恢复奶泡')) chips.push('补休息')
  if (missing.includes('肉桂封口')) chips.push('补收口')
  if (!chips.length) chips.push('可直接复用')

  const roleLine = {
    rosemary: `下次我会先替${main}留座，杂事晚点上桌。`,
    ginger: `下次我会先给你一个短开火，再接${main}。`,
    mint: `下次我会在${main}后面留一口空白，不让你硬撑。`,
    lemon: `下次我会把入口切短，先让${main}变清楚。`,
    garlic: `下次我会先挡住打断，再让${main}进场。`,
    cilantro: `下次我会先挑顺手的一口，再慢慢加料。`,
    osmanthus: `下次我会把开场放轻，收尾留一点余味。`,
    chili: `下次我会只给关键处点火，做完立刻降温。`,
  }
  return {
    title: '下次少调几步',
    level: Math.min(96, 38 + completedCount * 10 + Math.round(timeAccuracy * 18) + chips.length * 4),
    nextDefault: roleLine[key] || roleLine.mint,
    chips: chips.slice(0, 4),
    note: `已记住 ${completedCount} 个完成样本，下一次会先按这杯的手感排。`,
  }
}

function makeReport({ todos, recipe, records, completionRate, timeAccuracy, isEmptyCup, missing, overrun, underrun, heaviest, bartender }) {
  const completedRecords = records.filter((r) => r.status === 'completed')
  const skippedRecords = records.filter((r) => r.status === 'skipped')
  const delayedRecords = records.filter((r) => r.status === 'delayed')
  const totalEstimated = sumTime(todos)
  const completedEstimated = completedRecords.reduce((sum, r) => {
    const todo = todos.find((t) => t.id === r.todoId)
    return sum + (todo?.estimatedTime || r.estimatedTime || 0)
  }, 0)
  const actualTotal = records.reduce((sum, r) => sum + (r.actualTime || 0), 0)
  const stateProfile = makeStateProfile({ isEmptyCup, completionRate, timeAccuracy, overrun, missing, heaviest })
  const topLayers = recipe.slice(0, 3)
  const score = makeScore({ completionRate, timeAccuracy, recipe, missing, isEmptyCup })
  const flavorTuning = isEmptyCup ? [] : makeFlavorTuning({ recipe, timeAccuracy, completionRate, missing, overrun })
  const completedTodos = completedRecords
    .map((r) => todos.find((t) => t.id === r.todoId))
    .filter(Boolean)
  const evoTips = matchExperiences(recipe, todos).slice(0, 3)
  const topVolumeLayers = getRecipeVolumeLayers(topLayers)
  const specialRecipe = getSpecialRecipe(bartender, recipe, { isEmptyCup, heaviest, missing, overrun })
  const managementRelation = getManagementRelation({
    recipe,
    bartender,
    heaviest,
    missing,
    overrun,
    underrun,
    timeAccuracy,
    completionRate,
    isEmptyCup,
  })

  const blueprintNotes = isEmptyCup
    ? ['今天还没有完成记录。先完成一件很小的事。']
    : topVolumeLayers.map((layer, index) => {
        const role = ROLE_TEXT[layer.category] || '今天有一部分时间放在这里。'
        return `${layer.name} ${layer.volumeLabel}，${role}`
      })

  if (!isEmptyCup && missing.length) {
    blueprintNotes.push(`缺口：${missing.join('、')}不足，说明今天有些状态没有被好好接住。`)
  }

  const nextPlan = makeNextPlan({ bartender, isEmptyCup, heaviest, missing, overrun, underrun })

  return {
    totalEstimated,
    completedEstimated,
    actualTotal,
    completedCount: completedRecords.length,
    skippedCount: skippedRecords.length,
    delayedCount: delayedRecords.length,
    score,
    flavorTuning,
    doneSummary: completedTodos.slice(0, 5).map((t) => ({
      title: t.title,
      minutes: t.estimatedTime || 0,
      type: t.taskType,
    })),
    stateProfile,
    blueprintNotes,
    specialRecipe,
    managementRelation,
    nextPlan: nextPlan.slice(0, 4),
    evoTips,
    bartenderAdvice: makeBartenderAdvice({ bartender, heaviest, missing, overrun, completionRate, timeAccuracy }),
    progressCharts: makeProgressCharts({
      completionRate,
      timeAccuracy,
      completedCount: completedRecords.length,
      totalCount: todos.length,
      evoTips,
      overrun,
      underrun,
      isEmptyCup,
    }),
    habitMemory: makeHabitMemory({
      recipe,
      heaviest,
      missing,
      overrun,
      underrun,
      completedCount: completedRecords.length,
      isEmptyCup,
    }),
    agentEvolution: makeAgentEvolution({
      bartender,
      completedCount: completedRecords.length,
      heaviest,
      missing,
      overrun,
      underrun,
      timeAccuracy,
      isEmptyCup,
    }),
    timeTuning: [...overrun, ...underrun].slice(0, 4).map((r) => {
      const todo = todos.find((t) => t.id === r.todoId)
      const diff = r.actualTime - r.estimatedTime
      return {
        title: todo?.title || '某个任务',
        estimatedTime: r.estimatedTime,
        actualTime: r.actualTime,
        direction: diff > 0 ? 'over' : 'under',
        note: diff > 0
          ? `多用了 ${formatDuration(diff)}，下次先加一点余量。`
          : `少用了 ${formatDuration(Math.abs(diff))}，下次可以调轻一点。`,
      }
    }),
    memory: makeBartenderMemoryLine({
      bartender,
      completedCount: completedRecords.length,
      heaviest,
      isEmptyCup,
    }),
  }
}

// records: [{ todoId, status: completed|delayed|skipped, actualTime, estimatedTime, taskType }]
export function buildReviewCard({ date, todos, ingredients, recipe, bartender, drinkName, records, mode = 'daily', sessionNote = '' }) {
  const total = todos.length || 1
  const done = records.filter((r) => r.status === 'completed').length
  const completionRate = +(done / total).toFixed(2)
  const isEmptyCup = done === 0

  // 时间准确度：实际 vs 预计的接近程度（仅对有实际用时的任务）
  const timed = records.filter((r) => r.actualTime && r.estimatedTime)
  let timeAccuracy = 1
  if (timed.length) {
    const errs = timed.map((r) => Math.abs(r.actualTime - r.estimatedTime) / r.estimatedTime)
    const avgErr = errs.reduce((s, e) => s + e, 0) / errs.length
    timeAccuracy = +Math.max(0, 1 - avgErr).toFixed(2)
  }

  // 完成状态回写口感：未完成/延迟的类别 → 缺失或过浓
  const missing = []
  const recovered = new Set(records.filter((r) => r.status === 'completed').map((r) => r.taskType))
  if (!recovered.has('recovery')) missing.push('恢复奶泡')
  if (!recovered.has('review')) missing.push('肉桂封口')

  const heaviest = recipe[0]
  const overrun = timed.filter((r) => r.actualTime > r.estimatedTime * 1.2)
  const underrun = timed.filter((r) => r.actualTime < r.estimatedTime * 0.75)
  const report = makeReport({ todos, recipe, records, completionRate, timeAccuracy, isEmptyCup, missing, overrun, underrun, heaviest, bartender })

  // 时间偏差洞察：把偏差 > 50% 的任务列出来
  const insights = timed
    .filter((r) => Math.abs(r.actualTime - r.estimatedTime) / r.estimatedTime > 0.5)
    .map((r) => {
      const todo = todos.find((t) => t.id === r.todoId)
      const title = todo?.title || '某任务'
      const diff = r.actualTime - r.estimatedTime
      return diff > 0
        ? `「${title}」预估 ${formatDuration(r.estimatedTime)}，实际用了 ${formatDuration(r.actualTime)}，多花了 ${formatDuration(diff)}。`
        : `「${title}」预估 ${formatDuration(r.estimatedTime)}，实际只用了 ${formatDuration(r.actualTime)}，比想象快。`
    })

  const comment = makeBartenderComment({
    bartender,
    isEmptyCup,
    completionRate,
    heaviest,
    missing,
    overrun,
  })

  const suggestion = makeBartenderSuggestion({
    bartender,
    isEmptyCup,
    missing,
    overrun,
    underrun,
    heaviest,
  })

  return {
    date,
    mode,
    sessionNote,
    drinkName: isEmptyCup ? '空杯' : drinkName || nameDrink(recipe),
    bartender: bartender.name,
    bartenderEmoji: bartender.emoji,
    completionRate,
    timeAccuracy,
    recipe,
    heaviest: isEmptyCup ? '无' : heaviest?.name || '—',
    missing: isEmptyCup ? '整杯还没有原料' : missing.length ? missing.join('、') : '无',
    insights,
    comment,
    suggestion,
    report,
  }
}
