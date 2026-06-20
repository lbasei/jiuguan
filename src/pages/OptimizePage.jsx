// 步骤三：小精灵优化。给排序建议 + EvoMap 经验进化 + 可手动拖动调顺序。
// 关键：只谈任务，不暴露原料/茶底/特调——惊喜留到饮品生成页。

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store.jsx'
import { getBartender } from '../data/bartenders.js'
import { adviseManagement } from '../engine/plan.js'
import { matchExperiences } from '../engine/evolve.js'
import { EVOMAP_EXPERIENCES } from '../data/evomap.js'
import { INGREDIENTS } from '../data/ingredients.js'
import { onPetStatus, startPetSync, stopPetSync, pushPetState, onPetAction } from '../engine/petBridge.js'
import { formatDuration } from '../engine/time.js'
import { getIngredientVolume, getRecipeVolumeLayers } from '../engine/recipeVolume.js'

const STRATEGY_LABEL = {
  deep_first: '先点主炉火',
  ignite_first: '先点引火星',
  recovery_buffer: '月光缓冲咒',
  batch_admin: '同盘收纳术',
  light_first: '轻饮开场',
  manual: '你的手写酒单',
}

const EXPERIENCE_LABELS = ['先做最重要的事', '中途留一点缓冲', '把零碎事集中处理']
const EXPERIENCE_EFFECTS = [
  '把最需要脑力的任务放到前面，减少来回切换',
  '在压力大的任务后留一小段恢复时间，不容易半路耗尽',
  '把消息、杂事和小任务放到同一段时间处理',
]

const SECRET_SHAPES = {
  deep_work: 'cut',
  creative: 'drop',
  communication: 'spark',
  admin: 'grain',
  recovery: 'foam',
  urgent: 'flame',
  review: 'leaf',
}

const VISUAL_INGREDIENTS = {
  deep_work: { role: 'base', color: '#7EDFD8', accent: '#DDF9F5', shape: 'tea' },
  communication: { role: 'base', color: '#9DD3FF', accent: '#E6F5FF', shape: 'soda' },
  creative: { role: 'syrup', color: '#FFD978', accent: '#FFF0B8', shape: 'drop' },
  urgent: { role: 'syrup', color: '#FF9FBD', accent: '#FFE0EB', shape: 'flame' },
  recovery: { role: 'foam', color: '#FFF3B8', accent: '#FFFBE6', shape: 'foam' },
  admin: { role: 'garnish', color: '#F8B1D4', accent: '#FFE6F2', shape: 'grain' },
  review: { role: 'garnish', color: '#9BE8B6', accent: '#E7F9EA', shape: 'leaf' },
}

const ACTION = {
  deep_work: '叮…慢熬中',
  creative: '咕嘟…发酵中',
  communication: '滋滋…打气中',
  admin: '哗…速调中',
  recovery: '呼…打发中',
  urgent: '嘶…浓缩中',
  review: '叩…收口中',
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const RHYTHMS = {
  academy: { label: '高校 45/10', focus: 45, rest: 10, note: '适合课程、论文、长题训练' },
  pomodoro: { label: '番茄 25/5', focus: 25, rest: 5, note: '适合启动困难、短任务多' },
  deep: { label: '深酿 60/15', focus: 60, rest: 15, note: '适合深度工作和创作' },
}

const dayStart = 8 * 60 + 30
const moonStart = 18 * 60
const noonStart = 12 * 60
const nightStart = 22 * 60

function clock(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function currentMinuteOfDay() {
  const now = new Date()
  const raw = now.getHours() * 60 + now.getMinutes()
  return Math.ceil(raw / 5) * 5
}

function buildDayPlan(order, rhythmKey, mode = 'daily') {
  const rhythm = RHYTHMS[rhythmKey] || RHYTHMS.academy
  const groups = mode === 'free_time' ? { free: [] } : { dawn: [], noon: [], moon: [], night: [] }
  let cursor = mode === 'free_time' ? currentMinuteOfDay() : dayStart
  let focusBank = 0

  const periodFor = (min) => {
    if (mode === 'free_time') return 'free'
    if (min < noonStart) return 'dawn'
    if (min < moonStart) return 'noon'
    if (min < nightStart) return 'moon'
    return 'night'
  }

  order.forEach((task, index) => {
    const period = periodFor(cursor)
    const duration = Math.max(1, task.estimatedTime || 1)
    groups[period].push({
      type: 'task',
      id: task.id,
      title: task.title,
      start: cursor,
      end: cursor + duration,
      taskType: task.taskType,
      index,
    })
    cursor += duration
    focusBank += duration
    if (focusBank >= rhythm.focus && index < order.length - 1) {
      const breakPeriod = periodFor(cursor)
      groups[breakPeriod].push({
        type: 'break',
        id: `break-${task.id}`,
        title: focusBank >= rhythm.focus * 1.6 ? '去窗边喝水，给魔力回温' : '补一口水，让杯壁降温',
        start: cursor,
        end: cursor + rhythm.rest,
      })
      cursor += rhythm.rest
      focusBank = 0
    }
  })
  return groups
}

export default function OptimizePage() {
  const { state, dispatch } = useStore()
  const selectedBartenderId = state.lockedBartenderId || state.bartenderId
  const bartender = getBartender(selectedBartenderId, state.customBartenders)
  const customPet = state.customBartenders?.find((b) => b.id === selectedBartenderId)
  const matched = useMemo(() => matchExperiences(state.recipe, state.todos), [state.recipe, state.todos])
  const advice = useMemo(() => adviseManagement(state.todos, bartender), [state.todos, bartender])
  const rowRefs = useRef(new Map())
  const prevRects = useRef(null)
  const dragRef = useRef(null)
  const [draggingId, setDraggingId] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [petOn, setPetOn] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [rhythmKey, setRhythmKey] = useState('academy')
  const timer = useRef(null)
  const executeStartTime = useRef(Date.now())
  const lastCompleteTime = useRef(executeStartTime.current)
  const activeStartedAt = useRef(null)
  const consumedActionKeys = useRef(new Set())
  const petBartenderIdRef = useRef(selectedBartenderId)
  const payloadRef = useRef(buildIdlePayload())
  const totalMinutes = useMemo(
    () => state.order.reduce((sum, t) => sum + (t.estimatedTime || 0), 0) || 1,
    [state.order]
  )
  const visualLayers = useMemo(() => {
    const layers = []
    state.order.forEach((t) => {
      const visual = VISUAL_INGREDIENTS[t.taskType] || VISUAL_INGREDIENTS.admin
      const last = layers[layers.length - 1]
      const current = last?.category === t.taskType
        ? last
        : {
        category: t.taskType,
        role: visual.role,
        shape: visual.shape,
        color: visual.color,
        accent: visual.accent,
        minutes: 0,
        count: 0,
      }
      if (current !== last) layers.push(current)
      current.minutes += t.estimatedTime || 0
      current.count += 1
    })
    return layers.map((layer, index) => ({
      ...layer,
      id: `${index}-${layer.category}`,
      ratio: layer.minutes / totalMinutes,
    }))
  }, [state.order, totalMinutes])
  const volumeLayers = useMemo(() => getRecipeVolumeLayers(visualLayers), [visualLayers])
  const active = state.order.find((t) => t.id === activeId)
  const durSec = active ? active.estimatedTime * 60 : 0
  const isOverPlan = active ? elapsed > durSec : false
  const statusOf = (t) => state.records[t.id]?.status
  const allTouched = state.order.every((t) => statusOf(t))
  const completedCount = state.order.filter((t) => statusOf(t) === 'completed').length
  const hasCompleted = completedCount > 0
  const isFreeTimeMode = state.assistantMode === 'free_time'
  const dayPlan = useMemo(() => buildDayPlan(state.order, rhythmKey, state.assistantMode), [state.order, rhythmKey, state.assistantMode])

  useLayoutEffect(() => {
    if (!prevRects.current) return
    rowRefs.current.forEach((el, id) => {
      const before = prevRects.current.get(id)
      if (!before) return
      const after = el.getBoundingClientRect()
      const dy = before.top - after.top
      if (!dy) return
      el.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
        { duration: 300, easing: 'cubic-bezier(.2, .8, .2, 1)' }
      )
    })
    prevRects.current = null
  }, [state.order])

  useEffect(() => onPetStatus(setPetOn), [])

  useEffect(() => {
    executeStartTime.current = Date.now()
    lastCompleteTime.current = executeStartTime.current
    startPetSync(() => payloadRef.current)
    return () => {
      stopPetSync()
      pushPetState({ state: 'idle', bartenderId: petBartenderIdRef.current, selected: true, customBartender: customPet, schedule: buildSchedule() })
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    return onPetAction((action) => {
      if (action.type !== 'complete' || !action.todoId || !action.completedAt) return
      const key = `${action.todoId}-${action.completedAt}`
      if (consumedActionKeys.current.has(key)) return
      consumedActionKeys.current.add(key)
      completeTask(action.todoId, action.completedAt)
    })
  }, []) // eslint-disable-line

  useEffect(() => {
    return onPetAction((action) => {
      if (action.type !== 'finalize') return
      requestFinalize()
    })
  }, [allTouched, hasCompleted, activeId, state.order, state.records]) // eslint-disable-line

  useEffect(() => {
    if (!activeId) return
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(timer.current)
  }, [activeId])

  function buildSchedule() {
    return state.order.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.taskType,
      taskType: t.taskType,
      estimatedTime: t.estimatedTime,
      status: state.records[t.id]?.status || 'pending',
    }))
  }

  function buildIdlePayload() {
    return {
      state: 'idle',
      bartenderId: petBartenderIdRef.current,
      selected: true,
      customBartender: customPet,
      schedule: buildSchedule(),
    }
  }

  function buildDonePayload() {
    return {
      state: 'done',
      bartenderId: petBartenderIdRef.current,
      selected: true,
      customBartender: customPet,
      schedule: buildSchedule(),
    }
  }

  function buildBrewPayload(t) {
    return {
      state: 'brewing',
      bartenderId: petBartenderIdRef.current,
      selected: true,
      customBartender: customPet,
      category: t.taskType,
      title: t.title,
      durationSec: t.estimatedTime * 60,
      schedule: buildSchedule(),
    }
  }

  function computeActualMin(todoId, completedAt) {
    const startedAt = activeId === todoId ? activeStartedAt.current : lastCompleteTime.current
    const ms = completedAt - (startedAt || lastCompleteTime.current)
    return Math.max(1, Math.round(ms / 60000))
  }

  function syncNextState(extraCompletedId) {
    const remaining = state.order.filter((t) => {
      const st = state.records[t.id]?.status
      if (st === 'completed' || st === 'skipped') return false
      if (extraCompletedId && t.id === extraCompletedId) return false
      return true
    })
    payloadRef.current = remaining.length === 0 ? buildDonePayload() : buildIdlePayload()
    pushPetState(payloadRef.current)
  }

  function completeTask(todoId, completedAt) {
    const t = state.order.find((x) => x.id === todoId)
    if (!t) return
    const actualMin = computeActualMin(todoId, completedAt)
    dispatch({ type: 'SET_RECORD', todoId, record: { status: 'completed', actualTime: actualMin, completedAt } })
    lastCompleteTime.current = completedAt
    if (activeId === todoId) {
      setActiveId(null)
      setElapsed(0)
      activeStartedAt.current = null
    }
    syncNextState(todoId)
  }

  function start(t) {
    setActiveId(t.id)
    setElapsed(0)
    activeStartedAt.current = Date.now()
    const p = buildBrewPayload(t)
    payloadRef.current = p
    pushPetState(p)
  }

  function finish(actualMin) {
    const min = actualMin ?? Math.max(1, Math.round(elapsed / 60))
    const completedAt = Date.now()
    const id = activeId
    dispatch({ type: 'SET_RECORD', todoId: id, record: { status: 'completed', actualTime: min, completedAt } })
    lastCompleteTime.current = completedAt
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    syncNextState(id)
  }

  function skip() {
    const id = activeId
    dispatch({ type: 'SET_RECORD', todoId: id, record: { status: 'skipped' } })
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    syncNextState(id)
  }

  function completeAll() {
    const completedAt = Date.now()
    state.order.forEach((t) => {
      const st = state.records[t.id]?.status
      if (st === 'completed' || st === 'skipped') return
      dispatch({
        type: 'SET_RECORD',
        todoId: t.id,
        record: { status: 'completed', actualTime: t.estimatedTime || 1, completedAt },
      })
    })
    lastCompleteTime.current = completedAt
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    payloadRef.current = {
      state: 'done',
      bartenderId: petBartenderIdRef.current,
      customBartender: customPet,
      selected: true,
      schedule: state.order.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.taskType,
        taskType: t.taskType,
        estimatedTime: t.estimatedTime,
        status: state.records[t.id]?.status === 'skipped' ? 'skipped' : 'completed',
      })),
    }
    pushPetState(payloadRef.current)
    setConfirmGenerate(false)
    setTimeout(() => dispatch({ type: 'FINALIZE' }), 0)
  }

  function requestFinalize() {
    if (allTouched && hasCompleted) {
      dispatch({ type: 'FINALIZE' })
      return
    }
    setConfirmGenerate(true)
  }

  function finalizeNow() {
    setConfirmGenerate(false)
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    payloadRef.current = buildDonePayload()
    pushPetState(payloadRef.current)
    dispatch({ type: 'FINALIZE' })
  }

  const captureRects = () => {
    prevRects.current = new Map()
    rowRefs.current.forEach((el, id) => prevRects.current.set(id, el.getBoundingClientRect()))
  }

  const moveItem = (index, dir) => {
    const nextIndex = index + dir
    if (nextIndex < 0 || nextIndex >= state.order.length) return
    captureRects()
    const newOrder = [...state.order]
    ;[newOrder[index], newOrder[nextIndex]] = [newOrder[nextIndex], newOrder[index]]
    dispatch({ type: 'SET_ORDER', order: newOrder })
  }

  const startSwipeSort = (event, id) => {
    if (activeId) return
    if (event.target.closest?.('button')) return
    if (event.button != null && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { id, pointerId: event.pointerId, y: event.clientY }
    setDraggingId(id)
  }

  const moveSwipeSort = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const index = state.order.findIndex((t) => t.id === drag.id)
    if (index === -1) return
    const dy = event.clientY - drag.y
    if (Math.abs(dy) < 24) return
    const dir = dy > 0 ? 1 : -1
    if (index + dir < 0 || index + dir >= state.order.length) return
    drag.y = event.clientY
    moveItem(index, dir)
  }

  const stopSwipeSort = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      dragRef.current = null
      setDraggingId(null)
    }
  }

  const wheelSwipeSort = (event, id) => {
    if (activeId) return
    if (Math.abs(event.deltaY) < 16) return
    event.preventDefault()
    const index = state.order.findIndex((t) => t.id === id)
    if (index === -1) return
    moveItem(index, event.deltaY > 0 ? 1 : -1)
  }

  return (
    <div>
      <h2 className="title">{bartender.name} 今日为你定制的酒单</h2>
      <p className="subtitle">
        当前安排：{STRATEGY_LABEL[state.strategy] || state.strategy}。按住一项上下滑动，确认顺序后可以直接在这里开始调配。
      </p>

      <div className="card order-card">
        <div className="execute-toolbar order-toolbar">
          <div>
            <label className="field">▸ 今日调配清单</label>
          </div>
          <button className="btn-primary" disabled={allTouched} onClick={completeAll}>
            一键完成
          </button>
        </div>

        <div className="order-dashboard">
          <div className="order-blueprint" aria-label="今日酒单比例平面图">
            <div className="panel-title">
              <strong>饮品剖面</strong>
              <span>看今天的任务比例</span>
            </div>
            <div className={`blueprint-glass ${active ? 'is-brewing' : ''}`} aria-hidden="true">
              <div className="blueprint-liquid">
                {volumeLayers.map((layer) => (
                  <span
                    key={layer.id}
                    className={`glass-layer ${layer.role} ${layer.shape}`}
                    style={{
                      '--ingredient-color': layer.color,
                      '--ingredient-accent': layer.accent,
                      '--layer-height': `${layer.heightPercent}%`,
                    }}
                    title={layer.volumeLabel}
                  >
                    <span className="layer-shape" />
                  </span>
                ))}
              </div>
            </div>
            <div className="blueprint-table" aria-hidden="true" />
            {active ? (
              <div className="order-brew-stage">
                <div className="now">正在调配</div>
                <div className="task">{active.title}</div>
                <div className="brew-say">{ACTION[active.taskType] || '调制中'}</div>
                <div className={`brew-timer ${isOverPlan ? 'over-plan' : ''}`}>{mmss(elapsed)}</div>
                <div className="now">{isOverPlan ? '已超出计划，种种会记住这次火候' : `计划 ${formatDuration(active.estimatedTime)}`}</div>
                <div className="brew-actions">
                  <button className="btn-primary" onClick={() => finish()}>做完了 ✓</button>
                  <button className="btn-ghost" onClick={skip}>跳过</button>
                </div>
              </div>
            ) : (
              <div className="blueprint-note">
                先把顺序排好，再点某一项开始。调配时杯子、番茄钟和桌宠会同步进入制作状态。
              </div>
            )}
          </div>

          <div className={`day-plan ${isFreeTimeMode ? 'free-time-plan' : ''}`} aria-label={isFreeTimeMode ? '空闲时间安排' : '今日时间酒谱'}>
            <div className="day-plan-head">
              <div>
                <strong>{isFreeTimeMode ? '这段空闲怎么用' : '今日时间酒谱'}</strong>
                <span>{isFreeTimeMode ? '种种会从现在开始，把这段空档切成能执行的小段。' : RHYTHMS[rhythmKey].note}</span>
              </div>
              {!isFreeTimeMode && <div className="rhythm-switch" role="group" aria-label="选择专注节奏">
                {Object.entries(RHYTHMS).map(([key, rhythm]) => (
                  <button
                    key={key}
                    type="button"
                    className={rhythmKey === key ? 'on' : ''}
                    onClick={() => setRhythmKey(key)}
                  >
                    {rhythm.label}
                  </button>
                ))}
              </div>}
            </div>
            {(isFreeTimeMode
              ? [['free', '现在']]
              : [
                ['dawn', '晨间'],
                ['noon', '午后'],
                ['moon', '星暮'],
                ['night', '夜酿'],
              ]).map(([key, label]) => (
              <div className="day-part" key={key}>
                <div className="day-part-title">{label}</div>
                <div className="time-slots">
                  {dayPlan[key].length ? dayPlan[key].map((slot) => (
                    <div
                      className={`time-slot ${slot.type} ${activeId === slot.id ? 'active' : ''}`}
                      key={slot.id}
                      style={{
                        '--ingredient-color': slot.type === 'task'
                          ? VISUAL_INGREDIENTS[slot.taskType]?.color || '#8FE4DF'
                          : '#F4D66C',
                      }}
                    >
                      <span className="slot-time">{clock(slot.start)}-{clock(slot.end)}</span>
                      <span className="slot-name">{slot.title}</span>
                    </div>
                  )) : (
                    <div className="time-slot empty">
                      <span className="slot-name">这一段先留白，给临时事件和恢复时间。</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="order-main-grid">
          <div className="order-list-panel">
            <div className="panel-title list-title">
              <strong>执行顺序</strong>
              <span>按住上下滑动，或点开始进入调配</span>
            </div>
            {state.order.map((t, i) => {
              const st = statusOf(t)
              return (
                <div
                  key={t.id}
                  className={`exec-row order-row ${draggingId === t.id ? 'swiping' : ''} ${st === 'completed' ? 'done' : ''} ${activeId === t.id ? 'active-brew' : ''}`}
                  ref={(el) => {
                    if (el) rowRefs.current.set(t.id, el)
                    else rowRefs.current.delete(t.id)
                  }}
                  onPointerDown={(event) => startSwipeSort(event, t.id)}
                  onPointerMove={moveSwipeSort}
                  onPointerUp={stopSwipeSort}
                  onPointerCancel={stopSwipeSort}
                  onWheel={(event) => wheelSwipeSort(event, t.id)}
                >
                  <span
                    className={`secret-mark ${SECRET_SHAPES[t.taskType] || 'drop'}`}
                    style={{ '--ingredient-color': VISUAL_INGREDIENTS[t.taskType]?.color || INGREDIENTS[t.taskType]?.color || '#8FE4DF' }}
                    title={`第 ${i + 1} 层神秘原料`}
                    aria-label={`第 ${i + 1} 层神秘原料`}
                  >
                    <span className="secret-shape" aria-hidden="true" />
                  </span>
                  <div className="et">
                    <div className="ettitle">{t.title}</div>
                    <div className="order-mix">
                      <span>
                        第 {i + 1} 层 · 约 {formatDuration(t.estimatedTime)} · 预计入杯{' '}
                        {getIngredientVolume({ category: t.taskType, ratio: (t.estimatedTime || 0) / totalMinutes }).label}
                      </span>
                    </div>
                  </div>
                  {st === 'completed' ? (
                    <span className="tag">完成</span>
                  ) : st === 'skipped' ? (
                    <span className="muted-note">已跳过</span>
                  ) : activeId === t.id ? (
                    <span className="muted-note">调配中…</span>
                  ) : (
                    <button className="btn-ghost row-start" disabled={!!activeId} onClick={(event) => {
                      event.stopPropagation()
                      start(t)
                    }}>
                      开始
                    </button>
                  )}
                  <span className="swipe-grip" aria-hidden="true">⋮⋮</span>
                </div>
              )}
            )}
          </div>

          <aside className="optimization-stack" aria-label="种种优化配方">
            <section className="optimization-panel bartender-advice">
              <label className="field">▸ {bartender.name} 的调配提示</label>
              <div className="comment">{advice.comment}</div>
              {advice.tips.slice(1).map((t, i) => (
                <div className="warn" key={i}>· {t}</div>
              ))}
            </section>

            <section className="optimization-panel evo-panel">
              <div className="panel-title">
                <strong>可选优化配方</strong>
                <span>想让这杯更顺手，就加一种小料</span>
              </div>
              {EVOMAP_EXPERIENCES.map((exp, index) => {
                const absorbed = state.absorbed.includes(exp.id)
                const applicable = matched.some((m) => m.id === exp.id)
                const label = EXPERIENCE_LABELS[index] || `经验方案 ${index + 1}`
                return (
                  <div key={exp.id} className={`evo ${absorbed ? 'absorbed' : ''}`}>
                    <div className="ename">
                      {label} {applicable && !absorbed && <span className="tag">适合今天</span>}
                    </div>
                    <div className="emeta">
                      会怎么帮你：{EXPERIENCE_EFFECTS[index] || exp.effect} · 适合度 {Math.round(exp.confidence * 100)}%
                    </div>
                    <button className="btn-primary" disabled={absorbed} onClick={() => dispatch({ type: 'ABSORB', exp })}>
                      {absorbed ? '已应用 ✓' : '应用这个安排'}
                    </button>
                  </div>
                )
              })}
              {state.absorbed.length > 0 && (
                <p className="muted-note">
                  {bartender.name} 已重新排好顺序：{STRATEGY_LABEL[state.strategy]}。
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'todos' })}>← 重新倾诉</button>
        <div className="spacer" />
        <button className="btn-primary" onClick={requestFinalize}>
          {hasCompleted ? (allTouched ? '生成今日饮品 ✦' : '直接调配成饮品') : '生成空杯报告'}
        </button>
      </div>

      {confirmGenerate && (
        <div className="confirm-panel" role="dialog" aria-modal="true" aria-label="确认直接调配">
          <div className="confirm-card">
            <div className="confirm-title">{hasCompleted ? '还有事项没有完成' : '还没有完成的事项'}</div>
            <p>
              {hasCompleted
                ? '种种可以直接把目前的进度调配成今日饮品。未完成的事项会在最后报告里标为未完成，不会被算作已完成。'
                : '现在杯底还没有完成的心事片段，所以不会生成饮品，只会得到一只空杯和一份未完成报告。'}
            </p>
            <div className="btn-row">
              <button className="btn-ghost" onClick={() => setConfirmGenerate(false)}>再看看清单</button>
              <div className="spacer" />
              <button className="btn-primary" onClick={finalizeNow}>{hasCompleted ? '确认直接调配' : '确认生成空杯'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
