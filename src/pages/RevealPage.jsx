// 步骤五：饮品生成。第一次展示每件事变成的原料 + 今日特调卡。

import { useMemo, useState } from 'react'
import { useStore } from '../store/store.jsx'
import SpecialCard from '../components/SpecialCard.jsx'
import RecipeBlueprint from '../components/RecipeBlueprint.jsx'
import { formatDuration } from '../engine/time.js'
import { getRecipeVolumeLayers } from '../engine/recipeVolume.js'
import { getBartender } from '../data/bartenders.js'

const COMMUNITY_RECIPES = [
  {
    title: '晨间薄荷法',
    owner: '三段式早晨管理',
    note: '先醒神，再处理一件主线，最后收一小段杂事。',
    colors: ['#78B9C8', '#F4E9D2', '#86B98A'],
  },
  {
    title: '姜味启动法',
    owner: '低动力开局配方',
    note: '用一个短任务点火，再进入今天最重要的那一杯。',
    colors: ['#D86F63', '#E9A86A', '#A66A3F'],
  },
  {
    title: '迷迭香高塔法',
    owner: '深度任务优先',
    note: '把高消耗任务集中在精神最清楚的时段完成。',
    colors: ['#78B9C8', '#F4D66C', '#F2A6B8'],
  },
]

function ColorMini({ colors }) {
  return (
    <div className="mini-drink" aria-hidden="true">
      {colors.map((color, index) => (
        <span key={`${color}-${index}`} style={{ background: color }} />
      ))}
    </div>
  )
}

function MixDial({ recipe, score }) {
  let acc = 0
  const layers = getRecipeVolumeLayers(recipe || []).slice(0, 6)
  const totalMl = layers.reduce((sum, layer) => sum + layer.ml, 0) || 1
  const stops = layers.map((r) => {
    const start = acc
    acc += Math.max(4, Math.round((r.ml / totalMl) * 100))
    return `${r.color} ${start}% ${Math.min(acc, 100)}%`
  })
  const fill = stops.length ? stops.join(', ') : '#EAF9F7 0 100%'
  return (
    <div className="mix-dial" style={{ '--dial-fill': fill }}>
      <div className="dial-core">
        <strong>{score?.total ?? 0}</strong>
        <span>核分</span>
      </div>
    </div>
  )
}

function MiniMeter({ label, value, tone }) {
  return (
    <div className={`mini-meter ${tone || ''}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}

export default function RevealPage() {
  const { state, dispatch } = useStore()
  const [reportOpen, setReportOpen] = useState(false)
  const card = state.reviewCard
  const report = card?.report || {}
  const bartender = getBartender(state.lockedBartenderId || state.bartenderId, state.customBartenders)
  const saved = useMemo(
    () => Boolean(card && state.cellar?.some((item) => item.id === `${card.date}-${card.drinkName}`)),
    [card, state.cellar],
  )

  if (!card) {
    return (
      <div className="card center">
        今日饮品还没生成。
        <div className="btn-row center">
          <button className="btn-primary" onClick={() => dispatch({ type: 'GO', step: 'optimize' })}>去调配</button>
        </div>
      </div>
    )
  }

  const cellarPreview = state.cellar?.length ? state.cellar.slice(0, 3) : [card]
  const isEmptyCup = card.completionRate === 0
  const minutes = report.actualTotal || report.completedEstimated || 0

  return (
    <div>
      <div className="reveal-banner reveal-in">饮品生成<br />你的一天，调成了一杯</div>

      <div className="reveal-in" style={{ animationDelay: '.1s' }}>
        <SpecialCard card={card} bartender={bartender} reportOpen={reportOpen} onGenerateReport={() => setReportOpen(true)} />
      </div>

      {reportOpen && (
        <>
          <div className="card reveal-in" style={{ animationDelay: '.08s' }}>
            <RecipeBlueprint ingredients={state.ingredients} recipe={card.recipe} />
          </div>

          <div className="card reveal-in result-dashboard" style={{ animationDelay: '.16s' }}>
            <div className="report-head">
              <div>
                <label className="field">今日调配仪表盘</label>
                <div className="report-title">{report.stateProfile?.title || '今日报告'}</div>
              </div>
              <button className="btn-ghost cellar-save" onClick={() => dispatch({ type: 'SAVE_TO_CELLAR' })}>
                {saved ? '已记入酒柜' : '记入酒柜'}
              </button>
            </div>

            <div className="dashboard-board">
              <MixDial recipe={card.recipe} score={report.score} />
              <div className="dashboard-meters">
                <MiniMeter label="完成片段" value={`${report.completedCount ?? 0}`} tone="gold" />
                <MiniMeter label="调配时间" value={formatDuration(minutes)} tone="mint" />
                <MiniMeter label="时间贴合" value={`${Math.round(card.timeAccuracy * 100)}%`} tone="pink" />
              </div>
            </div>

            {!!report.timeTuning?.length && (
              <div className="report-section">
                <div className="section-title">时间校准</div>
                <div className="time-tuning-list">
                  {report.timeTuning.map((item) => (
                    <div className={`time-tuning ${item.direction}`} key={`${item.title}-${item.direction}`}>
                      <strong>{item.title}</strong>
                      <span>计划 {formatDuration(item.estimatedTime)} · 实际 {formatDuration(item.actualTime)}</span>
                      <p>{item.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="report-section">
              <div className="section-title">明日加料盘</div>
              <div className="plan-notes visual-notes">
                {(report.nextPlan || [card.suggestion]).map((note, index) => (
                  <div className="plan-note" key={note}>
                    <span className="note-token">{String(index + 1).padStart(2, '0')}</span>
                    <p>{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`memory-ticket ${isEmptyCup ? 'empty' : ''}`}>
              <div className="section-title">酒柜签</div>
              <p>{report.memory || card.comment}</p>
              <small>存入酒柜后，可以按月翻看自己的管理口味。</small>
            </div>
          </div>

          <div className="card cellar-panel reveal-in" style={{ animationDelay: '.24s' }}>
            <div className="report-head">
              <div>
                <label className="field">个人酒柜</label>
              </div>
            </div>

            <div className="cellar-shelf">
              {cellarPreview.map((item) => (
                <div className="cellar-bottle" key={item.id || item.date}>
                  <ColorMini colors={(item.recipe || []).slice(0, 4).map((r) => r.color)} />
                  <strong>{item.drinkName}</strong>
                  <span>{item.date} · 完成 {Math.round((item.completionRate || 0) * 100)}%</span>
                </div>
              ))}
            </div>

            <div className="report-section">
              <div className="section-title">看看别人的酒单</div>
              <div className="community-grid">
                {COMMUNITY_RECIPES.map((recipe) => (
                  <button className="community-card" key={recipe.title} type="button">
                    <ColorMini colors={recipe.colors} />
                    <strong>{recipe.title}</strong>
                    <span>{recipe.owner}</span>
                    <p>{recipe.note}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="btn-row">
        <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'optimize' })}>← 回到调配清单</button>
        <div className="spacer" />
        <button className="btn-primary" onClick={() => dispatch({ type: 'RESET' })}>开新的一天 ↺</button>
      </div>
    </div>
  )
}
