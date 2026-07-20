// 步骤三：小精灵优化。给排序建议 + EvoMap 经验进化 + 可手动拖动调顺序。
// 关键：只谈任务，不暴露原料/茶底/特调——惊喜留到饮品生成页。

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store.jsx'
import { getBartender } from '../data/bartenders.js'
import { matchExperiences } from '../engine/evolve.js'
import { EVOMAP_EXPERIENCES } from '../data/evomap.js'
import { INGREDIENTS } from '../data/ingredients.js'
import { onPetStatus, startPetSync, stopPetSync, pushPetState, ensurePetState, onPetAction } from '../engine/petBridge.js'
import { formatDuration } from '../engine/time.js'
import { getRecipeVolumeLayers } from '../engine/recipeVolume.js'
import { canCompleteTask } from '../engine/execution.js'
import { notifyTaskDone } from '../engine/uiSettings.js'

const OPTIMIZATION_PROPS = [
  {
    icon: 'sweet',
    name: '甜一点',
    note: '把最硬的一项拆小一点，入口更顺。',
  },
  {
    icon: 'ice-light',
    name: '少冰',
    note: '减少切换，把零碎事集中到同一段。',
  },
  {
    icon: 'ice-extra',
    name: '多冰',
    note: '在高压任务后加恢复间隔，别让杯子太烫。',
  },
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
const MAX_ESTIMATE_MINUTES = 720

const RHYTHMS = {
  academy: { label: '高校 45/10', focus: 45, rest: 10, note: '适合课程、论文、长题训练' },
  pomodoro: { label: '番茄 25/5', focus: 25, rest: 5, note: '适合启动困难、短任务多' },
  deep: { label: '深酿 60/15', focus: 60, rest: 15, note: '适合深度工作和创作' },
}

const VESSELS = [
  { id: 'highball', label: '长饮杯' },
  { id: 'coupe', label: '鸡尾酒杯' },
  { id: 'wine', label: '红酒杯' },
  { id: 'rocks', label: '方形杯' },
  { id: 'orb', label: '魔法圆杯' },
  { id: 'cake', label: '奶油蛋糕' },
  { id: 'tart', label: '水果塔' },
  { id: 'snack', label: '小食盘' },
]

const LOCKED_VESSELS = [
  { id: 'chalice', label: '星月圣杯', hint: '完成 3 杯后解锁' },
  { id: 'teapot', label: '月光茶壶', hint: '酒馆来访 7 天后解锁' },
  { id: 'crystal', label: '水晶高脚杯', hint: '保存到冰柜后解锁' },
]

const dayStart = 8 * 60 + 30
const moonStart = 18 * 60
const noonStart = 12 * 60
const nightStart = 22 * 60

function clock(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function briefTitle(title = '') {
  const clean = String(title).trim()
  return clean.length > 16 ? `${clean.slice(0, 16)}...` : clean
}

function RecipeTimeAdjuster({ value, label, onChange }) {
  const minutes = Math.max(1, Math.min(MAX_ESTIMATE_MINUTES, Math.round(Number(value || 1))))
  const [draft, setDraft] = useState(String(minutes))

  useEffect(() => {
    setDraft(String(minutes))
  }, [minutes])

  const commit = (nextValue = draft) => {
    const next = Number(nextValue)
    if (!Number.isFinite(next)) {
      setDraft(String(minutes))
      return
    }
    const safe = Math.max(1, Math.min(MAX_ESTIMATE_MINUTES, Math.round(next)))
    setDraft(String(safe))
    onChange(safe)
  }

  const nudge = (delta) => commit(minutes + delta)

  return (
    <div className="recipe-time-adjuster" role="group" aria-label={label}>
      <button type="button" className="recipe-time-step" aria-label="减少一分钟" onClick={() => nudge(-1)}>
        <span />
      </button>
      <label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max={MAX_ESTIMATE_MINUTES}
          step="1"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            if (event.target.value !== '') commit(event.target.value)
          }}
          onBlur={() => commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              nudge(1)
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              nudge(-1)
            }
          }}
        />
        <span>min</span>
      </label>
      <button type="button" className="recipe-time-step plus" aria-label="增加一分钟" onClick={() => nudge(1)}>
        <span />
      </button>
    </div>
  )
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
  const isQuickMode = state.workflowMode !== 'full'
  const selectedBartenderId = state.lockedBartenderId || state.bartenderId
  const bartender = getBartender(selectedBartenderId, state.customBartenders)
  const customPet = state.customBartenders?.find((b) => b.id === selectedBartenderId)
  const matched = useMemo(() => matchExperiences(state.recipe, state.todos), [state.recipe, state.todos])
  const rowRefs = useRef(new Map())
  const prevRects = useRef(null)
  const dragRef = useRef(null)
  const [draggingId, setDraggingId] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [petOn, setPetOn] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [stageMode, setStageMode] = useState(isQuickMode ? 'execute' : 'recipe')
  const [rhythmKey, setRhythmKey] = useState('academy')
  const [sliceView, setSliceView] = useState('simple')
  const [selectedSliceTool, setSelectedSliceTool] = useState('ice')
  const [vesselPanel, setVesselPanel] = useState('')
  const [customVesselName, setCustomVesselName] = useState(state.customVesselLabel || '我的杯子')
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
  const activeBestWindow = active ? Math.max(8, Math.min(45, active.estimatedTime || 15)) : 12
  const statusOf = (t) => state.records[t.id]?.status
  const hasOrder = state.order.length > 0
  const completedCount = state.order.filter((t) => statusOf(t) === 'completed').length
  const hasCompleted = completedCount > 0
  const allCompleted = hasOrder && completedCount === state.order.length
  const canEditRecipe = !isQuickMode && stageMode === 'recipe'
  const nextTask = state.order.find((t) => !statusOf(t))
  const currentTask = active || nextTask
  const currentTaskIndex = currentTask ? state.order.findIndex((t) => t.id === currentTask.id) : -1
  const isFreeTimeMode = state.assistantMode === 'free_time'
  const isSimpleRecipeView = sliceView === 'simple'
  const dayPlan = useMemo(() => buildDayPlan(state.order, rhythmKey, state.assistantMode), [state.order, rhythmKey, state.assistantMode])
  const freeSliceItems = useMemo(() => {
    const slots = Object.values(dayPlan).flat()
    const source = isFreeTimeMode ? slots : state.order.map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      taskType: task.taskType,
      start: 0,
      end: task.estimatedTime || 0,
    }))
    return source.map((slot, index) => ({
      id: slot.id || `slice-${index}`,
      title: slot.title,
      minutes: Math.max(1, (slot.end || 0) - (slot.start || 0)),
      taskType: slot.taskType || (slot.type === 'break' ? 'recovery' : 'admin'),
      type: slot.type,
    }))
  }, [dayPlan, isFreeTimeMode, state.order])
  const flavorCups = useMemo(() => {
    const slots = Object.values(dayPlan).flat()
    const breakMinutes = slots
      .filter((slot) => slot.type === 'break')
      .reduce((sum, slot) => sum + Math.max(0, slot.end - slot.start), 0)
    const taskMinutes = state.order.reduce((sum, task) => sum + (task.estimatedTime || 0), 0) || 1
    const relaxMinutes = state.order
      .filter((task) => task.taskType === 'recovery')
      .reduce((sum, task) => sum + (task.estimatedTime || 0), 0) + breakMinutes
    const playMinutes = state.order
      .filter((task) => task.taskType === 'creative' || task.taskType === 'communication')
      .reduce((sum, task) => sum + (task.estimatedTime || 0), 0)
    const total = Math.max(1, taskMinutes + breakMinutes)
    return [
      {
        key: 'ice',
        title: '去冰 / 冰块',
        label: '放松时间',
        hint: breakMinutes > 0 ? `安排 ${formatDuration(breakMinutes)} 透气提醒` : '给自己留一口透气时间',
        minutes: relaxMinutes,
        percent: Math.max(8, Math.round((relaxMinutes / total) * 100)),
        tone: '#A9E7DE',
      },
      {
        key: 'sugar',
        title: '糖度',
        label: '玩乐时间',
        hint: playMinutes > 0 ? `保留 ${formatDuration(playMinutes)} 小奖励` : '完成后留一点轻松奖励',
        minutes: playMinutes,
        percent: Math.max(8, Math.round((playMinutes / total) * 100)),
        tone: '#FFD98A',
      },
    ]
  }, [dayPlan, state.order])
  const selectedFlavorCup = useMemo(
    () => flavorCups.find((cup) => cup.key === selectedSliceTool) || flavorCups[0],
    [flavorCups, selectedSliceTool]
  )

  useEffect(() => {
    setStageMode('recipe')
  }, [state.todos])

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

  useEffect(() => {
    if (isQuickMode && state.step === 'optimize') {
      dispatch({ type: 'GO', step: 'execute' })
    }
  }, [dispatch, isQuickMode, state.step])

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
  }, [activeId, state.order, state.records]) // eslint-disable-line

  useEffect(() => {
    return onPetAction((action) => {
      if (action.type !== 'start' || !action.todoId) return
      if (activeId) return
      const task = state.order.find((t) => t.id === action.todoId)
      if (!task || statusOf(task)) return
      start(task)
    })
  }, [activeId, state.order, state.records]) // eslint-disable-line

  useEffect(() => {
    return onPetAction((action) => {
      if (action.type !== 'finalize') return
      requestFinalize()
    })
  }, [allCompleted, activeId, state.order, state.records]) // eslint-disable-line

  useEffect(() => {
    return onPetAction((action) => {
      if (action.type !== 'undo' || !action.todoId) return
      undoTask(action.todoId)
    })
  }, [activeId, state.order, state.records]) // eslint-disable-line

  useEffect(() => {
    if (!activeId) return
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(timer.current)
  }, [activeId])

  function buildSchedule(records = state.records) {
    return state.order.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.taskType,
      taskType: t.taskType,
      estimatedTime: t.estimatedTime,
      status: records[t.id]?.status || 'pending',
    }))
  }

  function buildIdlePayload(records = state.records) {
    return {
      state: 'idle',
      bartenderId: petBartenderIdRef.current,
      selected: true,
      customBartender: customPet,
      activeTodoId: activeId || '',
      schedule: buildSchedule(records),
    }
  }

  function buildDonePayload(records = state.records) {
    return {
      state: 'done',
      bartenderId: petBartenderIdRef.current,
      selected: true,
      customBartender: customPet,
      activeTodoId: '',
      schedule: buildSchedule(records),
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
      activeTodoId: t.id,
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
    ensurePetState(payloadRef.current)
  }

  function undoTask(todoId) {
    if (!todoId || activeId) return
    const target = state.order.find((t) => t.id === todoId)
    if (!target || statusOf(target) !== 'completed') return
    const records = { ...state.records }
    delete records[todoId]
    dispatch({ type: 'CLEAR_RECORD', todoId })
    lastCompleteTime.current = Date.now()
    payloadRef.current = buildIdlePayload(records)
    ensurePetState(payloadRef.current)
  }

  function completeTask(todoId, completedAt) {
    if (!canCompleteTask({ activeId, todoId })) return
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
    notifyTaskDone(t.title)
    syncNextState(todoId)
  }

  function checkOffTask(todoId) {
    if (!todoId) return
    const t = state.order.find((x) => x.id === todoId)
    if (!t || statusOf(t)) return
    const completedAt = Date.now()
    const actualMin = activeId === todoId
      ? Math.max(1, Math.round(elapsed / 60))
      : Math.max(1, t.estimatedTime || 1)
    dispatch({
      type: 'SET_RECORD',
      todoId,
      record: {
        status: 'completed',
        actualTime: actualMin,
        completedAt,
        checkedOnly: activeId !== todoId,
      },
    })
    lastCompleteTime.current = completedAt
    if (activeId === todoId) {
      setActiveId(null)
      setElapsed(0)
      activeStartedAt.current = null
    }
    notifyTaskDone(t.title)
    syncNextState(todoId)
  }

  function start(t) {
    setActiveId(t.id)
    setElapsed(0)
    activeStartedAt.current = Date.now()
    const p = buildBrewPayload(t)
    payloadRef.current = p
    ensurePetState(p)
    window.setTimeout(() => {
      document.querySelector('.order-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function finish(actualMin) {
    if (!activeId) return
    const min = actualMin ?? Math.max(1, Math.round(elapsed / 60))
    const completedAt = Date.now()
    const id = activeId
    dispatch({ type: 'SET_RECORD', todoId: id, record: { status: 'completed', actualTime: min, completedAt } })
    lastCompleteTime.current = completedAt
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    notifyTaskDone(state.order.find((t) => t.id === id)?.title)
    syncNextState(id)
  }

  function skip() {
    const id = activeId
    if (!id) return
    dispatch({ type: 'SET_RECORD', todoId: id, record: { status: 'skipped' } })
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    syncNextState(id)
  }

  function requestFinalize() {
    if (!allCompleted) return
    setConfirmGenerate(true)
  }

  function finalizeNow() {
    setConfirmGenerate(false)
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    payloadRef.current = buildDonePayload()
    ensurePetState(payloadRef.current)
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

  const setOrderTime = (todo, minutes) => {
    const next = Math.max(1, Math.min(MAX_ESTIMATE_MINUTES, Math.round(Number(minutes || 1))))
    dispatch({ type: 'UPDATE_TODO', id: todo.id, patch: { estimatedTime: next } })
  }

  const startSwipeSort = (event, id) => {
    if (activeId) return
    if (event.target.closest?.('button, input, textarea, select, a, .recipe-time-adjuster')) return
    const fromHandle = Boolean(event.target.closest?.('.swipe-grip'))
    if (event.button != null && event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      startY: event.clientY,
      y: event.clientY,
      active: fromHandle,
    }
    if (fromHandle) {
      event.preventDefault()
      setDraggingId(id)
    }
  }

  const moveSwipeSort = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const totalDy = event.clientY - drag.startY
    if (!drag.active) {
      if (Math.abs(totalDy) < 34) return
      drag.active = true
      setDraggingId(drag.id)
    }
    event.preventDefault()
    const index = state.order.findIndex((t) => t.id === drag.id)
    if (index === -1) return
    const row = rowRefs.current.get(drag.id)
    const rowHeight = row?.getBoundingClientRect().height || 76
    const threshold = Math.max(72, rowHeight * 0.74)
    const dy = event.clientY - drag.y
    if (Math.abs(dy) < threshold) return
    const dir = dy > 0 ? 1 : -1
    if (index + dir < 0 || index + dir >= state.order.length) return
    drag.y += dir * threshold
    moveItem(index, dir)
  }

  const stopSwipeSort = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      dragRef.current = null
      setDraggingId(null)
    }
  }

  return (
    <div className="optimize-page">
      <h2 className="title optimize-title">{`${bartender.name || '种种'}的今日特调`}</h2>

      <div className={`card order-card ${active ? 'pomodoro-mode' : ''}`}>
        <div className={`order-dashboard ${isQuickMode ? 'quick-dashboard' : ''} ${stageMode === 'execute' ? 'is-execute-stage' : 'is-recipe-stage'} ${active ? 'is-focus-brew' : ''}`}>
          <div className="order-blueprint" aria-label="酒单比例图">
            <div className="panel-title">
              <strong>{active ? '专注调配' : '杯中比例'}</strong>
              <span>{formatDuration(totalMinutes)}</span>
            </div>
            <div className={`blueprint-glass vessel-${state.drinkVessel || 'highball'} ${active ? 'is-brewing' : ''}`} aria-hidden="true">
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
                {bartender.image && (
                  <div className="focus-companion" aria-hidden="true">
                    <img src={bartender.image} alt="" />
                  </div>
                )}
                <div className="now brew-kicker">制作中</div>
                <div className="task">{active.title}</div>
                <div className="brew-say">{ACTION[active.taskType] || '调制中'}</div>
                <div className="brew-clock-block" aria-label="专注倒计时">
                  <span>专注计时</span>
                  <div className={`brew-timer ${isOverPlan ? 'over-plan' : ''}`}>{mmss(elapsed)}</div>
                </div>
                <div className="now">{isOverPlan ? '火候已过，等会儿记进你的口味偏好' : `建议 ${activeBestWindow} 分钟内饮用风味最佳`}</div>
                <div className="brew-actions">
                  <button className="btn-primary" onClick={() => finish()}>做完了 ✓</button>
                  <button className="btn-ghost" onClick={skip}>跳过</button>
                </div>
              </div>
            ) : (
              <div className="blueprint-note">
                {isQuickMode ? '点「开始这一项」。' : stageMode === 'recipe' ? '下方拖动小票排序。' : '开始后会进入专注计时。'}
              </div>
            )}
          </div>

          {canEditRecipe && (
            <div className="recipe-version-tabs recipe-version-tabs-bottom" role="group" aria-label="选择调配版本">
              <button type="button" className={sliceView === 'simple' ? 'on' : ''} onClick={() => setSliceView('simple')}>
                纯享版
              </button>
              <button type="button" className={sliceView === 'full' ? 'on' : ''} onClick={() => setSliceView('full')}>
                定制版
              </button>
            </div>
          )}

          {canEditRecipe && (
            <div className={`drink-orbit recipe-version-panel slice-${sliceView}`} aria-label={isSimpleRecipeView ? '纯享版配方摘要' : '定制版配方选项'}>
              {isSimpleRecipeView ? (
                <div className="simple-slice-card" aria-label="纯享版时间摘要">
                  <div className="simple-slice-head">
                    <strong>{formatDuration(totalMinutes)}</strong>
                    <span>{freeSliceItems.length} 项</span>
                  </div>
                  <div className="simple-slice-summary">
                    <span className="summary-ticket-icon" aria-hidden="true"><i /></span>
                    <div>
                      <strong>先按这张小票开做</strong>
                      <em>顺序和时间都在下方，想改口味再切到定制版。</em>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {isFreeTimeMode && (
                    <>
                      <div className="flavor-cup-row" aria-label="空闲时间配比">
                        {flavorCups.map((cup) => (
                          <button
                            type="button"
                            key={cup.key}
                            className={`flavor-cup ${cup.key} ${selectedSliceTool === cup.key ? 'selected' : ''}`}
                            style={{ '--cup-fill': `${cup.percent}%`, '--cup-tone': cup.tone }}
                            onClick={() => setSelectedSliceTool(cup.key)}
                            aria-pressed={selectedSliceTool === cup.key}
                          >
                            <span className="flavor-vial" aria-hidden="true"><i /></span>
                            <span>
                              <strong>{cup.title}</strong>
                              <em>{cup.label}</em>
                              <small>{selectedSliceTool === cup.key ? cup.hint : `${formatDuration(cup.minutes)} · 点击调整`}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="selected-flavor-note" aria-live="polite">
                        <span aria-hidden="true">{selectedSliceTool === 'ice' ? '◌' : '✦'}</span>
                        <b>{selectedFlavorCup.title}</b>
                        <em>{selectedFlavorCup.hint}</em>
                      </div>
                    </>
                  )}
                  <div className="addon-cup-row" aria-label="可选优化小料">
                    {EVOMAP_EXPERIENCES.map((exp, index) => {
                      const absorbed = state.absorbed.includes(exp.id)
                      const applicable = matched.some((m) => m.id === exp.id)
                      const prop = OPTIMIZATION_PROPS[index] || OPTIMIZATION_PROPS[0]
                      return (
                        <button
                          key={exp.id}
                          type="button"
                          className={`addon-cup ${absorbed ? 'absorbed' : ''} ${applicable && !absorbed ? 'suggested' : ''}`}
                          onClick={(event) => {
                            dispatch(absorbed ? { type: 'UNABSORB', id: exp.id } : { type: 'ABSORB', exp })
                            event.currentTarget.blur()
                          }}
                          aria-pressed={absorbed}
                        >
                          <span className={`evo-prop ${prop.icon}`} aria-hidden="true">
                            <span />
                            <i />
                          </span>
                          <span>
                            <strong>{prop.name}</strong>
                            <em>{absorbed ? '已加入' : applicable ? '推荐' : '可选'}</em>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="vessel-picker" role="group" aria-label="选择今日器皿">
                    {VESSELS.map((vessel) => (
                      <button
                        key={vessel.id}
                        type="button"
                        className={(state.drinkVessel || 'highball') === vessel.id ? 'on' : ''}
                        onClick={() => dispatch({ type: 'SET_VESSEL', vessel: vessel.id })}
                      >
                        <span className={`vessel-icon vessel-${vessel.id}`} aria-hidden="true">
                          <span />
                        </span>
                        <span>{vessel.label}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="vessel-more"
                      onClick={() => setVesselPanel((panel) => (panel === 'more' ? '' : 'more'))}
                    >
                      <span className="vessel-icon vessel-locked" aria-hidden="true">
                        <span />
                      </span>
                      <span>解锁更多</span>
                    </button>
                    <button
                      type="button"
                      className={(state.drinkVessel || 'highball') === 'custom' ? 'on vessel-custom' : 'vessel-custom'}
                      onClick={() => setVesselPanel((panel) => (panel === 'custom' ? '' : 'custom'))}
                    >
                      <span className="vessel-icon vessel-custom-shape" aria-hidden="true">
                        <span />
                      </span>
                      <span>{state.customVesselLabel || '自定义杯'}</span>
                    </button>
                  </div>
                  {vesselPanel && (
                    <div className={`vessel-panel vessel-panel-${vesselPanel}`} aria-live="polite">
                      {vesselPanel === 'more' ? (
                        LOCKED_VESSELS.map((vessel) => (
                          <button key={vessel.id} type="button" className="locked-vessel" disabled>
                            <span className={`vessel-icon vessel-${vessel.id}`} aria-hidden="true"><span /></span>
                            <span>
                              <strong>{vessel.label}</strong>
                              <em>{vessel.hint}</em>
                            </span>
                          </button>
                        ))
                      ) : (
                        <>
                          <label className="custom-vessel-field">
                            <span>给杯子起个名字</span>
                            <input
                              value={customVesselName}
                              maxLength={12}
                              onChange={(event) => setCustomVesselName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return
                                const label = customVesselName.trim() || '我的杯子'
                                dispatch({ type: 'SET_VESSEL', vessel: 'custom', label })
                                setVesselPanel('')
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn-ghost custom-vessel-save"
                            onClick={() => {
                              const label = customVesselName.trim() || '我的杯子'
                              dispatch({ type: 'SET_VESSEL', vessel: 'custom', label })
                              setVesselPanel('')
                            }}
                          >
                            用这只杯子
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {canEditRecipe && <div className="recipe-sort-panel" aria-label="配方层次排序">
            <div className="panel-title mini-title">
              <strong>完整配方</strong>
              <span>拖拽排序 · 可改时间</span>
            </div>
            <div className="recipe-sort-list">
              {state.order.map((t, i) => (
                <div
                  className={`recipe-sort-item ${draggingId === t.id ? 'swiping' : ''}`}
                  key={t.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(t.id, el)
                    else rowRefs.current.delete(t.id)
                  }}
                  onPointerDown={(event) => startSwipeSort(event, t.id)}
                  onPointerMove={moveSwipeSort}
                  onPointerUp={stopSwipeSort}
                  onPointerCancel={stopSwipeSort}
                >
                  <span
                    className={`secret-mark ${SECRET_SHAPES[t.taskType] || 'drop'}`}
                    style={{ '--ingredient-color': VISUAL_INGREDIENTS[t.taskType]?.color || INGREDIENTS[t.taskType]?.color || '#8FE4DF' }}
                    aria-hidden="true"
                  >
                    <span className="secret-shape" />
                  </span>
                  <span className="swipe-grip" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <div>
                    <strong>{String(i + 1).padStart(2, '0')}</strong>
                    <span title={t.title}>{briefTitle(t.title)}</span>
                    <em>{formatDuration(t.estimatedTime)}</em>
                  </div>
                  <RecipeTimeAdjuster
                    value={t.estimatedTime}
                    label={`调整第 ${i + 1} 项时间`}
                    onChange={(minutes) => setOrderTime(t, minutes)}
                  />
                </div>
              ))}
            </div>
            <button className="btn-primary recipe-submit service-bell-action" type="button" disabled={!hasOrder} onClick={() => dispatch({ type: 'GO', step: 'execute' })}>
              <span className="service-bell-icon" aria-hidden="true"><span /><span /><span /></span>
              <strong>交给吧台</strong>
            </button>
          </div>}

          {stageMode === 'execute' && <div className="execute-stage-panel">
          <div className="stage-switcher">
              <span>吧台接单</span>
          </div>

          <div className="order-list-panel">
            <div className="panel-title list-title">
              <strong>现在做这项</strong>
              <span>完成后进入下一项</span>
            </div>
            <div className="single-task-progress" aria-label="任务进度">
              {state.order.map((t, i) => {
                const st = statusOf(t)
                const isCurrent = currentTask?.id === t.id
                return (
                  <span
                    key={t.id}
                    className={`${st === 'completed' ? 'done' : st === 'skipped' ? 'skipped' : ''} ${isCurrent ? 'current' : ''}`}
                    aria-label={`第 ${i + 1} 项${st === 'completed' ? '已完成' : isCurrent ? '进行中' : '待执行'}`}
                  />
                )
              })}
            </div>
            {currentTask ? (
              <div className={`single-task-card ${active ? 'active-brew' : ''}`}>
                <div className="single-task-meta">
                  <span
                    className={`secret-mark ${SECRET_SHAPES[currentTask.taskType] || 'drop'}`}
                    style={{ '--ingredient-color': VISUAL_INGREDIENTS[currentTask.taskType]?.color || INGREDIENTS[currentTask.taskType]?.color || '#8FE4DF' }}
                    title={`第 ${currentTaskIndex + 1} 层神秘原料`}
                    aria-label={`第 ${currentTaskIndex + 1} 层神秘原料`}
                  >
                    <span className="secret-shape" aria-hidden="true" />
                  </span>
                  <span>Step {currentTaskIndex + 1}/{state.order.length}</span>
                </div>
                <div className="single-task-title" title={currentTask.title}>{briefTitle(currentTask.title)}</div>
                <div className="single-task-sub">
                  约 {formatDuration(currentTask.estimatedTime)}
                </div>
                {active ? (
                  <div className="single-task-actions active">
                    <button className="task-complete-check" type="button" onClick={() => finish()}>
                      <span aria-hidden="true" />
                      完成这一项
                    </button>
                    <button className="btn-ghost" type="button" onClick={skip}>跳过</button>
                  </div>
                ) : (
                  <div className="single-task-actions">
                    <button className="btn-primary" type="button" onClick={() => start(currentTask)}>计时专注</button>
                    <button className="task-complete-check quiet-check" type="button" onClick={() => checkOffTask(currentTask.id)}>
                      <span aria-hidden="true" />
                      直接打勾
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="single-task-card done-all">
                <div className="single-task-title">已经调完</div>
                <div className="single-task-sub">可以出杯，未完成的会继续留在记录里。</div>
              </div>
            )}
          </div>

          {canEditRecipe && !isFreeTimeMode && <div className="day-plan" aria-label="今日时间酒谱">
            <div className="day-plan-head">
              <div>
                <strong>时间酒谱</strong>
                <span>{RHYTHMS[rhythmKey].note}</span>
              </div>
              <div className="rhythm-switch" role="group" aria-label="选择专注节奏">
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
              </div>
            </div>
            {[
                ['dawn', '晨间'],
                ['noon', '午后'],
                ['moon', '星暮'],
                ['night', '夜酿'],
              ].map(([key, label]) => (
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
          </div>}
          </div>}
        </div>
      </div>

      <div className="btn-row">
        <button
          className="btn-ghost"
          onClick={() => {
            if (stageMode === 'execute') {
              setStageMode('recipe')
              return
            }
            dispatch({ type: 'GO', step: 'todos' })
          }}
        >
          返回配方
        </button>
        <div className="spacer" />
        <button
          className={`btn-primary result-final-btn ${allCompleted ? 'is-ready' : ''}`}
          disabled={!allCompleted}
          onClick={requestFinalize}
        >
          调配完成
        </button>
      </div>

      {confirmGenerate && (
        <div className="confirm-panel" role="dialog" aria-modal="true" aria-label="确认直接调配">
          <div className="confirm-card">
            <div className="confirm-title">现在出杯？</div>
            <p>
              会进入最终出品页；未完成的事项会留在记录里，不会算作完成。
            </p>
            <div className="btn-row">
              <button className="btn-ghost" onClick={() => setConfirmGenerate(false)}>再看看清单</button>
              <div className="spacer" />
              <button className="btn-primary" onClick={finalizeNow}>确认出杯</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
