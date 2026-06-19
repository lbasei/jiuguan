// 配方比例条 + 图例。复用在规划页、进化页、复盘卡。

export default function RecipeBar({ recipe }) {
  if (!recipe?.length) return null
  return (
    <div>
      <div className="recipe-bar">
        {recipe.map((r) => (
          <div
            key={r.category}
            className="seg"
            style={{ width: `${Math.round(r.ratio * 100)}%`, background: r.color }}
            title={`${r.name} ${Math.round(r.ratio * 100)}%`}
          />
        ))}
      </div>
      <div className="recipe-legend">
        {recipe.map((r) => (
          <span className="item" key={r.category}>
            <span className="swatch" style={{ background: r.color }} />
            {r.emoji} {r.name} {Math.round(r.ratio * 100)}%
          </span>
        ))}
      </div>
    </div>
  )
}
