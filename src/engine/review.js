// 纯函数：日度复盘。根据执行记录生成"今日特调卡"。

import { nameDrink } from './plan.js'
import { matchExperiences } from './evolve.js'
import { formatDuration } from './time.js'
import { getRecipeVolumeLayers } from './recipeVolume.js'

const ROLE_TEXT = {
  deep_work: '杯底主味，代表今天最需要专注推进的部分。',
  creative: '香气层，代表需要构思、表达和主动创造的部分。',
  communication: '气泡层，代表消息、会议和外部协作的流动。',
  admin: '小料层，代表零散事务和需要顺手归整的部分。',
  recovery: '缓冲层，代表休息、运动和把状态接回来的部分。',
  urgent: '辛香层，代表截止、突发和必须立刻处理的部分。',
  review: '收口层，代表复盘、整理和为下一轮留线索的部分。',
}

const BARTENDER_SPECIALS = {
  rosemary: {
    title: '主茶底压舱配方',
    method: '先把最重的主线任务放在杯底，杂事只做收边和点缀。',
    bestWith: ['deep_work', 'urgent'],
    caution: '如果小料太多，迷迭香会把它们压到后段集中处理，避免整杯散味。',
  },
  ginger: {
    title: '十分钟点火配方',
    method: '先倒入一小口能立刻开始的热姜汁，再进入真正的大块任务。',
    bestWith: ['urgent', 'deep_work', 'creative'],
    caution: '适合破冰，不适合把所有事情都做成冲刺；后面要补一点缓冲。',
  },
  mint: {
    title: '薄荷缓冲奶盖',
    method: '高消耗任务之间加一层恢复奶泡，让节奏不被压力直接打穿。',
    bestWith: ['recovery', 'deep_work'],
    caution: '如果主味很浓但没有恢复层，明天需要把休息写进酒单，而不是靠硬扛。',
  },
  lemon: {
    title: '柠檬清醒开场',
    method: '用短而明确的第一步把注意力拧回来，再处理最容易发黏的任务。',
    bestWith: ['urgent', 'communication', 'creative'],
    caution: '酸味能提神，但不适合一直催；超过两段冲刺后要降速。',
  },
  garlic: {
    title: '葱蒜边界盐口',
    method: '把消息、杂事、临时打断集中成固定小料盘，保护整杯的主茶底。',
    bestWith: ['admin', 'communication'],
    caution: '如果杯里全是小料，说明今天不是不努力，而是边界被切碎了。',
  },
  cilantro: {
    title: '香菜随手加料',
    method: '从最轻的一口开始，允许边做边调整顺序，先让杯子动起来。',
    bestWith: ['admin', 'recovery', 'creative'],
    caution: '自由度高的时候，要在最后补一个收口，不然方法很难留进酒柜。',
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
      title: '还没有提取到稳定配方',
      method: '今天还没有完成项入杯，所以种种只能先保留空杯样本。',
      fit: '待验证',
      summary: '先完成一件 10 到 15 分钟的小事，系统才有第一口样本可以提取。',
    }
  }
  const mainLayer = heaviest || recipe[0]
  const secondLayer = recipe.find((layer) => layer.category !== mainLayer?.category)
  const mainRatio = Math.round((mainLayer?.ratio || 0) * 100)
  const secondText = secondLayer ? `，第二层是${secondLayer.name}（${Math.round(secondLayer.ratio * 100)}%）` : ''
  const method = `${bartender.name} 从今天的记录里提取到：${mainLayer?.name || '主味'}占 ${mainRatio}%${secondText}。${EXTRACTED_ACTIONS[mainLayer?.category] || '先把占比最高的任务类型固定成明天的第一段节奏。'}`
  const summary = overrun.length
    ? '下一杯要先调时间火候：同类任务按实际用时多留 20%，别让计划太满。'
    : missing.length
    ? `下一杯要补${missing.join('、')}，让比例不只靠完成任务，也能接住状态。`
    : '这套比例可以先存为基础配方，下次只需要根据临时变化微调顺序和浓度。'
  return {
    title: `${mainLayer?.name || '今日主味'}提取方案`,
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
        '今天没有完成项入杯，所以还不能判断管理方法是否有效。',
        '下一次先做一个 10 到 15 分钟的小任务，让系统有第一口样本。',
      ],
    }
  }
  const categories = new Set(recipe.map((r) => r.category))
  const points = []
  if (heaviest?.category === 'admin' || heaviest?.category === 'communication') {
    points.push('杯身被沟通和杂事占得较多，说明管理重点不是更努力，而是减少切换和集中处理入口。')
  } else if (heaviest?.category === 'deep_work' || heaviest?.category === 'creative') {
    points.push('主味来自深度推进，今天的方法适合做主线任务；要避免后半段因为恢复不足而变苦。')
  } else if (heaviest?.category === 'urgent') {
    points.push('辛香层偏明显，说明今天靠临场冲刺推进；可以保留启动感，但不要让紧急感成为默认节奏。')
  }
  if (!categories.has('recovery')) points.push('杯里缺恢复层，明天建议把休息当成正式原料，而不是等累了再补。')
  if (!categories.has('review')) points.push('缺少收口层，方法很难沉淀到酒柜；最后 5 分钟复盘会让同一杯下次更好调。')
  if (overrun.length || timeAccuracy < 0.65) points.push('时间手感偏松，下一次同类任务的预估可以按实际用时上调 20%。')
  if (!overrun.length && underrun.length) points.push('有些任务比计划更快完成，说明这类原料可以缩短预估，把省下的时间留给恢复或收口。')
  if (completionRate >= 0.8 && timeAccuracy >= 0.75 && !missing.length) {
    points.push('这套顺序和比例已经比较稳定，可以保存成固定饮品，下次直接从酒柜调用。')
  }
  return {
    title: '饮品和方法的关系',
    points: points.slice(0, 3),
  }
}

function makeStateProfile({ isEmptyCup, completionRate, timeAccuracy, overrun, missing, heaviest }) {
  if (isEmptyCup) {
    return {
      title: '空杯状态',
      summary: '今天还没有真正完成的片段进入杯中。先不急着评价好坏，重点是找到一个最容易开始的入口。',
    }
  }
  if (completionRate >= 0.8 && timeAccuracy >= 0.75 && !missing.length) {
    return {
      title: '稳定出杯',
      summary: '完成度和时间感都比较稳，今天的安排有清楚的主线，也留住了收尾。',
    }
  }
  if (overrun.length >= 2 || timeAccuracy < 0.55) {
    return {
      title: '火候偏急',
      summary: '有几件事比预计更耗时，说明今天的杯子不是问题太多，而是时间估计偏乐观。',
    }
  }
  if (missing.length) {
    return {
      title: '缺少缓冲',
      summary: `主味是${heaviest?.name || '今日主料'}，但恢复或复盘不足，容易做完事情之后感觉没有真正落地。`,
    }
  }
  return {
    title: '结构成形',
    summary: '今天的任务已经被调成比较清楚的层次，下一步适合把可复用的方法记下来。',
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
    ? ['杯子仍是空的，所以今天不生成比例分析。先完成一件很小的事，再回来生成第一层味道。']
    : topVolumeLayers.map((layer, index) => {
        const role = ROLE_TEXT[layer.category] || '这一层代表今天被你投入时间的部分。'
        return `${index + 1}. ${layer.name}倒入 ${layer.volumeLabel}。${role}`
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
      ? '今天的酒签：杯子还空着，但吧台已经开灯。明天先完成一件最小的事。'
      : `今天的酒签：${stateProfile.title}。主要味道来自${heaviest?.name || '今日主料'}，完成了 ${completedRecords.length} 件事，适合把这个节奏留作参考。`,
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
