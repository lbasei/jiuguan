// 单个原料瓶。瓶内填充高度=比例，颜色=类别，标签=浓度/风味。

const CONC_LABEL = { low: '淡', medium: '适中', high: '浓' }
const FLAVOR_LABEL = { low: '清爽', medium: '复合', high: '浓烈' }

export default function IngredientBottle({ ing }) {
  const fillH = Math.max(15, Math.round(ing.ratio * 100))
  return (
    <div className="bottle">
      <div className="vial">
        <div className="fill" style={{ height: `${fillH}%`, background: ing.color }} />
      </div>
      <div className="meta">
        <div className="iname">
          {ing.emoji} {ing.name}
          <span className="tag">{Math.round(ing.ratio * 100)}%</span>
        </div>
        <div className="isrc">
          来自「{ing.sourceTodo}」 · 浓度{CONC_LABEL[ing.concentration] || '适中'} · 风味
          {FLAVOR_LABEL[ing.flavorStrength] || '复合'}
        </div>
      </div>
    </div>
  )
}
