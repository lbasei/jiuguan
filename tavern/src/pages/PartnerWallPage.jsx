import { useEffect, useState } from 'react'
import { getAdventurePartnersUrl } from '../engine/collectLinks.js'
import './PartnerWallPage.css'

function partnerHref(value = '') {
  const normalized = String(value || '').trim()
  if (!normalized || normalized === '现场二维码' || normalized === '二维码') return ''
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(normalized)) return `https://${normalized}`
  return ''
}

export default function PartnerWallPage({ onBack }) {
  const partnersUrl = getAdventurePartnersUrl(import.meta.env)
  const [partners, setPartners] = useState([])
  const [status, setStatus] = useState('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    fetch(partnersUrl, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`Partner API ${response.status}`)
        return response.json()
      })
      .then((payload) => {
        const rows = Array.isArray(payload?.partners) ? payload.partners : []
        setPartners(rows)
        setStatus(rows.length ? 'ready' : 'empty')
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setStatus('error')
      })

    return () => controller.abort()
  }, [partnersUrl, reloadKey])

  const statusLabel = status === 'ready'
    ? `${partners.length} 个现场项目`
    : status === 'empty'
      ? '伙伴卡片准备中'
      : status === 'error'
        ? '读取失败'
        : '现场情报加载中'

  return (
    <main className="intro-page adventure-page partner-wall-page">
      <div className="intro-sigil" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="partner-wall-intro">
        <p className="adventure-kicker">PARTNER WALL</p>
        <h1 className="adventure-title">联名伙伴信息墙</h1>
        <p className="adventure-lead">先认一认现场伙伴，再挑一个让你好奇的任务出发。</p>
      </header>

      <section className="partner-wall" aria-labelledby="partner-wall-title">
        <header className="partner-wall-head">
          <h2 id="partner-wall-title">现场项目</h2>
          <span aria-live="polite">{statusLabel}</span>
        </header>

        {status === 'loading' ? <p className="partner-wall-state">桂花正在整理伙伴卡片...</p> : null}
        {status === 'empty' ? <p className="partner-wall-state">伙伴卡片正在准备中。</p> : null}
        {status === 'error' ? (
          <div className="partner-wall-state is-error">
            <p>信息墙暂时没有打开。</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>重新读取</button>
          </div>
        ) : null}

        {partners.length ? (
          <div className="partner-wall-grid">
            {partners.map((partner, index) => {
              const href = partnerHref(partner.website)
              return (
                <article className="partner-card" key={partner.id}>
                  <div className="partner-card-top">
                    <span className="partner-card-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="partner-keyword">{partner.keyword}</span>
                  </div>
                  <h3>{partner.name}</h3>
                  <p className="partner-intro">{partner.intro}</p>
                  <dl>
                    <div><dt>现场小任务</dt><dd>{partner.task}</dd></div>
                    <div><dt>完成奖励</dt><dd>{partner.reward}</dd></div>
                  </dl>
                  {href ? (
                    <a className="partner-site" href={href} target="_blank" rel="noreferrer">访问官网 <span aria-hidden="true">↗</span></a>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : null}
      </section>

      <div className="intro-actions adventure-back">
        <button className="start-spell secondary" type="button" onClick={onBack} aria-label="返回 Adventure">
          <span>返回 Adventure</span>
        </button>
      </div>
    </main>
  )
}
