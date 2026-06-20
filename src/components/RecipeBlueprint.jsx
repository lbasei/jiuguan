import { getIngredientVolume, getRecipeVolumeLayers } from '../engine/recipeVolume.js'

const CONC_LABEL = { low: '低消耗', medium: '中等消耗', high: '高消耗' }
const FLAVOR_LABEL = { low: '轻负担', medium: '中负担', high: '高负担' }

export default function RecipeBlueprint({ ingredients, recipe }) {
  if (!ingredients?.length) return null
  const volumeLayers = getRecipeVolumeLayers(recipe)
  return (
    <div className="blueprint">
      <div className="blueprint-head">
        <div>
          <div className="blueprint-title">饮品剖面图</div>
          <div className="muted-note">每一层按调饮容量换算，小料不会再被撑成整杯。</div>
        </div>
      </div>

      <div className="recipe-plan">
        <div className="recipe-plan-glass" aria-label="今日特调比例杯">
          <div className="recipe-plan-liquid">
            {volumeLayers.map((r) => (
              <span
                className={`recipe-plan-layer layer-${r.category}`}
                key={r.category}
                style={{ '--seg-color': r.color, '--seg-height': `${r.heightPercent}%` }}
              />
            ))}
          </div>
        </div>
        <div className="recipe-plan-list">
          {volumeLayers.map((r, index) => (
            <div className="recipe-plan-item" key={r.category} style={{ '--seg-color': r.color }}>
              <span className="recipe-dot" />
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{r.name}</strong>
              <em>{r.volumeLabel}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="blueprint-grid">
        {ingredients.map((ing, index) => {
          const volume = getIngredientVolume(ing)
          return (
            <div className="blueprint-node" key={ing.id} style={{ '--node-color': ing.color }}>
              <div className="node-top">
                <span className="node-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="node-ratio">{volume.label}</span>
              </div>
              <div className="node-name">
                <span className="node-color-dot" style={{ '--node-color': ing.color }} />
                {ing.name}
              </div>
              <div className="node-source">来自：{ing.sourceTodo}</div>
              <div className="node-meta">
                <span>{CONC_LABEL[ing.concentration] || '中等消耗'}</span>
                <span>{FLAVOR_LABEL[ing.flavorStrength] || '中负担'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
