// 步骤五：饮品生成。第一次展示每件事变成的原料 + 今日特调卡。

import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/store.jsx'
import SpecialCard from '../components/SpecialCard.jsx'
import { formatDuration } from '../engine/time.js'
import { getRecipeVolumeLayers } from '../engine/recipeVolume.js'
import { getBartender } from '../data/bartenders.js'
import { fetchCellarStats, fetchPublicCellar, fetchReviewReport, publishDrink } from '../engine/cellarApi.js'

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
        <span>节奏</span>
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

function ReportUnlocks({ reports = {} }) {
  const items = [
    { key: 'day', label: '日报', need: 1 },
    { key: 'week', label: '周报', need: 3 },
    { key: 'month', label: '月报', need: 7 },
    { key: 'year', label: '年报', need: 30 },
  ]
  return (
    <div className="report-unlocks" aria-label="周期复盘">
      {items.map((item) => {
        const report = reports[item.key]
        const count = report?.count || 0
        const locked = count < item.need
        return (
          <div className={`report-unlock ${locked ? 'locked' : 'ready'}`} key={item.key}>
            <strong>{item.label}</strong>
            <span>{locked ? `${count}/${item.need}` : '已解锁'}</span>
            <i style={{ '--fill': `${Math.min(100, Math.max(8, (count / item.need) * 100))}%` }}>
              <b />
            </i>
          </div>
        )
      })}
    </div>
  )
}

function PlatformStats({ stats }) {
  if (!stats) return null
  const locations = stats.activeLocations || []
  return (
    <div className="platform-stats" aria-label="酒馆数据">
      <div>
        <strong>{stats.usersCount || 0}</strong>
        <span>来客</span>
      </div>
      <div>
        <strong>{stats.drinksCount || 0}</strong>
        <span>存杯</span>
      </div>
      <div className="location-row">
        <strong>{locations[0]?.name || '远方'}</strong>
        <span>{locations.length ? `${locations.length} 个地点` : '等待第一位来客'}</span>
      </div>
    </div>
  )
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function calendarDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      key: dayKey(date),
      inMonth: date.getMonth() === month,
    }
  })
}

function dayDrinkMap(items = []) {
  return items.reduce((map, item) => {
    if (!item?.date) return map
    const previous = map.get(item.date)
    if (!previous || String(item.savedAt || item.date) > String(previous.savedAt || previous.date)) {
      map.set(item.date, item)
    }
    return map
  }, new Map())
}

function CellarCalendar({ items, currentCard }) {
  const collection = useMemo(() => {
    const all = [...(items || [])]
    if (currentCard && !all.some((item) => item.date === currentCard.date && item.drinkName === currentCard.drinkName)) {
      all.unshift({ ...currentCard, savedAt: new Date().toISOString() })
    }
    return all
  }, [items, currentCard])
  const initialMonth = currentCard?.date ? new Date(`${currentCard.date}T12:00:00`) : new Date()
  const [monthDate, setMonthDate] = useState(initialMonth)
  const drinksByDay = useMemo(() => dayDrinkMap(collection), [collection])
  const visibleDays = useMemo(() => calendarDays(monthDate), [monthDate])
  const monthLabel = `${monthDate.getFullYear()} 年 ${monthDate.getMonth() + 1} 月`
  const selected = drinksByDay.get(dayKey(monthDate)) || drinksByDay.get(currentCard?.date) || collection[0]

  const shiftMonth = (dir) => {
    setMonthDate((date) => new Date(date.getFullYear(), date.getMonth() + dir, 1))
  }

  const chooseDay = (day) => {
    setMonthDate(day.date)
  }

  return (
    <div className="cellar-calendar">
      <div className="calendar-head">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月">‹</button>
        <div>
          <strong>{monthLabel}</strong>
          <span>每天一份，按日期放回冰柜</span>
        </div>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月">›</button>
      </div>

      <div className="calendar-week">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="calendar-grid">
        {visibleDays.map((day) => {
          const drink = drinksByDay.get(day.key)
          const isSelected = day.key === dayKey(monthDate)
          return (
            <button
              className={`calendar-cell ${day.inMonth ? '' : 'muted'} ${drink ? 'has-drink' : ''} ${isSelected ? 'selected' : ''}`}
              key={day.key}
              type="button"
              onClick={() => chooseDay(day)}
            >
              <span className="calendar-date">{day.date.getDate()}</span>
              {drink ? (
                <>
                  <ColorMini colors={(drink.recipe || []).slice(0, 4).map((r) => r.color)} />
                  <span className="calendar-stars">{'★'.repeat(drink.report?.score?.stars || 0)}</span>
                </>
              ) : (
                <i className="empty-glass" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>

      <div className="calendar-ticket">
        {selected ? (
          <>
            <ColorMini colors={(selected.recipe || []).slice(0, 4).map((r) => r.color)} />
            <div>
              <strong>{selected.drinkName}</strong>
              <span>{selected.date} · {selected.bartender || '种种'}出品 · 完成 {Math.round((selected.completionRate || 0) * 100)}%</span>
            </div>
          </>
        ) : (
              <span>这个月还没有放进冰柜的出品。</span>
        )}
      </div>
    </div>
  )
}

export default function RevealPage() {
  const { state, dispatch } = useStore()
  const [activePanel, setActivePanel] = useState('')
  const [publicCellar, setPublicCellar] = useState([])
  const [cellarMessage, setCellarMessage] = useState('')
  const [syncingCellar, setSyncingCellar] = useState(false)
  const [periodReports, setPeriodReports] = useState({})
  const [platformStats, setPlatformStats] = useState(null)
  const card = state.reviewCard
  const report = card?.report || {}
  const bartender = getBartender(state.lockedBartenderId || state.bartenderId, state.customBartenders)
  const saved = useMemo(
    () => Boolean(card && state.cellar?.some((item) => item.id === `${card.date}-${card.drinkName}`)),
    [card, state.cellar],
  )

  useEffect(() => {
    fetchPublicCellar()
      .then(setPublicCellar)
      .catch(() => setPublicCellar([]))
    fetchCellarStats()
      .then(setPlatformStats)
      .catch(() => setPlatformStats(null))
  }, [])

  useEffect(() => {
    const userId = state.userProfile?.id
    if (!userId) return
    Promise.all(['day', 'week', 'month', 'year'].map((period) => fetchReviewReport(userId, period).then((report) => [period, report])))
      .then((entries) => setPeriodReports(Object.fromEntries(entries)))
      .catch(() => setPeriodReports({}))
  }, [state.userProfile?.id, syncingCellar])

  const saveToCellar = async () => {
    if (!card || syncingCellar) return
    dispatch({ type: 'SAVE_TO_CELLAR' })
    setSyncingCellar(true)
    setCellarMessage('正在放进公共冰柜...')
    try {
      await publishDrink(card, state.userProfile)
      const drinks = await fetchPublicCellar()
      setPublicCellar(drinks)
      setCellarMessage('已放进冰柜，别人也能看见这份出品。')
    } catch {
      setCellarMessage('本地冰柜已保存，公共冷柜暂时没连上。')
    } finally {
      setSyncingCellar(false)
    }
  }

  if (!card) {
    return (
      <div className="card center">
        今日出品还没生成。
        <div className="btn-row center">
          <button className="btn-primary" onClick={() => dispatch({ type: 'GO', step: 'optimize' })}>去调配</button>
        </div>
      </div>
    )
  }

  const isEmptyCup = card.completionRate === 0
  const minutes = report.actualTotal || report.completedEstimated || 0
  const revealTabs = [
    { key: 'cellar', label: '冰柜' },
    { key: 'analysis', label: '分析' },
    { key: 'report', label: '报告' },
  ]

  const activeTab = revealTabs.find((tab) => tab.key === activePanel)

  useEffect(() => {
    document.body.classList.toggle('reveal-subpage-open', Boolean(activePanel))
    return () => document.body.classList.remove('reveal-subpage-open')
  }, [activePanel])

  return (
    <div className={`reveal-page ${activePanel ? 'is-subpage' : ''}`}>
      {!activePanel && (
        <>
          <div className="reveal-in" style={{ animationDelay: '.1s' }}>
            <SpecialCard card={card} bartender={bartender} reportOpen={false} />
          </div>

          <div className="reveal-action-dock reveal-in" style={{ animationDelay: '.16s' }} role="navigation" aria-label="查看今日出品">
            {revealTabs.map((tab) => (
              <button
                className={activePanel === tab.key ? 'active' : ''}
                key={tab.key}
                type="button"
                onClick={() => setActivePanel(tab.key)}
              >
                <i aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {activePanel && (
        <div className="reveal-subpage-head reveal-in">
          <button type="button" onClick={() => setActivePanel('')} aria-label="返回出品页">
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <strong>{activeTab?.label}</strong>
          <span />
        </div>
      )}

      <div className={`reveal-panel-stage ${activePanel ? 'as-subpage' : ''}`}>
        {activePanel === 'analysis' && (
          <div className="card reveal-in result-dashboard compact-reveal-panel" style={{ animationDelay: '.04s' }}>
            <div className="report-head">
              <div>
                <label className="field">今日小记</label>
                <div className="report-title">{report.stateProfile?.title || '今天的节奏'}</div>
                <p className="report-summary">{report.stateProfile?.summary || card.comment}</p>
              </div>
            </div>

            <div className="dashboard-board simple-analysis-board">
              <div className="dashboard-meters">
                <MiniMeter label="完成片段" value={`${report.completedCount ?? 0}`} tone="gold" />
                <MiniMeter label="调配时间" value={formatDuration(minutes)} tone="mint" />
                <MiniMeter label="时间贴合" value={`${Math.round(card.timeAccuracy * 100)}%`} tone="pink" />
              </div>
              <MixDial recipe={card.recipe} score={report.score} />
            </div>

            {!!report.timeTuning?.length && (
              <div className="report-section">
                <div className="section-title">时间火候</div>
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
          </div>
        )}

        {activePanel === 'report' && (
          <div className="card reveal-in compact-reveal-panel result-dashboard" style={{ animationDelay: '.04s' }}>
            <div className="report-head">
              <div>
                <label className="field">今晚留给你</label>
                <div className="report-title">吧台便笺</div>
              </div>
            </div>

            <div className="report-section">
              <div className="section-title">下一杯先这样</div>
              <div className="plan-notes visual-notes">
                {(report.nextPlan || [card.suggestion]).slice(0, 3).map((note, index) => (
                  <div className="plan-note" key={note}>
                    <span className="note-token">{String(index + 1).padStart(2, '0')}</span>
                    <p>{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`memory-ticket ${isEmptyCup ? 'empty' : ''}`}>
              <div className="section-title">种种记住了</div>
              <p>{report.memory || card.comment}</p>
              <small>下次遇到相似的一天，可以从这杯开始。</small>
            </div>

            {report.agentEvolution && (
              <div className="memory-ticket evolution-ticket">
                <div className="section-title">{report.agentEvolution.title}</div>
                <p>{report.agentEvolution.nextDefault}</p>
                <div className="evolution-ticket-row">
                  {(report.agentEvolution.chips || []).map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
                <small>{report.agentEvolution.note}</small>
              </div>
            )}
          </div>
        )}

        {activePanel === 'cellar' && (
          <div className="card cellar-panel reveal-in compact-reveal-panel" style={{ animationDelay: '.04s' }}>
            <div className="report-head">
              <div>
                <label className="field">个人冰柜</label>
              </div>
              <button className="btn-ghost cellar-save" onClick={saveToCellar} disabled={syncingCellar}>
                {syncingCellar ? '冷藏中' : saved ? '已放入冰柜' : '放入冰柜'}
              </button>
            </div>
            {cellarMessage && <small className="cellar-message">{cellarMessage}</small>}

            <CellarCalendar items={state.cellar || []} currentCard={card} />
            <ReportUnlocks reports={periodReports} />
            <PlatformStats stats={platformStats} />

            <div className="report-section">
              <div className="section-title">看看别人的冷藏格</div>
              <div className="community-grid">
                {(publicCellar.length ? publicCellar : COMMUNITY_RECIPES).slice(0, 3).map((recipe) => (
                  <button className="community-card" key={recipe.id || recipe.title} type="button">
                    <ColorMini colors={recipe.colors || (recipe.recipe || []).slice(0, 4).map((r) => r.color)} />
                    <strong>{recipe.drinkName || recipe.title}</strong>
                    <span>
                      {recipe.user
                        ? `${recipe.user.locationLabel || '远方'} · ${recipe.user.name || '无名旅人'}`
                        : recipe.owner}
                    </span>
                    <p>{recipe.note || `${recipe.bartender || '种种'}留下的 ${recipe.stars || 0} 星出品`}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!activePanel && (
        <div className="btn-row">
          <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'optimize' })}>返回配方</button>
          <div className="spacer" />
          <button className="btn-primary" onClick={() => dispatch({ type: 'RESET' })}>开新的一天</button>
        </div>
      )}
    </div>
  )
}
