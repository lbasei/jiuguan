// 今日特调卡（可收藏）。饮品生成页主角，像游戏结算一样展示今日饮品。

import { useEffect, useState } from 'react'
import RecipeBar from './RecipeBar.jsx'
import { formatDuration } from '../engine/time.js'
import { getRecipeVolumeLayers } from '../engine/recipeVolume.js'
import { shareDrinkPoster } from '../engine/sharePoster.js'
import { generateDrinkPixelCard } from '../engine/imageGen.js'

const COOL_CATEGORIES = new Set(['communication', 'review', 'recovery'])
const WARM_CATEGORIES = new Set(['deep_work', 'creative', 'urgent', 'admin'])
const DESSERT_VESSELS = new Set(['cake', 'tart', 'snack'])
const CELEBRATION_PIECES = [
  { x: '16%', y: '42%', dx: '-48px', dy: '-118px', color: '#FFE76A', delay: '0ms', rotate: '-18deg' },
  { x: '24%', y: '58%', dx: '-28px', dy: '-138px', color: '#8FE4DF', delay: '60ms', rotate: '24deg' },
  { x: '36%', y: '34%', dx: '-12px', dy: '-124px', color: '#FFC7DB', delay: '120ms', rotate: '52deg' },
  { x: '48%', y: '48%', dx: '2px', dy: '-148px', color: '#FFF3C4', delay: '30ms', rotate: '-42deg' },
  { x: '58%', y: '36%', dx: '18px', dy: '-132px', color: '#BDEFD0', delay: '150ms', rotate: '18deg' },
  { x: '70%', y: '54%', dx: '42px', dy: '-126px', color: '#FFE29A', delay: '80ms', rotate: '-28deg' },
  { x: '82%', y: '44%', dx: '54px', dy: '-112px', color: '#F8AFC8', delay: '170ms', rotate: '38deg' },
  { x: '31%', y: '70%', dx: '-34px', dy: '-92px', color: '#A8DDE6', delay: '220ms', rotate: '8deg' },
  { x: '64%', y: '70%', dx: '34px', dy: '-96px', color: '#FFD84A', delay: '260ms', rotate: '-12deg' },
]

function honorific(profile = {}) {
  if (profile.gender === 'male') return '先生'
  if (profile.gender === 'female') return '小姐'
  return '旅人'
}

function guestLine(profile = {}) {
  const place = profile.locationLabel || profile.locationName || '远方'
  const name = profile.name || profile.displayName || '无名'
  return `来自${place}的${name}${honorific(profile)}`
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
      ? { garnish: '#BDEFD0', garnishAlt: '#BFE8FF', straw: '#8FE4DF', rim: '#9AD7DA', wash: '#DFF7F3' }
      : tone === 'warm'
        ? { garnish: '#FFE29A', garnishAlt: '#FFC7DB', straw: '#F8AFC8', rim: '#EFD48D', wash: '#FFF1C7' }
        : { garnish: '#FFE29A', garnishAlt: '#BDEFD0', straw: '#8FE4DF', rim: '#A8DDE6', wash: '#EAF8F8' }
  return {
    tone,
    palette,
    layers: layers.map((layer) => ({
      ...layer,
      visualColor: colorMix(
        tone === 'cool' && WARM_CATEGORIES.has(layer.category) ? colorMix(layer.color, '#78B9C8', 0.28) : layer.color,
        palette.wash,
        0.42,
      ),
    })),
  }
}

function drinkDecor(recipe = []) {
  const cats = new Set(recipe.map((item) => item.category))
  if (cats.has('recovery')) return 'pearls'
  if (cats.has('creative')) return 'flowers'
  if (cats.has('review')) return 'leaves'
  return 'sparkles'
}

function bartenderGarnish(bartender = {}) {
  const key = `${bartender.id || ''} ${bartender.plant || ''} ${bartender.name || ''}`.toLowerCase()
  if (/mint|薄荷/.test(key)) return 'mint'
  if (/garlic|葱|蒜/.test(key)) return 'garlic'
  if (/ginger|姜/.test(key)) return 'ginger'
  if (/cilantro|香菜/.test(key)) return 'cilantro'
  if (/osmanthus|桂花/.test(key)) return 'osmanthus'
  if (/chili|pepper|辣椒/.test(key)) return 'chili'
  if (/lemon|柠檬/.test(key)) return 'lemon'
  if (/rosemary|迷迭香/.test(key)) return 'rosemary'
  return 'spark'
}

function ResultDrink({ recipe, isEmptyCup, vessel = 'highball', bartender }) {
  const rawLayers = isEmptyCup ? [] : getRecipeVolumeLayers(recipe).slice(0, 5)
  const drink = harmonizeDrink(rawLayers)
  const decor = drinkDecor(recipe)
  const garnish = bartenderGarnish(bartender)
  const isDessert = DESSERT_VESSELS.has(vessel)

  return (
    <div className={`result-stage decor-${decor}`}>
      <span className="stage-ornament o1" aria-hidden="true" />
      <span className="stage-ornament o2" aria-hidden="true" />
      <span className="stage-ornament o3" aria-hidden="true" />
      <span className="stage-ornament o4" aria-hidden="true" />
      <div
        className={`result-drink tone-${drink.tone} vessel-${vessel} ${isDessert ? 'is-dessert' : ''} garnish-${garnish} ${isEmptyCup ? 'is-empty' : ''}`}
        aria-label={isDessert ? '今日生成甜品' : '今日生成饮品'}
        style={{
          '--drink-garnish': drink.palette.garnish,
          '--drink-garnish-alt': drink.palette.garnishAlt,
          '--drink-straw': drink.palette.straw,
          '--drink-rim': drink.palette.rim,
        }}
      >
        <div className="drink-garnish" aria-hidden="true">
          <span className="garnish-main" />
          <span className="garnish-accent" />
          <span className="garnish-extra" />
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
        {!isDessert && (
          <>
            <div className="drink-stem" aria-hidden="true" />
            <div className="drink-foot" aria-hidden="true" />
          </>
        )}
      </div>
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

function AdditiveCup({ tip, index }) {
  const tones = ['mint', 'gold', 'pink']
  const fill = Math.max(24, Math.min(92, Math.round((tip.confidence || 0.5) * 100)))
  return (
    <div className={`additive-cup ${tones[index % tones.length]}`} style={{ '--fill': `${fill}%` }}>
      <i aria-hidden="true">
        <b />
      </i>
      <span>{tip.name}</span>
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
      <div className="tuning-title">下次微调</div>
      {items.slice(0, 2).map((item) => (
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

function MethodRelationChart({ relation }) {
  const points = relation?.points || []
  if (!points.length) return null
  const icons = ['base', 'time', 'rest']
  return (
    <div className="method-chart" aria-label={relation.title}>
      <div className="chart-title">{relation.title}</div>
      <div className="chart-lanes">
        {points.slice(0, 3).map((point, index) => (
          <div className={`chart-lane ${icons[index]}`} key={point}>
            <i />
            <span>{point}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SpecialRecipeBadge({ recipe }) {
  if (!recipe) return null
  return (
    <div className="special-badge">
      <i aria-hidden="true" />
      <div>
        <span>{recipe.title}</span>
        {recipe.fit && <em>{recipe.fit}</em>}
      </div>
    </div>
  )
}

function ReviewGaugeBoard({ charts = [] }) {
  if (!charts.length) return null
  return (
    <div className="review-gauge-board" aria-label="今日复盘图表">
      {charts.map((chart) => (
        <div className={`review-gauge tone-${chart.tone || 'mint'}`} key={chart.key}>
          <div>
            <strong>{chart.value}%</strong>
            <span>{chart.label}</span>
          </div>
          <i>
            <b style={{ '--value': `${chart.value}%` }} />
          </i>
          <em>{chart.detail}</em>
        </div>
      ))}
    </div>
  )
}

function BartenderAdviceCard({ advice, bartender }) {
  if (!advice) return null
  return (
    <div className="bartender-advice-card">
      <span className="advice-avatar" aria-hidden="true">
        {bartender?.image && <img src={bartender.image} alt="" />}
      </span>
      <div>
        <strong>{advice.title}</strong>
        <p>{advice.line}</p>
        <div className="advice-actions">
          {(advice.actions || []).map((action) => (
            <span key={action}>{action}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function HabitMemoryCard({ memory }) {
  if (!memory) return null
  return (
    <div className="habit-memory-card">
      <div className="habit-palette" aria-hidden="true">
        {(memory.palette?.length ? memory.palette : ['#8FE4DF', '#FFF3C4', '#F8AFC8']).map((color, index) => (
          <span key={`${color}-${index}`} style={{ background: color }} />
        ))}
      </div>
      <div>
        <strong>{memory.title}</strong>
        <div className="habit-chips">
          {(memory.chips || []).map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
        <p>{memory.note}</p>
      </div>
    </div>
  )
}

function AgentEvolutionCard({ evolution }) {
  if (!evolution) return null
  return (
    <div className="agent-evolution-card">
      <div className="evolution-vial" style={{ '--evo': `${evolution.level || 0}%` }} aria-hidden="true">
        <b />
      </div>
      <div>
        <strong>{evolution.title}</strong>
        <p>{evolution.nextDefault}</p>
        <div className="evolution-chips">
          {(evolution.chips || []).map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
        <small>{evolution.note}</small>
      </div>
    </div>
  )
}

export default function SpecialCard({ card, bartender, reportOpen = false, onGenerateReport }) {
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [pixelCardUrl, setPixelCardUrl] = useState('')
  const [pixelCardStatus, setPixelCardStatus] = useState('')
  const isEmptyCup = !card.recipe?.length || card.completionRate === 0
  const report = card.report || {}
  const score = report.score || { total: 0, stars: 0, parts: { completion: 0, timing: 0, balance: 0 } }
  const done = report.doneSummary || []
  const evoTips = report.evoTips || []
  const profile = card.userProfile || {}
  const productType = DESSERT_VESSELS.has(card.vessel) ? '甜点' : '特调'
  const isDessertCard = DESSERT_VESSELS.has(card.vessel)
  const preparingText = isDessertCard ? '正在备甜' : '正在备酒'
  const inviteText = isDessertCard ? '请朋友吃一口' : '请朋友喝一杯'
  const generatePoster = async () => {
    if (sharing) return
    setSharing(true)
    setShareMessage('')
    try {
      if (pixelCardUrl) {
        const res = await fetch(pixelCardUrl)
        const blob = await res.blob()
        const file = new File([blob], `life-kitchen-${Date.now()}.png`, { type: blob.type || 'image/png' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: card.drinkName || 'Life Kitchen 今日特调',
            text: '我的今日管理饮品出杯了。',
          })
          setShareMessage('已经递出邀请')
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = file.name
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
          setShareMessage('请客卡已备好')
        }
        return
      }
      const result = await shareDrinkPoster(card)
      setShareMessage(result.mode === 'shared' ? '已经递出邀请' : '请客卡已备好')
    } catch (error) {
      setShareMessage(error?.name === 'AbortError' ? '已取消分享' : '生成失败，再点一次试试')
    } finally {
      setSharing(false)
    }
  }
  const generatePixelCard = async () => {
    if (pixelCardStatus === 'loading') return
    setPixelCardStatus('loading')
    try {
      const url = await generateDrinkPixelCard({ card, bartender })
      setPixelCardUrl(url)
      setPixelCardStatus('done')
    } catch {
      setPixelCardStatus('error')
    }
  }
  useEffect(() => {
    if (isEmptyCup || reportOpen || pixelCardUrl || pixelCardStatus) return
    generatePixelCard()
  }, [isEmptyCup, pixelCardStatus, pixelCardUrl, reportOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`special-card settlement-card ${isEmptyCup ? 'empty-cup-card' : ''} ${reportOpen ? 'report-open' : ''}`}>
      <div className="result-frame">
        <div className="result-ribbon">
          <span />
          <strong>{card.drinkName}</strong>
          <span />
        </div>
        <div className="result-signature letter-signature" aria-label="出品署名">
          <span className="letter-to">To: {guestLine(profile)}</span>
          <i />
        </div>
      </div>

      <div className="result-showcase" aria-label="出杯展示">
        {!isEmptyCup && !reportOpen && (
          <div className="result-confetti" aria-hidden="true">
            {CELEBRATION_PIECES.map((piece, index) => (
              <i
                key={`${piece.x}-${index}`}
                style={{
                  '--x': piece.x,
                  '--y': piece.y,
                  '--dx': piece.dx,
                  '--dy': piece.dy,
                  '--confetti-color': piece.color,
                  '--confetti-delay': piece.delay,
                  '--confetti-rotate': piece.rotate,
                }}
              />
            ))}
          </div>
        )}
        {pixelCardUrl ? (
          <div className="generated-pixel-card">
            <img src={pixelCardUrl} alt={`${card.drinkName} 像素出杯图`} />
          </div>
        ) : (
          <ResultDrink recipe={card.recipe || []} isEmptyCup={isEmptyCup} vessel={card.vessel || 'highball'} bartender={bartender} />
        )}
        <span className="result-stage-signature">From: {card.bartender}</span>
      </div>

      <div className="dname">{productType}完成</div>
      <div className="bartender-badge-line">
        <span className="bartender-mini">
          {bartender?.image && <img src={bartender.image} alt="" />}
        </span>
        <span>{card.bartender}</span>
      </div>

      <div className="score-board score-board-hero">
        <StarRating stars={score.stars} />
      </div>

      {!reportOpen && (
        <div className="settlement-actions">
          {!isEmptyCup && (
            <button className="poster-share-btn" type="button" disabled={sharing || pixelCardStatus === 'loading'} onClick={generatePoster}>
              {sharing || pixelCardStatus === 'loading' ? preparingText : inviteText}
            </button>
          )}
          {shareMessage && <small className="poster-share-status">{shareMessage}</small>}
        </div>
      )}

      {reportOpen && (
        <>
          {!isEmptyCup && (
            <div className="poster-share-row">
              <button className="poster-share-btn" type="button" disabled={sharing} onClick={generatePoster}>
                {sharing ? preparingText : inviteText}
              </button>
              {shareMessage && <small className="poster-share-status">{shareMessage}</small>}
            </div>
          )}
          <ReviewGaugeBoard charts={report.progressCharts} />
          <BartenderAdviceCard advice={report.bartenderAdvice} bartender={bartender} />

      <div style={{ margin: '6px 0 14px' }}>
        {isEmptyCup ? (
          <div className="empty-cup-note">今天还没有完成记录。先留一只空杯，明天从一件小事开始。</div>
        ) : (
          <RecipeBar recipe={card.recipe} />
        )}
      </div>
      {!isEmptyCup && (
        <div className="result-details compact-result-details">
          <div>
            <strong>今天完成</strong>
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
              <p>还没有完成记录。</p>
            )}
          </div>
          <div>
            <strong>状态</strong>
            <div className="taste-tags">
              <span>主线：{card.heaviest}</span>
              <span>缺口：{card.missing}</span>
            </div>
          </div>
        </div>
      )}

      <ManagementTuning items={report.flavorTuning} />

      {!!evoTips.length && (
        <div className="evo-result">
          <strong>下次可选</strong>
          <div className="additive-cup-grid">
            {evoTips.slice(0, 3).map((tip, index) => (
              <AdditiveCup key={tip.id} tip={tip} index={index} />
            ))}
          </div>
        </div>
      )}

      <HabitMemoryCard memory={report.habitMemory} />
      <AgentEvolutionCard evolution={report.agentEvolution} />
        </>
      )}
    </div>
  )
}
