import { getTavernGuideUrl } from '../engine/collectLinks.js'
import './GuidePage.css'

export default function GuidePage({ onAdventure, onDailyTavern, onBack }) {
  const guideUrl = getTavernGuideUrl(import.meta.env)

  return (
    <main className="intro-page tavern-guide-page">
      <div className="intro-sigil" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="tavern-guide-panel" aria-labelledby="guide-title">
        <p className="tavern-guide-host">酒馆主人 · 桂花</p>
        <h1 id="guide-title">先把今天端上吧台</h1>
        <p className="tavern-guide-lead">你会先遇见桂花。她会用三句话，带你找到今天可以开始的一件事。</p>

        <ol className="tavern-guide-steps">
          <li><span>01</span><p><strong>写下今日酒单</strong><small>告诉桂花你今天的身份、想做的事和现在的卡点。</small></p></li>
          <li><span>02</span><p><strong>收下今日特调</strong><small>小吴会把你的回答收成一张结果卡与现场凭证。</small></p></li>
          <li><span>03</span><p><strong>再去联名游园</strong><small>带着这份开始，继续探索摊位、角色与承诺池。</small></p></li>
        </ol>

        <div className="tavern-guide-actions">
          <a className="tavern-guide-primary" href={guideUrl}>填写今日酒单</a>
          <button type="button" className="tavern-guide-secondary" onClick={onAdventure}>进入联名游园</button>
          <button type="button" className="tavern-guide-text" onClick={onDailyTavern}>进入日常酒馆</button>
          <button type="button" className="tavern-guide-text" onClick={onBack}>返回入口</button>
        </div>
      </section>
    </main>
  )
}
