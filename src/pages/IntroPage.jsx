export default function IntroPage({ onStart }) {
  return (
    <main className="intro-page">
      <div className="intro-sigil" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="intro-kicker">魔法厨房 · 今日酒馆</div>
      <div className="intro-logo" aria-label="Life Kitchen">
        <span className="logo-hat" aria-hidden="true" />
        <span className="logo-wing left" aria-hidden="true" />
        <span className="logo-wing right" aria-hidden="true" />
        <span className="logo-star s1" aria-hidden="true" />
        <span className="logo-star s2" aria-hidden="true" />
        <span className="logo-star s3" aria-hidden="true" />
        <h1 className="intro-title">
          <span>Life</span>
          <span>Kitchen</span>
        </h1>
      </div>
      <p className="intro-copy">
        选一只种种，把今天想做的事讲给它听。它会帮你整理顺序、守住节奏，最后生成一杯属于今天的饮品。
      </p>

      <button className="start-spell" onClick={onStart}>
        <span>Start</span>
      </button>
    </main>
  )
}
