import { getAdventureActions } from '../engine/collectLinks.js'
import './AdventurePage.css'

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
        <h1 className="adventure-title">种种酒馆 · 现场游园</h1>
        <p className="adventure-lead">
          桂花会带你走完一次很短的现场体验：逛联名游园，投下一份承诺，领取创始体验码，再带走一张现场小卡。
        </p>
      </div>

      <ol className="adventure-journey" aria-label="现场体验流程">
        <li><span>01</span><p><strong>联名游园</strong><small>选择摊位、角色或地点，收下一句现场提示。</small></p></li>
        <li><span>02</span><p><strong>承诺池</strong><small>写下准备完成的事、它的重要性和愿意投入的时间。</small></p></li>
        <li><span>03</span><p><strong>创始体验码</strong><small>留下微信后领取 ADV 限定体验码。</small></p></li>
        <li><span>04</span><p><strong>现场小卡</strong><small>展示体验码，带走属于你的参与凭证。</small></p></li>
      </ol>

      <div className="adventure-actions" role="list">
        {actions.map((action) => (
          <a key={action.id} className="adventure-link" href={action.href} role="listitem">
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
