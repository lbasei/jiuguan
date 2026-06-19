// 步骤二：自然语言倾倒 → 结构化 Todo（可编辑）。

import { useState } from 'react'
import { useStore } from '../store/store.jsx'
import { parseTodosSmart } from '../engine/llm.js'
import { TASK_TYPES } from '../data/ingredients.js'

const SAMPLE =
  '我今天要写完 PRD，晚上还要讨论比赛方案，最好把小精灵设定表整理一下。还有老师那边的信息要回，报销截图也要找一下。其实我有点累，但还是想运动半小时，晚上最好复盘一下今天做了什么。'

export default function TodoPage() {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState('')

  async function parse() {
    const input = text.trim() || SAMPLE
    setLoading(true)
    const res = await parseTodosSmart(input)
    setSource(res.source)
    dispatch({ type: 'SET_TODOS', todos: res.todos })
    setLoading(false)
  }

  const todos = state.todos

  return (
    <div>
      <h2 className="title">把脑子里的事，一股脑倒出来</h2>
      <p className="subtitle">不用先分类，调酒师种种会帮你萃取、估时、调配。</p>

      <div className="card">
        <textarea
          placeholder={SAMPLE}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="btn-row">
          <button className="btn-primary" onClick={parse} disabled={loading}>
            {loading ? '整理中…' : todos.length ? '重新整理' : '整理成待办'}
          </button>
          <button className="btn-ghost" onClick={() => setText(SAMPLE)}>用示例</button>
          {source && (
            <span className="muted-note">
              {source === 'llm' ? '由 AI 解析' : source.includes('fallback') ? 'AI 不可用，已用规则解析' : '规则解析'}
            </span>
          )}
        </div>
      </div>

      {todos.length > 0 && (
        <div className="card">
          <label className="field">共 {todos.length} 条 · 可调整时间和类型</label>
          {todos.map((t) => (
            <div key={t.id} className="exec-row">
              <input
                style={{ flex: 2 }}
                value={t.title}
                onChange={(e) => dispatch({ type: 'UPDATE_TODO', id: t.id, patch: { title: e.target.value } })}
              />
              <input
                className="time"
                type="number"
                value={t.estimatedTime}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_TODO', id: t.id, patch: { estimatedTime: Number(e.target.value) || 0 } })
                }
              />
              <span className="muted-note">分</span>
              <select
                value={t.taskType}
                onChange={(e) => dispatch({ type: 'UPDATE_TODO', id: t.id, patch: { taskType: e.target.value } })}
              >
                {TASK_TYPES.map((tt) => (
                  <option key={tt.value} value={tt.value}>{tt.label}</option>
                ))}
              </select>
              <button className="btn-ghost" onClick={() => dispatch({ type: 'REMOVE_TODO', id: t.id })}>删</button>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'bartender' })}>← 上一步</button>
        <div className="spacer" />
        <button
          className="btn-primary"
          disabled={!todos.length}
          onClick={() => dispatch({ type: 'GO', step: 'optimize' })}
        >
          交给小精灵优化 →
        </button>
      </div>
    </div>
  )
}
