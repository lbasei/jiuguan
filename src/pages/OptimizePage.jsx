// 步骤三：小精灵优化。给排序建议 + EvoMap 经验进化 + 可手动调顺序。
// 关键：只谈任务，不暴露原料/茶底/特调——惊喜留到揭晓页。

import { useMemo } from 'react'
import { useStore } from '../store/store.jsx'
import { getBartender } from '../data/bartenders.js'
import { matchExperiences } from '../engine/evolve.js'
import { EVOMAP_EXPERIENCES } from '../data/evomap.js'

const STRATEGY_LABEL = {
  deep_first: '硬核任务前置',
  ignite_first: '小任务点火启动',
  recovery_buffer: '高强度后留缓冲',
  batch_admin: '碎事集中处理',
  light_first: '从轻松任务进入',
  manual: '你的手动排序',
}

export default function OptimizePage() {
  const { state, dispatch } = useStore()
  const bartender = getBartender(state.bartenderId)
  // recipe 在后台算好了但不展示，仅用于匹配经验
  const matched = useMemo(() => matchExperiences(state.recipe, state.todos), [state.recipe, state.todos])

  return (
    <div>
      <h2 className="title">{bartender.emoji ? '' : ''}小精灵帮你排今天的顺序</h2>
      <p className="subtitle">{bartender.name} · 当前策略：{STRATEGY_LABEL[state.strategy] || state.strategy}。顺序可以手动调，最终成品先卖个关子。</p>

      <div className="card">
        <label className="field">▸ 推荐执行顺序（▲▼ 手动调）</label>
        {state.order.map((t, i) => (
          <div key={t.id} className="exec-row">
            <span className="idx">{i + 1}</span>
            <div className="et">
              <div className="ettitle">{t.title}</div>
              <span className="muted-note">约 {t.estimatedTime} 分钟</span>
            </div>
            <div className="move-btns">
              <button disabled={i === 0} onClick={() => dispatch({ type: 'MOVE_ORDER', index: i, dir: 'up' })}>▲</button>
              <button disabled={i === state.order.length - 1} onClick={() => dispatch({ type: 'MOVE_ORDER', index: i, dir: 'down' })}>▼</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <label className="field">▸ {bartender.name} 的建议</label>
        <div className="comment">{state.advice.comment}</div>
        {state.advice.tips.slice(1).map((t, i) => (
          <div className="warn" key={i}>· {t}</div>
        ))}
      </div>

      <div className="card">
        <label className="field">▸ EvoMap 经验池 · 吸收相似用户的高成功率打法</label>
        {EVOMAP_EXPERIENCES.map((exp) => {
          const absorbed = state.absorbed.includes(exp.id)
          const applicable = matched.some((m) => m.id === exp.id)
          return (
            <div key={exp.id} className={`evo ${absorbed ? 'absorbed' : ''}`}>
              <div className="ename">
                📜 {exp.name} {applicable && !absorbed && <span className="tag">MATCH</span>}
              </div>
              <div className="emeta">
                适用：{exp.pattern} · 效果：{exp.effect} · 置信度 {Math.round(exp.confidence * 100)}%
              </div>
              <button className="btn-primary" disabled={absorbed} onClick={() => dispatch({ type: 'ABSORB', exp })}>
                {absorbed ? '已吸收 ✓' : '吸收，让小精灵进化'}
              </button>
            </div>
          )
        })}
        {state.absorbed.length > 0 && (
          <p className="muted-note">
            ✦ 小精灵进化了：现在是 {bartender.name}，策略 → {STRATEGY_LABEL[state.strategy]}，上面的执行顺序已经重排。
          </p>
        )}
      </div>

      <div className="btn-row">
        <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'todos' })}>← 改待办</button>
        <div className="spacer" />
        <button className="btn-primary" onClick={() => dispatch({ type: 'GO', step: 'execute' })}>
          就按这个顺序做 →
        </button>
      </div>
    </div>
  )
}
