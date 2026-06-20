// 步骤一：召唤今天的种种。左右翻 / 拖动直接挑，点击后播放召唤仪式。

import { useEffect, useState, useRef } from 'react'
import { useStore } from '../store/store.jsx'
import { BARTENDERS } from '../data/bartenders.js'
import PixelSprite from '../components/PixelSprite.jsx'
import { CREATURE } from '../components/sprites.js'
import { pushPetState } from '../engine/petBridge.js'
import { generateCustomPetImage } from '../engine/imageGen.js'

export const BODY = {
  rosemary: '#6F8A5B',
  ginger: '#D98A3D',
  mint: '#7FBFA6',
  lemon: '#F3D955',
  garlic: '#DCEBC5',
  cilantro: '#9CC15B',
}

const accentFor = (bartender) => {
  if (bartender?.placeholder) return '#F4D66C'
  return '#58BDB8'
}

const formatClock = (date) =>
  date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

const BASE_METHOD_SLOTS = [
  ...BARTENDERS,
  {
    id: 'custom_creator',
    name: '自定义种种',
    style: '生成新的调酒师',
    fit: '想把自己的管理方法做成专属桌宠的时候',
    blurb: '写下它的原料、性格和管理方式，酒馆会为你生成一只新种种。',
    placeholder: 'plus',
    customCreator: true,
  },
  {
    id: 'choose_for_me',
    name: '帮我选种种',
    style: '选择困难时用',
    fit: '不知道今天适合哪种管理方法的时候',
    blurb: '点一下，酒馆会从现有种种里替你挑一位今日调酒师。',
    placeholder: 'plus',
    helper: true,
  },
]

export default function BartenderPage() {
  const { state, dispatch } = useStore()
  const methodSlots = [...BARTENDERS, ...(state.customBartenders || []), ...BASE_METHOD_SLOTS.slice(BARTENDERS.length)]
  const startIdx = Math.max(0, methodSlots.findIndex((b) => b.id === state.bartenderId))
  const [idx, setIdx] = useState(startIdx === -1 ? 0 : startIdx)
  const [summoning, setSummoning] = useState(false)
  const [armedId, setArmedId] = useState(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customForm, setCustomForm] = useState({
    name: '星糖种种',
    ingredient: '星糖、莓果和薄荷',
    personality: '温柔但会催我开始',
    method: '先做一件小事，再进入主线，最后留一点恢复时间',
  })
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [currentTime, setCurrentTime] = useState(() => formatClock(new Date()))
  const dragX = useRef(null)
  const summonTimer = useRef(null)

  const go = (dir) => {
    setArmedId(null)
    setCustomOpen(false)
    setIdx((i) => (i + dir + methodSlots.length) % methodSlots.length)
  }
  const cur = methodSlots[idx] || methodSlots[0]
  const canSummon = !cur.placeholder
  const canAct = canSummon || cur.helper || cur.customCreator

  useEffect(() => {
    return () => clearTimeout(summonTimer.current)
  }, [])

  useEffect(() => {
    const tick = () => setCurrentTime(formatClock(new Date()))
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (summoning) return
    if (canSummon) pushPetState({ state: 'choosing', bartenderId: cur.id, selected: false, schedule: [], customBartender: cur.custom ? cur : undefined })
  }, [cur.id, canSummon, summoning])

  useEffect(() => {
    const onKey = (event) => {
      if (summoning) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return
      const key = event.key.toLowerCase()
      if (key === 'a') {
        event.preventDefault()
        go(-1)
      }
      if (key === 'd') {
        event.preventDefault()
        go(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [summoning])

  const onDown = (e) => (dragX.current = e.clientX)
  const onUp = (e) => {
    if (dragX.current == null) return
    const dx = e.clientX - dragX.current
    if (dx > 40) go(-1)
    else if (dx < -40) go(1)
    dragX.current = null
  }

  const chooseForMe = () => {
    const currentRealIndex = BARTENDERS.findIndex((b) => b.id === state.bartenderId)
    const nextRealIndex = (currentRealIndex + 1 + Math.floor(Math.random() * (BARTENDERS.length - 1))) % BARTENDERS.length
    setArmedId(null)
    setIdx(nextRealIndex)
  }

  const summon = () => {
    if (summoning) return
    if (cur.customCreator) {
      setCustomOpen(true)
      return
    }
    if (cur.helper) {
      chooseForMe()
      return
    }
    if (!canSummon) return
    setSummoning(true)
    dispatch({ type: 'SET_BARTENDER', id: cur.id })
    pushPetState({ state: 'idle', bartenderId: cur.id, selected: true, schedule: [], customBartender: cur.custom ? cur : undefined })
    summonTimer.current = setTimeout(() => {
      dispatch({ type: 'GO', step: 'todos' })
    }, 1550)
  }

  const touchHero = (event) => {
    if (summoning) return
    if (cur.customCreator) {
      setCustomOpen(true)
      return
    }
    if (cur.helper) {
      chooseForMe()
      return
    }
    if (!canSummon) return
    if (event?.detail > 1) {
      setArmedId(cur.id)
      pushPetState({ state: 'choosing', bartenderId: cur.id, selected: false, schedule: [], customBartender: cur.custom ? cur : undefined })
      return
    }
    if (armedId === cur.id) {
      summon()
      return
    }
    setArmedId(cur.id)
    pushPetState({ state: 'choosing', bartenderId: cur.id, selected: false, schedule: [], customBartender: cur.custom ? cur : undefined })
  }

  const updateCustom = (key, value) => {
    setCustomForm((form) => ({ ...form, [key]: value }))
  }

  const createCustomBartender = async () => {
    if (generating) return
    setGenerating(true)
    setGenerateError('')
    try {
      const image = await generateCustomPetImage(customForm)
      const id = `custom_${Date.now()}`
      const bartender = {
        id,
        name: customForm.name.trim() || '自定义种种',
        plant: customForm.ingredient.trim() || 'custom',
        image,
        style: customForm.personality.trim() || '自定义管理型',
        fit: customForm.ingredient.trim() ? `以${customForm.ingredient.trim()}为灵感的今日调酒师` : '为你的节奏定制的今日调酒师',
        strategy: 'recovery_buffer',
        reminderTone: customForm.personality.trim() || '自定义',
        blurb: customForm.method.trim() || '按你的节奏整理今天的酒单。',
        custom: true,
      }
      dispatch({ type: 'ADD_CUSTOM_BARTENDER', bartender })
      setCustomOpen(false)
      setArmedId(null)
      setIdx(BARTENDERS.length)
      setSummoning(true)
      pushPetState({ state: 'idle', bartenderId: id, selected: true, schedule: [], customBartender: bartender })
      summonTimer.current = setTimeout(() => {
        dispatch({ type: 'GO', step: 'todos' })
      }, 1550)
    } catch (error) {
      setGenerateError(error.message || '生成失败，检查一下 OpenAI 图片接口。')
    } finally {
      setGenerating(false)
    }
  }

  const onHeroKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    touchHero()
  }

  const heroArmed = armedId === cur.id && canSummon && !summoning

  return (
    <div className="summon-page">
      <h2 className="title summon-title">召唤种种</h2>
      <div className="summon-clock" aria-live="polite">
        <span>{currentTime}</span>
        <em>邀请哪只种种和你一起喝一杯？</em>
      </div>
      <p className="subtitle summon-subtitle">{summoning ? `${cur.name} 正在开心地赶来吧台。` : '左右切换，或按 A / D；双击种种选中，再点一次确认。'}</p>
      <div className="summon-guide" aria-label="选择方法">
        <span>A</span>
        <em>切换种种</em>
        <span>D</span>
      </div>

      <div className="picker" onPointerDown={onDown} onPointerUp={onUp}>
        <button className="picker-arrow" disabled={summoning} onClick={() => go(-1)} aria-label="上一只">
          <span className="pixel-arrow left" aria-hidden="true" />
        </button>

        <div
          className={`hero ${cur.helper ? 'is-helper' : ''} ${heroArmed ? 'is-armed' : ''}`}
          onClick={touchHero}
          onKeyDown={onHeroKeyDown}
          role="button"
          tabIndex={canAct && !summoning ? 0 : -1}
          aria-label={heroArmed ? `确认召唤 ${cur.name}` : `选中 ${cur.name}`}
        >
          <div className={`hero-sprite pet-${cur.id} ${cur.image ? 'has-image' : ''} ${heroArmed ? 'confirm-ready' : ''} ${summoning ? 'happy-summon' : ''}`}>
            {cur.image ? (
              <img className="hero-pet-img sprite-bob" src={cur.image} alt={cur.name} />
            ) : cur.placeholder ? (
              <div className={`placeholder-sprite ${cur.placeholder}`} aria-hidden="true">
                {cur.placeholder === 'plus' ? '+' : '?'}
              </div>
            ) : (
              <PixelSprite sprite={CREATURE} scale={11} colors={{ b: BODY[cur.id] }} className="sprite-bob" />
            )}
            <span className="happy-spark s1" aria-hidden="true" />
            <span className="happy-spark s2" aria-hidden="true" />
            <span className="happy-spark s3" aria-hidden="true" />
            <span className="confirm-orbit" aria-hidden="true" />
            <span className="summon-warrant" aria-hidden="true">
              <span className="warrant-check" />
            </span>
          </div>
          <div className="hero-name">{cur.name}</div>
          <div className="hero-info">
            <div className="hero-style">{cur.style}</div>
            <div className="hero-fit">{cur.fit}</div>
            <div className="hero-blurb">{cur.blurb}</div>
          </div>
        </div>

        <button className="picker-arrow" disabled={summoning} onClick={() => go(1)} aria-label="下一只">
          <span className="pixel-arrow right" aria-hidden="true" />
        </button>
      </div>

      {customOpen && (
        <div className="custom-pet-panel" role="region" aria-label="自定义种种">
          <div className="custom-pet-copy">
            <b>写一张新酒令</b>
            <span>告诉酒馆它是什么原料、什么性格、怎么帮你管理今天。</span>
          </div>
          <div className="custom-pet-form">
            <label>
              <span>名字</span>
              <input
                value={customForm.name}
                maxLength={12}
                onChange={(event) => updateCustom('name', event.target.value)}
                placeholder="比如 星糖种种"
              />
            </label>
            <label>
              <span>灵感原料</span>
              <input
                value={customForm.ingredient}
                onChange={(event) => updateCustom('ingredient', event.target.value)}
                placeholder="比如 柚子、乌龙、软糖"
              />
            </label>
            <label>
              <span>性格</span>
              <input
                value={customForm.personality}
                onChange={(event) => updateCustom('personality', event.target.value)}
                placeholder="比如 温柔但会催我开始"
              />
            </label>
            <label className="wide">
              <span>管理方法</span>
              <textarea
                rows={3}
                value={customForm.method}
                onChange={(event) => updateCustom('method', event.target.value)}
                placeholder="比如 先把卡住的事切小，再安排一段专注调配"
              />
            </label>
          </div>
          <div className="custom-pet-actions">
            <button className="custom-generate" type="button" disabled={generating} onClick={createCustomBartender}>
              {generating ? '正在生成种种' : '生成并召唤'}
            </button>
            <button className="custom-cancel" type="button" disabled={generating} onClick={() => setCustomOpen(false)}>
              收起
            </button>
          </div>
          {generating && (
            <div className="custom-generate-state" role="status">
              <span className="loading-ring" aria-hidden="true" />
              <span>正在调动生图模型，保持透明底和像素桌宠风格。</span>
            </div>
          )}
          {generateError && <div className="custom-generate-error">{generateError}</div>}
        </div>
      )}

      {summoning && (
        <div className="summon-loading" role="status" aria-live="polite">
          <span className="loading-ring" aria-hidden="true" />
          <span>召唤中</span>
        </div>
      )}

      <div className="dots">
        {methodSlots.map((b, i) => (
          <span
            key={b.id}
            className={`dot ${i === idx ? 'on' : ''} ${b.placeholder ? 'placeholder-dot' : ''}`}
            onClick={() => {
              if (summoning) return
              setArmedId(null)
              setIdx(i)
            }}
            style={{ background: i === idx ? accentFor(b) : undefined }}
          />
        ))}
      </div>
    </div>
  )
}
