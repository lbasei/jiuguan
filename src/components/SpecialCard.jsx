// 今日特调卡（可收藏）。揭晓页主角，像素酒杯按主原料上色。

import RecipeBar from './RecipeBar.jsx'
import PixelSprite from './PixelSprite.jsx'
import { GLASS } from './sprites.js'

export default function SpecialCard({ card }) {
  const liquid = card.recipe?.[0]?.color || '#C98A3D'
  return (
    <div className="special-card">
      <div className="glass-sprite">
        <PixelSprite sprite={GLASS} scale={8} colors={{ g: liquid }} />
      </div>
      <div className="dname">{card.drinkName}</div>
      <div className="bline">{card.bartenderEmoji} {card.bartender} 出品</div>
      <div className="metrics">
        <div className="m">
          <div className="num">{Math.round(card.completionRate * 100)}%</div>
          <div className="lab">完成率</div>
        </div>
        <div className="m">
          <div className="num">{Math.round(card.timeAccuracy * 100)}%</div>
          <div className="lab">时间准确度</div>
        </div>
      </div>
      <div style={{ margin: '6px 0 14px' }}>
        <RecipeBar recipe={card.recipe} />
      </div>
      <div className="comment" style={{ textAlign: 'left' }}>{card.comment}</div>
      <p className="muted-note" style={{ textAlign: 'left' }}>
        今日最重原料：{card.heaviest} · 缺失原料：{card.missing}
      </p>
      <div className="warn" style={{ textAlign: 'left' }}>明日调配建议：{card.suggestion}</div>
    </div>
  )
}
