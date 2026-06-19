// 步骤四：执行 · 代入感。开始一件事 → 小精灵当场摇杯/熬煮 + 计时 → 完成。
// 不再是干巴巴打勾：你能感到自己正处在"做这件事"的区间里。状态同步推给桌宠分身。

import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/store.jsx'
import { getBartender } from '../data/bartenders.js'
import PixelSprite from '../components/PixelSprite.jsx'
import { CREATURE } from '../components/sprites.js'
import { BODY } from './BartenderPage.jsx'
import { petBrew, petIdle, onPetStatus, startPetSync, stopPetSync } from '../engine/petBridge.js'

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
  // 心跳载荷：桌宠任何时候启动都按这个自动同步
  const payloadRef = useRef({ state: 'idle', bartenderId: state.bartenderId })

  useEffect(() => onPetStatus(setPetOn), [])

  // 进执行页就开心跳；离开时停掉并让桌宠回到 idle
  useEffect(() => {
    startPetSync(() => payloadRef.current)
    return () => {
      stopPetSync()
      petIdle(state.bartenderId)
    }
  }, []) // eslint-disable-line

  const active = state.order.find((t) => t.id === activeId)
  const durSec = active ? active.estimatedTime * 60 : 0
  const remain = Math.max(0, durSec - elapsed)

  useEffect(() => {
    if (!activeId) return
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(timer.current)
  }, [activeId])

  // 计时归零自动完成（按预计用时）
  useEffect(() => {
    if (activeId && remain === 0 && elapsed > 0) finish(active.estimatedTime)
  }, [remain]) // eslint-disable-line

  function start(t) {
    setActiveId(t.id)
    setElapsed(0)
    const p = { state: 'brewing', bartenderId: state.bartenderId, category: t.taskType, title: t.title, durationSec: t.estimatedTime * 60 }
    payloadRef.current = p // 心跳载荷
    pushBrew(p)
  }
  function pushBrew(p) {
    petBrew({ bartenderId: p.bartenderId, category: p.category, title: p.title, durationSec: p.durationSec })
  }
  function finish(actualMin) {
    const min = actualMin ?? Math.max(1, Math.round(elapsed / 60))
    dispatch({ type: 'SET_RECORD', todoId: activeId, record: { status: 'completed', actualTime: min } })
    setActiveId(null)
    payloadRef.current = { state: 'idle', bartenderId: state.bartenderId }
    petIdle(state.bartenderId)
  }
  function skip() {
    dispatch({ type: 'SET_RECORD', todoId: activeId, record: { status: 'skipped' } })
    setActiveId(null)
    payloadRef.current = { state: 'idle', bartenderId: state.bartenderId }
    petIdle(state.bartenderId)
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
