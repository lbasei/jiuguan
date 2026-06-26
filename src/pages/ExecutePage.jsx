// 步骤四：执行 · 代入感。开始一件事 → 小精灵当场摇杯/熬煮 + 计时 → 完成。
// 网页端和桌宠双向同步：桌宠上点击原材料完成，动作会被网页端拉取并记录真实用时。

import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/store.jsx'
import { getBartender } from '../data/bartenders.js'
import PixelSprite from '../components/PixelSprite.jsx'
import { CREATURE } from '../components/sprites.js'
import { BODY } from './BartenderPage.jsx'
import { onPetStatus, startPetSync, stopPetSync, pushPetState, onPetAction } from '../engine/petBridge.js'
import { formatDuration } from '../engine/time.js'

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
  }, []) // eslint-disable-line

  const active = state.order.find((t) => t.id === activeId)
  const durSec = active ? active.estimatedTime * 60 : 0
  const isOverPlan = active ? elapsed > durSec : false

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
    const t = state.order.find((x) => x.id === todoId)
    if (!t) return
    const actualMin = computeActualMin(todoId, completedAt)
    dispatch({ type: 'SET_RECORD', todoId, record: { status: 'completed', actualTime: actualMin, completedAt } })
    lastCompleteTime.current = completedAt

    // 如果当前 active 正好是这个任务，清空 active
    if (activeId === todoId) {
      setActiveId(null)
      setElapsed(0)
      activeStartedAt.current = null
    }

    // 同步下一状态给桌宠
    syncNextState(todoId)
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
    dispatch({ type: 'SET_RECORD', todoId: activeId, record: { status: 'completed', actualTime: min, completedAt } })
    lastCompleteTime.current = completedAt
    setActiveId(null)
    setElapsed(0)
    activeStartedAt.current = null
    syncNextState(id)
  }

  function skip() {
    const id = activeId
    dispatch({ type: 'SET_RECORD', todoId: activeId, record: { status: 'skipped' } })
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
      selected: true,
      customBartender: customPet,
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

  const statusOf = (t) => state.records[t.id]?.status
  const allTouched = state.order.every((t) => statusOf(t))
  const completedCount = state.order.filter((t) => statusOf(t) === 'completed').length
  const hasCompleted = completedCount > 0

  return (
    <div>
      <h2 className="title">精灵调配中</h2>
      <p className="subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        时间表只是酒单。今天先做哪一项，就点哪一项开始计时。
      </p>

      {active && (
        <div className="brew-stage">
          <div className="now">正在调配</div>
          <div className="task">{active.title}</div>
          <div className="brew-sprite">
            {bartender.image ? (
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

      <div className="card">
        <div className="execute-toolbar">
          <div>
            <div className="toolbar-title">实际执行清单</div>
            <div className="muted-note">不用按 1 到 5。计时开始后只记录真实经过的时间。</div>
          </div>
          <button className="btn-primary" disabled={allTouched} onClick={completeAll}>
            一键完成
          </button>
        </div>
        {state.order.map((t, i) => {
          const st = statusOf(t)
          return (
            <div key={t.id} className={`exec-row ${st === 'completed' ? 'done' : ''}`}>
              <span className="idx">{i + 1}</span>
              <div className="et">
                <div className="ettitle">{t.title}</div>
                <span className="muted-note">约 {formatDuration(t.estimatedTime)}</span>
              </div>
              {st === 'completed' ? (
                <span className="tag">完成</span>
              ) : st === 'skipped' ? (
                <span className="muted-note">已跳过</span>
              ) : activeId === t.id ? (
                <span className="muted-note">进行中…</span>
              ) : (
                <button className="btn-ghost" disabled={!!activeId} onClick={() => start(t)}>开始</button>
              )}
            </div>
          )
        })}
      </div>

      <div className="btn-row">
        <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'optimize' })}>← 上一步</button>
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
