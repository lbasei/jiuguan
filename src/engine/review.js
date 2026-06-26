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
    caution: '自由度高的时候，要在最后补一个收口，不然方法很难留进酒柜。',
  },
}

const BARTENDER_REVIEW_VOICES = {
  rosemary: {
    title: '迷迭香把主线留在杯底',
    line: ({ heaviest, overrun }) =>
      overrun.length
        ? `她会把${heaviest?.name || '主线'}往前挪，先做完最重的一口，再让小事排队。`
        : `她认得出今天最稳的味道：${heaviest?.name || '主线'}够清楚，可以留成明天的开场。`,
    actions: ({ missing, overrun }) => [
      overrun.length ? '同类任务预估加 15 分钟' : '明天第一段继续留给主线',
      missing.length ? '最后补一个 5 分钟收口' : '碎事集中到一个时段',
    ],
  },
  ginger: {
    title: '姜种种先点火',
    line: ({ completionRate }) =>
      completionRate < 0.5 ? '他会把第一步切到小到不能再小，先让今天真的动起来。' : '他喜欢今天这种起步速度，下一杯可以继续从短任务热身。',
    actions: ({ overrun }) => [
      '开局只放 10 分钟启动块',
      overrun.length ? '冲刺后马上加短休息' : '完成后立刻接主任务',
    ],
  },
  mint: {
    title: '薄荷种种会先看你累不累',
    line: ({ missing }) =>
      missing.includes('恢复奶泡') ? '她会把休息写进清单里，不让你靠硬撑把整杯喝完。' : '她觉得今天的节奏没有太冲，适合把缓冲继续保留下来。',
    actions: ({ overrun }) => [
      overrun.length ? '长任务后固定休息 10 分钟' : '保留一个喝水或散步点',
      '晚上别再塞新主线',
    ],
  },
  lemon: {
    title: '柠檬种种要入口清楚',
    line: ({ heaviest }) => `她会把${heaviest?.name || '今天的任务'}说短一点，先删掉绕路，再开始。`,
    actions: ({ overrun }) => [
      '每个任务只写一个动词',
      overrun.length ? '超过预估就切下一段' : '先做最清爽的一件',
    ],
  },
  garlic: {
    title: '葱蒜种种守住边界',
    line: ({ heaviest }) =>
      heaviest?.category === 'communication' || heaviest?.category === 'admin'
        ? '她会把消息和杂事挡在同一个盘子里，不让它们一口一口咬走你。'
        : '她觉得今天主线还没被切碎，明天继续把打扰收成一盘。',
    actions: () => ['消息集中两次处理', '深度任务时段不开新入口'],
  },
  cilantro: {
    title: '香菜种种先找顺手入口',
    line: ({ missing }) =>
      missing.length ? '他不会逼你照单全收，会先挑一件顺手的，再提醒你最后收一下尾。' : '他觉得今天的自由度刚好，适合把这个入口记下来。',
    actions: () => ['先做最轻的一件', '结束前留一句复盘'],
  },
  osmanthus: {
    title: '桂花种种慢慢收香',
    line: () => '她会把今天做成不刺眼的节奏：少一点催促，多一点能留香的收尾。',
    actions: () => ['保留温和开场', '把复盘写成一句酒签'],
  },
  chili: {
    title: '辣椒种种只点关键火',
    line: ({ overrun }) =>
      overrun.length ? '它会把火收回来一点，别让整天都变成冲刺。' : '它会把劲儿用在最关键的那一步，别到处乱烧。',
    actions: () => ['只给一件事开冲刺', '冲刺后马上降温'],
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
    points.push('可存酒柜')
  }
  return {
    title: '今天的节奏',
    points: points.slice(0, 3),
  }
}

function makeStateProfile({ isEmptyCup, completionRate, timeAccuracy, overrun, missing, heaviest }) {
  if (isEmptyCup) {
    return {
      title: '空杯状态',
      summary: '今天还没有完成记录。明天只放一件小事，先让杯底有第一层。',
    }
  }
  if (completionRate >= 0.8 && timeAccuracy >= 0.75 && !missing.length) {
    return {
      title: '稳定出杯',
      summary: '完成度和时间感都稳。这个顺序可以存起来，下次直接沿用。',
    }
  }
  if (overrun.length >= 2 || timeAccuracy < 0.55) {
    return {
      title: '时间偏紧',
      summary: '有几件事比预想更久。下次同类任务先加一点余量。',
    }
  }
  if (missing.length) {
    return {
      title: '缺少缓冲',
      summary: `主线是${heaviest?.name || '今天的任务'}，但缓冲不够。明天别把休息放到最后才想起。`,
    }
  }
  return {
    title: '结构成形',
    summary: '今天的顺序已经成形。下一次可以少调几步，直接从这杯开始。',
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
  if (!tuning.length) tuning.push('比例稳定：这杯可以存进酒柜，作为下次的基础配方。')
  return [
    { key: 'concentration', label: '主线压力', value: concentration, target: concentration > 70 ? '需要切小' : '可以保持' },
    { key: 'sweetness', label: '恢复余量', value: sweetness, target: sweetness < 30 ? '要补休息' : '余量够用' },
    { key: 'fizz', label: '碎片干扰', value: fizz, target: fizz > 60 ? '集中处理' : '干扰可控' },
    { key: 'finish', label: '复盘收口', value: finish, target: finish < 35 ? '补 5 分钟' : '收口稳定' },
  ].map((item, index) => ({ ...item, advice: tuning[index] || tuning[0] }))
}

function bartenderKey(bartender = {}) {
  const text = `${bartender.id || ''} ${bartender.plant || ''} ${bartender.name || ''}`.toLowerCase()
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
      note: '空杯不评价，只记一个入口。',
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
    note: `已记住 ${completedCount} 个完成样本。下次会先按这杯的顺序起步。`,
    palette: recipe.slice(0, 4).map((r) => r.color),
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

  const nextPlan = []
  if (isEmptyCup) {
    nextPlan.push('明天只设一个 10 到 15 分钟的启动任务，先让杯底出现第一层。')
  } else {
    if (heaviest?.category === 'admin' || heaviest?.category === 'communication') {
      nextPlan.push('把零散沟通和杂事合并成两个固定时段，别让它们占满整杯。')
    }
    if (heaviest?.category === 'deep_work' || heaviest?.category === 'creative') {
      nextPlan.push('保留今天的主线，但在长任务后面加一段短恢复，避免杯身太浓。')
    }
    if (overrun.length) {
      nextPlan.push('同类任务明天按实际用时多预留 20%，先降低时间估计带来的压力。')
    }
    if (!overrun.length && underrun.length) {
      nextPlan.push('把明显提前完成的任务预估下调一点，别让计划表虚胖；省下的时间留给收口或缓冲。')
    }
    if (missing.includes('恢复奶泡')) {
      nextPlan.push('给明天安排一个明确的回神点，比如散步、整理桌面或短休息。')
    }
    if (missing.includes('肉桂封口')) {
      nextPlan.push('最后留 5 分钟写下今天有效的方法，酒柜里才会留下可复用配方。')
    }
    if (!nextPlan.length) nextPlan.push('维持今天的顺序，把最有效的前三步记成自己的固定调配法。')
  }

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
    timeTuning: [...overrun, ...underrun].slice(0, 4).map((r) => {
      const todo = todos.find((t) => t.id === r.todoId)
      const diff = r.actualTime - r.estimatedTime
      return {
        title: todo?.title || '某个任务',
        estimatedTime: r.estimatedTime,
        actualTime: r.actualTime,
        direction: diff > 0 ? 'over' : 'under',
        note: diff > 0
          ? `比计划多 ${formatDuration(diff)}，下次这类任务要加量。`
          : `比计划少 ${formatDuration(Math.abs(diff))}，下次可以调轻一点。`,
      }
    }),
    memory: isEmptyCup
      ? '空杯也会留下记录：明天先完成一件最小的事。'
      : `${stateProfile.title}：完成 ${completedRecords.length} 件事，主线是${heaviest?.name || '今天的任务'}。`,
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

  let comment = `${bartender.name}：今天完成率 ${Math.round(completionRate * 100)}%。`
  if (isEmptyCup) comment += '还没有真正完成的心事片段被调进杯底，所以这里只是一只空杯。'
  else {
    if (overrun.length) comment += `有任务实际用时明显超预期，${heaviest?.name || '主茶底'}偏浓。`
    if (missing.length) comment += `缺了${missing.join('、')}，整杯偏紧。`
    if (!overrun.length && !missing.length) comment += '结构匀称，是杯耐喝的特调。'
  }

  const suggestion = isEmptyCup
    ? '先挑一件最小的事完成，让明天的杯底有第一层味道。'
    : overrun.length
    ? '明天类似深度任务建议多预留 20% 时间。'
    : missing.includes('恢复奶泡')
    ? '明天在高强度任务后固定加一段恢复缓冲。'
    : '保持今天的节奏，注意复盘收口。'

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
