// 配方比例条 + 图例。复用在规划页、进化页、复盘卡。
import { getRecipeVolumeLayers } from '../engine/recipeVolume.js'

export default function RecipeBar({ recipe }) {
  if (!recipe?.length) return null
  const layers = getRecipeVolumeLayers(recipe)
  const totalMl = layers.reduce((sum, layer) => sum + layer.ml, 0) || 1
  return (
    <div>
      <div className="recipe-bar">
        {layers.map((r) => (
          <div
            key={r.category}
            className="seg"
            style={{ width: `${Math.max(4, (r.ml / totalMl) * 100)}%`, background: r.color }}
            title={`${r.name} ${r.volumeLabel}`}
          />
        ))}
      </div>
      <div className="recipe-legend">
        {layers.map((r) => (
          <span className="item" key={r.category}>
            <span className="swatch" style={{ background: r.color }} />
            {r.name} {r.volumeLabel}
          </span>
        ))}
      </div>
    </div>
  )
}
