import tavernPanorama from '../../assets/hero/life-kitchen-tavern-panorama.png'
import { useState } from 'react'
import './IntroPage.css'

export default function IntroPage({ onQuickStart, onFullStart, onAdventure }) {
  const [entering, setEntering] = useState(false)

  const enterTavern = () => {
    if (entering) return
    setEntering(true)
    window.setTimeout(onFullStart, 460)
  }

  return (
    <main className={`intro-page ${entering ? 'is-entering' : ''}`}>
      <div className="intro-sigil" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
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

      <figure className="intro-tavern-portrait" aria-label="Life Kitchen 魔法酒馆全景">
        <img className="tavern-bg" src={tavernPanorama} alt="像素风魔法酒馆里的种种们" draggable="false" />
      </figure>

      <div className="intro-actions intro-actions-stacked">
        <button className="start-spell primary" onClick={enterTavern} aria-label="进入酒馆">
          <span>进入酒馆</span>
        </button>
        <button className="start-spell secondary" type="button" onClick={onAdventure} aria-label="进入 Adventure">
          <span>Adventure</span>
        </button>
      </div>

      <div className="intro-door-wipe" aria-hidden="true">
        <span className="intro-door left" />
        <span className="intro-door right" />
        <span className="intro-door-light" />
      </div>
    </main>
  )
}
