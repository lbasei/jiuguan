import { useEffect, useState } from 'react'
import { fetchOpsDashboard } from '../engine/cellarApi.js'
import { formatDuration } from '../engine/time.js'

function Metric({ label, value, tone = '' }) {
  return (
    <div className={`ops-metric ${tone}`}>
      <strong>{value ?? 0}</strong>
      <span>{label}</span>
    </div>
  )
}

function EmptyLine({ children = '还没有记录。' }) {
  return <div className="ops-empty">{children}</div>
}

export default function OpsPage() {
  const [ops, setOps] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchOpsDashboard()
      .then((data) => {
        if (alive) setOps(data)
      })
      .catch((err) => {
        if (alive) setError(err?.message || '看板暂时没有开门。')
      })
    return () => {
      alive = false
    }
  }, [])

  const stats = ops?.stats || {}
  const monthly = ops?.monthly || {}

  return (
    <main className="ops-page">
      <section className="ops-hero">
        <a href="/" className="ops-back">返回酒馆</a>
        <p>Life Kitchen</p>
        <h1>掌柜账本</h1>
        <span>{ops?.month || new Date().toISOString().slice(0, 7)}</span>
      </section>

      {error && <div className="ops-error">{error}</div>}
      {!ops && !error && <div className="ops-loading">账本翻开中...</div>}

      {ops && (
        <>
          <section className="ops-grid">
            <Metric label="入座用户" value={stats.usersCount} />
            <Metric label="点击记录" value={stats.eventsCount} tone="mint" />
            <Metric label="本月出品" value={monthly.drinks} tone="gold" />
            <Metric label="完成率" value={`${monthly.completionRate || 0}%`} tone="rose" />
          </section>

          <section className="ops-panel">
            <div className="ops-panel-head">
              <h2>本月节奏</h2>
              <span>{monthly.activeDays || 0} 天有动作</span>
            </div>
            <div className="ops-bars">
              {(monthly.eventByDay || []).length ? monthly.eventByDay.map((item) => (
                <div className="ops-bar" key={item.day}>
                  <i style={{ height: `${Math.min(100, 18 + item.count * 8)}%` }} />
                  <span>{item.day}</span>
                </div>
              )) : <EmptyLine>这个月还没有点击记录。</EmptyLine>}
            </div>
          </section>

          <section className="ops-columns">
            <div className="ops-panel">
              <div className="ops-panel-head">
                <h2>最近用户</h2>
                <span>{stats.activeLocations?.[0]?.name || '远方'}</span>
              </div>
              <div className="ops-list">
                {(ops.latestUsers || []).length ? ops.latestUsers.map((user) => (
                  <div className="ops-row" key={user.id}>
                    <strong>{user.name || '未署名客人'}</strong>
                    <span>{user.locationLabel || '未填写位置'}</span>
                  </div>
                )) : <EmptyLine />}
              </div>
            </div>

            <div className="ops-panel">
              <div className="ops-panel-head">
                <h2>最近日程</h2>
                <span>{monthly.completed || 0}/{monthly.tasks || 0}</span>
              </div>
              <div className="ops-list">
                {(ops.latestSchedules || []).length ? ops.latestSchedules.slice(0, 10).map((item, index) => (
                  <div className="ops-row" key={`${item.drinkId}-${index}`}>
                    <strong>{item.drinkName || '未命名特调'}</strong>
                    <span>{item.status === 'completed' ? '已完成' : item.status === 'skipped' ? '留到下次' : '进行中'} · {formatDuration(item.actualTime || item.estimatedTime || 0)}</span>
                  </div>
                )) : <EmptyLine />}
              </div>
            </div>
          </section>

          <section className="ops-panel">
            <div className="ops-panel-head">
              <h2>点击热区</h2>
              <span>最近 1000 次</span>
            </div>
            <div className="ops-chips">
              {(stats.eventTypes || []).length ? stats.eventTypes.map((item) => (
                <span key={item.name}>{item.name}<b>{item.count}</b></span>
              )) : <EmptyLine />}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
