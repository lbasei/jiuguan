// 步骤五：揭晓。第一次展示每件事变成的原料 + 今日特调卡（全程的惊喜在这里收口）。

import { useStore } from '../store/store.jsx'
import SpecialCard from '../components/SpecialCard.jsx'
import IngredientBottle from '../components/IngredientBottle.jsx'

export default function RevealPage() {
  const { state, dispatch } = useStore()
  const card = state.reviewCard
  if (!card) {
    return (
      <div className="card center">
        还没揭晓。
        <div className="btn-row center">
          <button className="btn-primary" onClick={() => dispatch({ type: 'GO', step: 'execute' })}>去执行</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="reveal-banner reveal-in">★ 揭晓 ★<br />你的一天，调成了一杯</div>

      <div className="reveal-in" style={{ animationDelay: '.1s' }}>
        <SpecialCard card={card} />
      </div>

      <div className="card reveal-in" style={{ animationDelay: '.25s' }}>
        <label className="field">▸ 原来每件事都萃成了一种原料</label>
        <div className="grid">
          {state.ingredients.map((ing) => (
            <IngredientBottle key={ing.id} ing={ing} />
          ))}
        </div>
        <p className="muted-note">预计时间决定比例，精力决定浓度，情绪决定风味，完成状态决定口感。</p>
      </div>

      <div className="card">
        <label className="field">▸ 月度 / 年度复盘（概念预览）</label>
        <div className="grid cols2">
          <div className="evo absorbed" style={{ marginBottom: 0 }}>
            <div className="ename">📅 本月配方墙</div>
            <div className="emeta">本月常见原料比例、最常出现的小精灵、本月代表特调。</div>
          </div>
          <div className="evo absorbed" style={{ marginBottom: 0 }}>
            <div className="ename">📖 年度酒馆账本</div>
            <div className="emeta">年度人生配方、主要风味、最常见管理模式、下一年小精灵建议。</div>
          </div>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'execute' })}>← 改执行记录</button>
        <div className="spacer" />
        <button className="btn-primary" onClick={() => dispatch({ type: 'RESET' })}>开新的一天 ↺</button>
      </div>
    </div>
  )
}
