import { useEffect, useState } from 'react'
import { getAdventureActions, getAdventurePartnersUrl } from '../engine/collectLinks.js'
import './AdventurePage.css'

function partnerHref(value = '') {
  const normalized = String(value || '').trim()
  if (!normalized || normalized === '现场二维码' || normalized === '二维码') return ''
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(normalized)) return `https://${normalized}`
  return ''
}

export default function AdventurePage({ onBack }) {
  const actions = getAdventureActions(import.meta.env)
  const partnersUrl = getAdventurePartnersUrl(import.meta.env)
  const [partners, setPartners] = useState([])
  const [partnerStatus, setPartnerStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()
    setPartnerStatus('loading')

    fetch(partnersUrl, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`Partner API ${response.status}`)
        return response.json()
      })
      .then((payload) => {
        const rows = Array.isArray(payload?.partners) ? payload.partners : []
        setPartners(rows)
        setPartnerStatus(rows.length ? 'ready' : 'empty')
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setPartnerStatus('error')
      })

    return () => controller.abort()
  }, [partnersUrl])

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
          桂花会带你走完一次很短的现场体验：认识联名伙伴，逛联名游园，投下一份承诺，再带走一张现场小卡。
        </p>
      </div>

      <ol className="adventure-journey" aria-label="现场体验流程">
        <li><span>01</span><p><strong>信息卡片墙</strong><small>先看看现场伙伴、关键词、任务和奖励。</small></p></li>
        <li><span>02</span><p><strong>联名游园</strong><small>选择摊位、角色或地点，收下一句现场提示。</small></p></li>
        <li><span>03</span><p><strong>承诺池</strong><small>写下准备完成的事、它的重要性和愿意投入的时间。</small></p></li>
        <li><span>04</span><p><strong>现场小卡</strong><small>领取 ADV 体验码，带走属于你的参与凭证。</small></p></li>
      </ol>

      <section className="sponsor-wall" aria-labelledby="sponsor-wall-title">
        <header className="sponsor-wall-head">
          <div>
            <p>PARTNER WALL</p>
            <h2 id="sponsor-wall-title">联名伙伴信息墙</h2>
          </div>
          <span>{partnerStatus === 'ready' ? `${partners.length} 个现场项目` : '现场情报加载中'}</span>
        </header>

        {partnerStatus === 'loading' ? <p className="sponsor-wall-state">桂花正在整理伙伴卡片...</p> : null}
        {partnerStatus === 'empty' ? <p className="sponsor-wall-state">伙伴卡片正在准备中。</p> : null}
        {partnerStatus === 'error' ? <p className="sponsor-wall-state error">信息墙暂时没有打开，请稍后刷新。</p> : null}

        {partners.length ? (
          <div className="sponsor-wall-grid">
            {partners.map((partner, index) => {
              const href = partnerHref(partner.website)
              return (
                <article className="sponsor-card" key={partner.id}>
                  <div className="sponsor-card-top">
                    <span className="sponsor-card-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="sponsor-keyword">{partner.keyword}</span>
                  </div>
                  <h3>{partner.name}</h3>
                  <p className="sponsor-intro">{partner.intro}</p>
                  <dl>
                    <div><dt>现场小任务</dt><dd>{partner.task}</dd></div>
                    <div><dt>完成奖励</dt><dd>{partner.reward}</dd></div>
                  </dl>
                  {href ? (
                    <a className="sponsor-site" href={href} target="_blank" rel="noreferrer">访问官网 <span aria-hidden="true">↗</span></a>
                  ) : partner.website ? (
                    <span className="sponsor-site is-offline">{partner.website}</span>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : null}
      </section>

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
