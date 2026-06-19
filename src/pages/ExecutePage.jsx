// 步骤四：执行 · 代入感。开始一件事 → 小精灵当场摇杯/熬煮 + 计时 → 完成。
// 网页端和桌宠双向同步：桌宠上点击原材料完成，动作会被网页端拉取并记录真实用时。

import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/store.jsx'
import { getBartender } from '../data/bartenders.js'
import PixelSprite from '../components/PixelSprite.jsx'
import { CREATURE } from '../components/sprites.js'
import { BODY } from './BartenderPage.jsx'
import { onPetStatus, startPetSync, stopPetSync, pushPetState, onPetAction, startActionPoll, stopActionPoll } from '../engine/petBridge.js'

// 按"调制手法"描述，不点名原料（茶底/奶泡留到揭晓才揭）
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
  const bartender = getBartender(state.bartenderId)
  const [activeId, setActiveId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [petOn, setPetOn] = useState(false)
  const timer = useRef(null)
  const executeStartTime = useRef(Date.now())
  const lastCompleteTime = useRef(executeStartTime.current)
  const consumedActionKeys = useRef(new Set())
  // 桌宠形象一旦进入执行页就固定，不随进化等状态改变而变色
  const petBartenderIdRef = useRef(state.lockedBartenderId || state.bartenderId)

  // 心跳载荷：桌宠任何时候启动都按这个自动同步
  const payloadRef = useRef(buildIdlePayload())

  useEffect(() => onPetStatus(setPetOn), [])

  // 进执行页就开心跳 + 动作轮询；离开时停掉
  useEffect(() => {
    executeStartTime.current = Date.now()
    lastCompleteTime.current = executeStartTime.current
    startPetSync(() => payloadRef.current)
    startActionPoll()
    return () => {
      stopPetSync()
      stopActionPoll()
      pushPetState({ state: 'idle', bartenderId: petBartenderIdRef.current })
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
  const remain = Math.max(0, durSec - elapsed)

  function buildSchedule() {
    return state.order.map((t) => ({
      id: t.id,
      title: t.title,
      estimatedTime: t.estimatedTime,
      status: state.records[t.id]?.status || 'pending',
    }))
  }

  function buildIdlePayload() {
    return {
      state: 'idle',
      bartenderId: petBartenderIdRef.current,
      schedule: buildSchedule(),
    }
  }

  function buildDonePayload() {
    return {
      state: 'done',
      bartenderId: petBartenderIdRef.current,
      schedule: buildSchedule(),
    }
  }

  function buildBrewPayload(t) {
    return {
      state: 'brewing',
      bartenderId: petBartenderIdRef.current,
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

  // 计时归零自动完成（按预计用时）
  useEffect(() => {
    if (activeId && remain === 0 && elapsed > 0) finish(active.estimatedTime)
  }, [remain]) // eslint-disable-line

  function computeActualMin(completedAt) {
    const ms = completedAt - lastCompleteTime.current
    return Math.max(1, Math.round(ms / 60000))
  }

  function completeTask(todoId, completedAt) {
    const t = state.order.find((x) => x.id === todoId)
    if (!t) return
    const actualMin = computeActualMin(completedAt)
    dispatch({ type: 'SET_RECORD', todoId, record: { status: 'completed', actualTime: actualMin, completedAt } })
    lastCompleteTime.current = completedAt

    // 如果当前 active 正好是这个任务，清空 active
    if (activeId === todoId) {
      setActiveId(null)
      setElapsed(0)
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
    syncNextState(id)
  }

  function skip() {
    const id = activeId
    dispatch({ type: 'SET_RECORD', todoId: activeId, record: { status: 'skipped' } })
    setActiveId(null)
    setElapsed(0)
    syncNextState(id)
  }

  const statusOf = (t) => state.records[t.id]?.status
  const allTouched = state.order.every((t) => statusOf(t))

  return (
    <div>
      <h2 className="title">开工 · 让小精灵陪你做</h2>
      <p className="subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        点「开始」，小精灵就当场忙活这件事。
        <span className={`pet-badge ${petOn ? 'on' : ''}`}>{petOn ? '🟢 桌宠已连接' : '⚪ 桌宠未开'}</span>
      </p>

      {active && (
        <div className="brew-stage">
          <div className="now">正在做</div>
          <div className="task">{active.title}</div>
          <div className="brew-sprite">
            <PixelSprite sprite={CREATURE} scale={8} colors={{ b: BODY[state.bartenderId] }} className="sprite-shake" />
          </div>
          <div className="brew-say">{ACTION[active.taskType] || '调制中'}</div>
          <div className="brew-timer">{mmss(remain)}</div>
          <div className="now">预计 {active.estimatedTime} 分钟</div>
          <div className="brew-actions">
            <button className="btn-primary" onClick={() => finish()}>做完了 ✓</button>
            <button className="btn-ghost" onClick={skip}>跳过</button>
          </div>
        </div>
      )}

      <div className="card">
        {state.order.map((t, i) => {
          const st = statusOf(t)
          return (
            <div key={t.id} className={`exec-row ${st === 'completed' ? 'done' : ''}`}>
              <span className="idx">{i + 1}</span>
              <div className="et">
                <div className="ettitle">{t.title}</div>
                <span className="muted-note">约 {t.estimatedTime} 分钟</span>
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
        <button className="btn-primary" onClick={() => dispatch({ type: 'FINALIZE' })} disabled={!allTouched}>
          {allTouched ? '揭晓今日特调 ✦' : '把每件事处理掉再揭晓'}
        </button>
      </div>
    </div>
  )
}
