// 步骤四：执行 · 代入感。开始一件事 → 小精灵当场摇杯/熬煮 + 计时 → 完成。
// 网页端和桌宠双向同步：桌宠上点击原材料完成，动作会被网页端拉取并记录真实用时。

import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/store.jsx'
import { getBartender } from '../data/bartenders.js'
import PixelSprite from '../components/PixelSprite.jsx'
import SequenceSprite, { shouldPlayHeshui } from '../components/SequenceSprite.jsx'
import { CREATURE } from '../components/sprites.js'
import { BODY } from './BartenderPage.jsx'
import { onPetStatus, startPetSync, stopPetSync, pushPetState, onPetAction } from '../engine/petBridge.js'
import { formatDuration } from '../engine/time.js'
import { canAutoFinalize, canCompleteTask } from '../engine/execution.js'
import { notifyTaskDone } from '../engine/uiSettings.js'

// 按"调制手法"描述，不点名原料（茶底/奶泡留到饮品生成页才展示）
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

const PLAN_TONES = {
  deep_work: '#8FE4DF',
  creative: '#FFD978',
  communication: '#9DD3FF',
  admin: '#F8B1D4',
  recovery: '#FFF3B8',
  urgent: '#FF9FBD',
  review: '#9BE8B6',
  fallback: '#BDEFD0',
}

function currentRoundedMinute() {
  const now = new Date()
  return Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5
}

function clock(min) {
  const safe = ((min % 1440) + 1440) % 1440
  const h = Math.floor(safe / 60)
  const m = safe % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function briefTitle(title = '') {
  const clean = String(title).trim()
  return clean.length > 18 ? `${clean.slice(0, 18)}…` : clean
}

export default function ExecutePage() {
  const { state, dispatch } = useStore()
  const selectedBartenderId = state.lockedBartenderId || state.bartenderId
  const bartender = getBartender(selectedBartenderId, state.customBartenders)
  const customPet = state.customBartenders?.find((b) => b.id === selectedBartenderId)
  const [activeId, setActiveId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [petOn, setPetOn] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const timer = useRef(null)
  const executeStartTime = useRef(Date.now())
  const planStartMinute = useRef(currentRoundedMinute())
  const lastCompleteTime = useRef(executeStartTime.current)
  const activeStartedAt = useRef(null)
  const consumedActionKeys = useRef(new Set())
  // 桌宠形象一旦进入执行页就固定，不随进化等状态改变而变色
  const petBartenderIdRef = useRef(selectedBartenderId)

  // 心跳载荷：桌宠任何时候启动都按这个自动同步
  const payloadRef = useRef(buildIdlePayload())

  useEffect(() => onPetStatus(setPetOn), [])

  // 进执行页就开心跳 + 动作轮询；离开时停掉
  useEffect(() => {
    executeStartTime.current = Date.now()
    lastCompleteTime.current = executeStartTime.current
    startPetSync(() => payloadRef.current)
    return () => {
      stopPetSync()
      pushPetState({ state: 'idle', bartenderId: petBartenderIdRef.current, customBartender: customPet })
    }
  }, []) // eslint-disable-line

  // 监听桌宠点击完成的动作
  useEffect(() => {
    return onPetAction((action) => {
      if (action.type !== 'complete' || !action.todoId || !action.completedAt) return
      const key = `${action.todoId}-${action.completedAt}`
      if (consumedActionKeys.current.has(key)) return
      consumedActionKeys.current.add(key)
      completeTask(action.todoId, action.completedAt)
    })
  }, [state.order, state.records, activeId]) // eslint-disable-line

  useEffect(() => {
    return onPetAction((action) => {
      if (action.type !== 'undo' || !action.todoId) return
      undoTask(action.todoId)
    })
  }, [state.order, state.records, activeId]) // eslint-disable-line

  const active = state.order.find((t) => t.id === activeId)
  const durSec = active ? active.estimatedTime * 60 : 0
  const isOverPlan = active ? elapsed > durSec : false

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
      schedule: buildSchedule(records),
    }
  }

  function buildDonePayload(records = state.records) {
    return {
      state: 'done',
      bartenderId: petBartenderIdRef.current,
      selected: true,
      customBartender: customPet,
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
      schedule: buildSchedule(),
    }
  }

  useEffect(() => {
    if (!activeId) return
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(timer.current)
  }, [activeId])

  function computeActualMin(todoId, completedAt) {
    const startedAt = activeId === todoId ? activeStartedAt.current : lastCompleteTime.current
    const ms = completedAt - (startedAt || lastCompleteTime.current)
    return Math.max(1, Math.round(ms / 60000))
  }

  function completeTask(todoId, completedAt) {
    if (!canCompleteTask({ activeId, todoId })) return
    const t = state.order.find((x) => x.id === todoId)
    if (!t) return
    const actualMin = computeActualMin(todoId, completedAt)
    const nextRecords = {
      ...state.records,
      [todoId]: { ...state.records[todoId], status: 'completed', actualTime: actualMin, completedAt },
    }
    dispatch({ type: 'SET_RECORD', todoId, record: nextRecords[todoId] })
    lastCompleteTime.current = completedAt

    // 如果当前 active 正好是这个任务，清空 active
    if (activeId === todoId) {
      setActiveId(null)
      setElapsed(0)
      activeStartedAt.current = null
    }

    // 同步下一状态给桌宠
    notifyTaskDone(t.title)
    syncNextState(todoId)
    if (canAutoFinalize({ order: state.order, records: nextRecords })) {
      dispatch({ type: 'FINALIZE' })
    }
  }

  function syncNextState(extraCompletedId) {
    const remaining = state.order.filter((t) => {
      const st = state.records[t.id]?.status
      if (st === 'completed' || st === 'skipped') return false
      if (extraCompletedId && t.id === extraCompletedId) return false
      return true
    })
    if (remaining.length === 0) {
      payloadRef.current = buildDonePayload()
    } else {
      payloadRef.current = buildIdlePayload()
    }
    pushPetState(payloadRef.current)
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
    pushPetState(payloadRef.current)
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
    if (!activeId) return
    const min = actualMin ?? Math.max(1, Math.round(elapsed / 60))
    const completedAt = Date.now()
    const id = activeId
    const nextRecords = {
      ...state.records,
      [id]: { ...state.records[id], status: 'completed', actualTime: min, completedAt },
    }
    dispatch({ type: 'SET_RECORD', todoId: id, record: nextRecords[id] })
    lastCompleteTime.current = completedAt
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    notifyTaskDone(state.order.find((t) => t.id === id)?.title)
    syncNextState(id)
    if (canAutoFinalize({ order: state.order, records: nextRecords })) {
      dispatch({ type: 'FINALIZE' })
    }
  }

  function skip() {
    const id = activeId
    if (!id) return
    const nextRecords = {
      ...state.records,
      [id]: { ...state.records[id], status: 'skipped' },
    }
    dispatch({ type: 'SET_RECORD', todoId: id, record: nextRecords[id] })
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    syncNextState(id)
    if (canAutoFinalize({ order: state.order, records: nextRecords })) {
      dispatch({ type: 'FINALIZE' })
    }
  }

  function requestFinalize() {
    if (!hasCompleted) return
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

  const statusOf = (t) => state.records[t.id]?.status
  const completedCount = state.order.filter((t) => statusOf(t) === 'completed').length
  const hasCompleted = completedCount > 0
  const nextTask = state.order.find((t) => !statusOf(t))
  const executionPlan = state.order.reduce((items, task, index) => {
    const start = index === 0 ? planStartMinute.current : items[index - 1].end
    const end = start + Math.max(1, task.estimatedTime || 1)
    items.push({ task, start, end, tone: PLAN_TONES[task.taskType] || PLAN_TONES.fallback })
    return items
  }, [])

  return (
    <div>
      <h2 className="title">精灵调配中</h2>
      <p className="subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        时间表只是酒单，今天先做哪一项，就点哪一项开始计时。
      </p>

      <div className="execution-timetable" aria-label="吧台时间表">
        <div className="timetable-head">
          <strong>吧台时间表</strong>
          <span>{completedCount}/{state.order.length} 完成 · 可跳选</span>
        </div>
        <div className="timetable-track">
          {executionPlan.map(({ task, start: itemStart, end, tone }, index) => {
            const st = statusOf(task)
            const isCurrent = activeId === task.id
            return (
              <button
                key={task.id}
                type="button"
                className={`time-card ${st === 'completed' ? 'done' : st === 'skipped' ? 'skipped' : ''} ${isCurrent ? 'current' : ''}`}
                style={{ '--time-tone': tone }}
                disabled={!!activeId || st === 'completed' || st === 'skipped'}
                onClick={() => start(task)}
                title={activeId ? '先结束当前计时' : st ? '已记录' : '点击开始这一项'}
                aria-label={`第 ${index + 1} 项，${clock(itemStart)} 到 ${clock(end)}，${task.title}`}
              >
                <i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i>
                <span>{clock(itemStart)}-{clock(end)}</span>
                <strong title={task.title}>{briefTitle(task.title)}</strong>
              </button>
            )
          })}
        </div>
      </div>

      {active && (
        <div className="brew-stage">
          <div className="now">正在调配</div>
          <div className="task">{active.title}</div>
          <div className="brew-sprite">
            {shouldPlayHeshui(active.taskType, selectedBartenderId) ? (
              <SequenceSprite
                characterId={selectedBartenderId}
                className="brew-pet-img"
                alt={bartender.name}
                fallbackSrc={bartender.image || ''}
              />
            ) : bartender.image ? (
              <img className="brew-pet-img sprite-shake" src={bartender.image} alt={bartender.name} />
            ) : (
              <PixelSprite sprite={CREATURE} scale={8} colors={{ b: BODY[selectedBartenderId] }} className="sprite-shake" />
            )}
          </div>
          <div className="brew-say">{ACTION[active.taskType] || '调制中'}</div>
          <div className={`brew-timer ${isOverPlan ? 'over-plan' : ''}`}>{mmss(elapsed)}</div>
          <div className="now">{isOverPlan ? '已超出计划，种种会记住这次火候' : `计划 ${formatDuration(active.estimatedTime)}`}</div>
          <div className="brew-actions">
            <button className="btn-primary" onClick={() => finish()}>做完了 ✓</button>
            <button className="btn-ghost" onClick={skip}>跳过</button>
          </div>
        </div>
      )}

      <div className="card execute-compact-card">
        <div className="execute-toolbar compact-final-toolbar">
          <div>
            <div className="toolbar-title">吧台操作台</div>
            <div className="muted-note">点一张时间卡开始。完成后，种种会记下真实用时。</div>
          </div>
        </div>
        <div className={`execute-current-strip ${active ? 'brewing' : ''}`} style={{ '--time-tone': PLAN_TONES[(active || nextTask)?.taskType] || PLAN_TONES.fallback }}>
          <span className="idx">{active ? '▶' : nextTask ? state.order.findIndex((t) => t.id === nextTask.id) + 1 : '✓'}</span>
          <div className="et">
            <div className="ettitle" title={(active || nextTask)?.title || '今日已收工'}>
              {active ? briefTitle(active.title) : nextTask ? briefTitle(nextTask.title) : '今日已收工'}
            </div>
            <span className="muted-note">
              {active ? `计时中 ${mmss(elapsed)}` : nextTask ? `约 ${formatDuration(nextTask.estimatedTime)}` : '可以出杯了'}
            </span>
          </div>
          {active ? (
            <span className="tag">进行中</span>
          ) : nextTask ? (
            <button className="btn-ghost" disabled={!!activeId} onClick={() => start(nextTask)}>开始这一项</button>
          ) : (
            <button className="btn-primary" onClick={requestFinalize}>出杯</button>
          )}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'optimize' })}>上一步</button>
        <div className="spacer" />
        <button className="btn-primary result-final-btn" disabled={!hasCompleted} onClick={requestFinalize}>
          {hasCompleted ? '调配完成' : '完成后出杯'}
        </button>
      </div>

      {confirmGenerate && (
        <div className="confirm-panel" role="dialog" aria-modal="true" aria-label="确认直接调配">
          <div className="confirm-card">
            <div className="confirm-title">现在出杯？</div>
            <p>
              会进入最终出品页；还没打勾的会留在清单里，不会算作完成。
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
