import { useState } from 'react'
import { getTavernGuideUrl } from '../engine/collectLinks.js'
import './GuidePage.css'

export default function GuidePage({ onAdventure, onDailyTavern, onBack }) {
  const [draft, setDraft] = useState('')
  const guideUrl = getTavernGuideUrl(import.meta.env)
  const trimmedDraft = draft.trim().slice(0, 120)
  const nextUrl = trimmedDraft ? `${guideUrl}&draft=${encodeURIComponent(trimmedDraft)}` : guideUrl

  function beginTodaySpecial(event) {
    event.preventDefault()
    window.location.assign(nextUrl)
  }

  return (
    <main className="intro-page tavern-guide-page">
      <div className="intro-sigil" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="tavern-guide-panel" aria-labelledby="guide-title">
        <header className="tavern-guide-header">
          <div className="tavern-guide-host-mark" aria-hidden="true"><i /><b /></div>
          <div>
            <p className="tavern-guide-host">桂花的吧台 · 2 分钟现场体验</p>
            <h1 id="guide-title">桂花在等你说一句</h1>
          </div>
        </header>

        <p className="tavern-guide-lead">今天最想让哪件事动起来？不用想完整，写下一句就好。桂花会把它调成一杯只属于今天的特调。</p>

        <form className="tavern-guide-prompt" onSubmit={beginTodaySpecial}>
          <label htmlFor="today-draft">我今天想先推进...</label>
          <div className="tavern-guide-input-row">
            <input
              id="today-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={120}
              placeholder="例如：把 Demo 的第一版发出去"
            />
            <button type="submit">开始</button>
          </div>
          <p>填一句也可以，下一页会帮你补完。</p>
        </form>

        <div className="tavern-guide-promise" aria-label="本次体验会得到什么">
          <span><b>约 2 分钟</b><small>不需要注册</small></span>
          <span><b>一张今日特调</b><small>可出示给工作人员</small></span>
          <span><b>一个下一步</b><small>把卡点拆小一点</small></span>
        </div>

        <ol className="tavern-guide-steps" aria-label="桂花的现场引导步骤">
          <li className="is-current"><span>1</span><p><strong>说出今天的一件事</strong><small>用一句话开场，桂花会替你接住。</small></p></li>
          <li><span>2</span><p><strong>收下你的今日特调</strong><small>拿到关键词、完成提示和现场凭证。</small></p></li>
          <li><span>3</span><p><strong>把结果带回现场</strong><small>出示给工作人员，或继续去联名游园。</small></p></li>
        </ol>

        <div className="tavern-guide-actions">
          <a className="tavern-guide-primary" href={nextUrl}>{trimmedDraft ? '带着这句话继续' : '让桂花调一杯'}</a>
          <button type="button" className="tavern-guide-secondary" onClick={onAdventure}>我想先逛联名游园</button>
          <div className="tavern-guide-links">
            <button type="button" className="tavern-guide-text" onClick={onDailyTavern}>进入日常酒馆</button>
            <button type="button" className="tavern-guide-text" onClick={onBack}>返回入口</button>
          </div>
        </div>
      </section>
    </main>
  )
}
