// 步骤一：点兵选秀。左右翻 / 拖动，从初始小精灵列表里直接选一只。不描述、不生成。

import { useState, useRef } from 'react'
import { useStore } from '../store/store.jsx'
import { BARTENDERS } from '../data/bartenders.js'
import PixelSprite from '../components/PixelSprite.jsx'
import { CREATURE } from '../components/sprites.js'

export const BODY = {
  rosemary: '#6F8A5B',
  ginger: '#D98A3D',
  mint: '#7FBFA6',
  garlic: '#E0CFA0',
  cilantro: '#9CC15B',
}

export default function BartenderPage() {
  const { state, dispatch } = useStore()
  const startIdx = Math.max(0, BARTENDERS.findIndex((b) => b.id === state.bartenderId))
  const [idx, setIdx] = useState(startIdx === -1 ? 0 : startIdx)
  const dragX = useRef(null)

  const go = (dir) => {
    setIdx((i) => (i + dir + BARTENDERS.length) % BARTENDERS.length)
  }
  const cur = BARTENDERS[idx]

  // 选中即写入 store（实时），确认按钮只是进下一步
  if (state.bartenderId !== cur.id) dispatch({ type: 'SET_BARTENDER', id: cur.id })

  const onDown = (e) => (dragX.current = e.clientX)
  const onUp = (e) => {
    if (dragX.current == null) return
    const dx = e.clientX - dragX.current
    if (dx > 40) go(-1)
    else if (dx < -40) go(1)
    dragX.current = null
  }

  return (
    <div>
      <h2 className="title">点兵 · 选一只今天的小精灵</h2>
      <p className="subtitle">◀ ▶ 翻阅，或左右拖动。每只是一套管理风格，挑顺眼的那只。</p>

      <div className="picker" onPointerDown={onDown} onPointerUp={onUp}>
        <button className="picker-arrow" onClick={() => go(-1)} aria-label="上一只">◀</button>

        <div className="hero">
          <div className="hero-sprite" style={{ background: '#fff7e6' }}>
            <PixelSprite sprite={CREATURE} scale={11} colors={{ b: BODY[cur.id] }} className="sprite-bob" />
          </div>
          <div className="hero-name">{cur.name}</div>
          <div className="hero-style">{cur.style}</div>
          <div className="hero-fit">适合：{cur.fit}</div>
          <div className="hero-blurb">{cur.blurb}</div>
        </div>

        <button className="picker-arrow" onClick={() => go(1)} aria-label="下一只">▶</button>
      </div>

      <div className="dots">
        {BARTENDERS.map((b, i) => (
          <span
            key={b.id}
            className={`dot ${i === idx ? 'on' : ''}`}
            onClick={() => setIdx(i)}
            style={{ background: i === idx ? BODY[b.id] : undefined }}
          />
        ))}
      </div>

      <div className="btn-row">
        <div className="spacer" />
        <button className="btn-primary" onClick={() => dispatch({ type: 'GO', step: 'todos' })}>
          就召唤 {cur.name} →
        </button>
      </div>
    </div>
  )
}
