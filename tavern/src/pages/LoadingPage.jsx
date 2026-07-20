export default function LoadingPage() {
  return (
    <main className="loading-page">
      <div className="portal-stage" aria-hidden="true">
        <div className="lounge-lamps">
          <span />
          <span />
          <span />
        </div>
        <div className="portal-door">
          <span className="door-leaf left" />
          <span className="door-leaf right" />
          <span className="portal-slit" />
          <span className="portal-star s1" />
          <span className="portal-star s2" />
          <span className="portal-star s3" />
        </div>
        <div className="portal-floor">
          <span />
          <span />
          <span />
        </div>
        <div className="lounge-shadow" />
      </div>
      <div className="loading-runes" aria-hidden="true">✦ ✧ ✦ ✧ ✦</div>
      <div className="loading-title">正在穿过酒馆门廊</div>
    </main>
  )
}
