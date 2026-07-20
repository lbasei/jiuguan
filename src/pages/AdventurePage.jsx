import { getAdventureActions } from '../engine/collectLinks.js'

export default function AdventurePage({ onBack }) {
  const actions = getAdventureActions(import.meta.env)

  return (
    <main className="intro-page adventure-page">
      <div className="intro-sigil" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="adventure-copy">
        <p className="adventure-kicker">Adventure</p>
        <h1 className="adventure-title">种种酒馆 · 展会探险</h1>
        <p className="adventure-lead">
          今天酒馆临时搬到了现场。先领取委托，再去展位打卡；结果页由采集系统生成。
        </p>
      </div>

      <div className="adventure-actions" role="list">
        {actions.map((action) => (
          <a
            key={action.id}
            className="adventure-link"
            href={action.href}
            target="_blank"
            rel="noreferrer"
            role="listitem"
          >
            <strong>{action.label}</strong>
            <span>{action.hint}</span>
          </a>
        ))}
      </div>

      <div className="intro-actions adventure-back">
        <button className="start-spell secondary" type="button" onClick={onBack} aria-label="返回首页">
          <span>返回首页</span>
        </button>
      </div>
    </main>
  )
}
