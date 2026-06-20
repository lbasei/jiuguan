// 今日特调卡（可收藏）。饮品生成页主角，像游戏结算一样展示今日饮品。

import { useState } from 'react'
import RecipeBar from './RecipeBar.jsx'
import { formatDuration } from '../engine/time.js'
import { getRecipeVolumeLayers } from '../engine/recipeVolume.js'
import { shareDrinkPoster } from '../engine/sharePoster.js'

const COOL_CATEGORIES = new Set(['communication', 'review', 'recovery'])
const WARM_CATEGORIES = new Set(['deep_work', 'creative', 'urgent', 'admin'])
const MODE_LABELS = {
  daily: '今日调酒',
  free_time: '空闲小酌',
  long_goal: '长期酿造',
}

function drinkTone(layers) {
  const cool = layers.filter((layer) => COOL_CATEGORIES.has(layer.category)).length
  const warm = layers.filter((layer) => WARM_CATEGORIES.has(layer.category)).length
  if (cool >= Math.max(2, warm + 1)) return 'cool'
  if (warm >= Math.max(2, cool + 1)) return 'warm'
  return 'balanced'
}

function colorMix(hex, mixHex = '#ffffff', amount = 0.28) {
  const clean = hex.replace('#', '')
  const mix = mixHex.replace('#', '')
  const baseRgb = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16))
  const mixRgb = [0, 2, 4].map((i) => parseInt(mix.slice(i, i + 2), 16))
  const rgb = baseRgb.map((value, index) => Math.round(value * (1 - amount) + mixRgb[index] * amount))
  return `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function harmonizeDrink(layers) {
  const tone = drinkTone(layers)
  const palette =
    tone === 'cool'
      ? { garnish: '#9BE8B6', garnishAlt: '#9DD3FF', straw: '#7EDFD8', rim: '#8BCFD2' }
      : tone === 'warm'
        ? { garnish: '#FFD978', garnishAlt: '#F8B1D4', straw: '#FF9FBD', rim: '#EFCB72' }
        : { garnish: '#FFD978', garnishAlt: '#9BE8B6', straw: '#7EDFD8', rim: '#A8CFE0' }
  return {
    tone,
    palette,
    layers: layers.map((layer) => ({
      ...layer,
      visualColor: tone === 'cool' && WARM_CATEGORIES.has(layer.category) ? colorMix(layer.color, '#78B9C8', 0.34) : layer.color,
    })),
  }
}

function ResultDrink({ recipe, isEmptyCup }) {
  const rawLayers = isEmptyCup ? [] : getRecipeVolumeLayers(recipe).slice(0, 5)
  const drink = harmonizeDrink(rawLayers)

  return (
    <div
      className={`result-drink tone-${drink.tone} ${isEmptyCup ? 'is-empty' : ''}`}
      aria-label="今日生成饮品"
      style={{
        '--drink-garnish': drink.palette.garnish,
        '--drink-garnish-alt': drink.palette.garnishAlt,
        '--drink-straw': drink.palette.straw,
        '--drink-rim': drink.palette.rim,
      }}
    >
      <div className="drink-garnish">
        <span />
        <span />
      </div>
      <div className="drink-straw" aria-hidden="true" />
      <div className="drink-glass">
        <div className="drink-liquid">
          {drink.layers.map((layer, index) => (
            <span
              key={layer.category}
              className={`drink-layer layer-${index}`}
              style={{ '--drink-color': layer.visualColor, '--drink-height': `${layer.heightPercent}%` }}
              title={`${layer.name} ${layer.volumeLabel}`}
            >
              <i />
            </span>
          ))}
        </div>
        <div className="drink-ice one" aria-hidden="true" />
        <div className="drink-ice two" aria-hidden="true" />
        <div className="drink-ice three" aria-hidden="true" />
      </div>
      <div className="drink-stem" aria-hidden="true" />
      <div className="drink-foot" aria-hidden="true" />
    </div>
  )
}

function StarRating({ stars = 0 }) {
  return (
    <div className="star-rating" aria-label={`五星评分 ${stars} 星`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < stars ? 'on' : ''} />
      ))}
    </div>
  )
}

function ScoreBreakdown({ parts }) {
  const rows = [
    { label: '完成火候', value: parts?.completion || 0, max: 55 },
    { label: '时间手感', value: parts?.timing || 0, max: 25 },
    { label: '收口余味', value: parts?.balance || 0, max: 20 },
  ]
  return (
    <div className="score-breakdown">
      {rows.map((row) => (
        <div className="score-strip" key={row.label}>
          <span>{row.label}</span>
          <i>
            <b style={{ width: `${Math.round((row.value / row.max) * 100)}%` }} />
          </i>
          <em>{row.value}</em>
        </div>
      ))}
    </div>
  )
}

function ManagementTuning({ items = [] }) {
  if (!items.length) return null
  return (
    <div className="management-tuning" aria-label="下次管理调优">
      <div className="tuning-title">下次怎么排会更顺</div>
      {items.map((item) => (
        <div className={`tuning-row ${item.key}`} key={item.key}>
          <div className="tuning-head">
            <strong>{item.label}</strong>
            <span>{item.target}</span>
          </div>
          <i>
            <b style={{ width: `${item.value}%` }} />
          </i>
          <p>{item.advice}</p>
        </div>
      ))}
    </div>
  )
}

export default function SpecialCard({ card, bartender, reportOpen = false, onGenerateReport }) {
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const isEmptyCup = !card.recipe?.length || card.completionRate === 0
  const report = card.report || {}
  const score = report.score || { total: 0, stars: 0, parts: { completion: 0, timing: 0, balance: 0 } }
  const done = report.doneSummary || []
  const evoTips = report.evoTips || []
  const specialRecipe = report.specialRecipe
  const managementRelation = report.managementRelation
  const generatePoster = async () => {
    if (sharing) return
    setSharing(true)
    setShareMessage('')
    try {
      const result = await shareDrinkPoster(card)
      setShareMessage(result.mode === 'shared' ? '分享面板已打开' : '朋友圈图已下载')
    } catch (error) {
      setShareMessage(error?.name === 'AbortError' ? '已取消分享' : '生成失败，再点一次试试')
    } finally {
      setSharing(false)
    }
  }
  return (
    <div className={`special-card settlement-card ${isEmptyCup ? 'empty-cup-card' : ''} ${reportOpen ? 'report-open' : ''}`}>
      <div className="result-frame">
        <div className="result-kicker">DRINK RESULT</div>
        <div className="result-title">饮品生成</div>
        <div className="result-subtitle">今晚的调配结算单</div>
      </div>

      <ResultDrink recipe={card.recipe || []} isEmptyCup={isEmptyCup} />

      <div className="dname">{card.drinkName}</div>
      <div className="mode-badge">{MODE_LABELS[card.mode] || '今日调酒'}记录</div>
      <div className="bartender-badge-line">
        <span className="bartender-mini">
          {bartender?.image && <img src={bartender.image} alt="" />}
        </span>
        <span>{card.bartender}</span>
      </div>

      <div className="score-board score-board-hero">
        <StarRating stars={score.stars} />
        <div className="score-soft">今日星级 · {score.stars || 0}/5</div>
      </div>

      {!reportOpen && (
        <div className="settlement-actions">
          {!isEmptyCup && (
            <button className="poster-share-btn" type="button" disabled={sharing} onClick={generatePoster}>
              {sharing ? '正在绘制分享卡' : '生成朋友圈图'}
            </button>
          )}
          <button className="btn-primary report-generate" type="button" onClick={onGenerateReport}>
            种种配方揭秘
          </button>
          {shareMessage && <small className="poster-share-status">{shareMessage}</small>}
        </div>
      )}

      {reportOpen && (
        <>
          {!isEmptyCup && (
            <div className="poster-share-row">
              <button className="poster-share-btn" type="button" disabled={sharing} onClick={generatePoster}>
                {sharing ? '正在绘制分享卡' : '生成朋友圈图'}
              </button>
              {shareMessage && <small className="poster-share-status">{shareMessage}</small>}
            </div>
          )}
          <ManagementTuning items={report.flavorTuning} />
          <ScoreBreakdown parts={score.parts} />

      <div className="metrics">
        <div className="m">
          <div className="num">{Math.round(card.completionRate * 100)}%</div>
          <div className="lab">完成率</div>
        </div>
        <div className="m">
          <div className="num">{Math.round(card.timeAccuracy * 100)}%</div>
          <div className="lab">时间准确度</div>
        </div>
        <div className="m">
          <div className="num">{score.parts?.balance ?? 0}</div>
          <div className="lab">收口分</div>
        </div>
      </div>

      <div style={{ margin: '6px 0 14px' }}>
        {isEmptyCup ? (
          <div className="empty-cup-note">杯底还没有完成的心事片段，所以没有形成饮品配方。</div>
        ) : (
          <RecipeBar recipe={card.recipe} />
        )}
      </div>
      {!isEmptyCup && (
        <div className="result-details">
          <div>
            <strong>今日战利品</strong>
            {done.length ? (
              <ul className="loot-grid">
                {done.map((item) => (
                  <li key={item.title}>
                    <i />
                    <span>{item.title}</span>
                    <em>{formatDuration(item.minutes)}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p>还没有完成的片段进入杯中。</p>
            )}
          </div>
          <div>
            <strong>杯身状态</strong>
            <div className="taste-tags">
              <span>主味：{card.heaviest}</span>
              <span>缺口：{card.missing}</span>
            </div>
          </div>
        </div>
      )}

      {specialRecipe && (
        <div className="special-recipe">
          <div className="special-recipe-head">
            <span>种种提取的方案</span>
            {specialRecipe.fit && <em>{specialRecipe.fit}</em>}
          </div>
          <strong>{specialRecipe.title}</strong>
          <p>{specialRecipe.method}</p>
          <small>{specialRecipe.summary}</small>
        </div>
      )}

      {managementRelation?.points?.length > 0 && (
        <div className="method-relation">
          <strong>{managementRelation.title}</strong>
          {managementRelation.points.map((point) => (
            <p key={point}>{point}</p>
          ))}
        </div>
      )}

      {!!evoTips.length && (
        <div className="evo-result">
          <strong>EVO Map 加料槽</strong>
          {evoTips.map((tip) => (
            <div className="evo-chip" key={tip.id}>
              <span>{tip.name}</span>
              <small>{tip.effect} · 匹配度 {Math.round(tip.confidence * 100)}%</small>
            </div>
          ))}
        </div>
      )}

      <div className="warn" style={{ textAlign: 'left' }}>明日加料：{card.suggestion}</div>
        </>
      )}
    </div>
  )
}
