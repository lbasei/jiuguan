// 步骤一：召唤今天的种种。左右翻 / 拖动直接挑，点击后播放召唤仪式。

import { useEffect, useState, useRef } from 'react'
import { useStore } from '../store/store.jsx'
import { BARTENDERS } from '../data/bartenders.js'
import PixelSprite from '../components/PixelSprite.jsx'
import { CREATURE } from '../components/sprites.js'
import { ensurePetState, pushPetState } from '../engine/petBridge.js'
import { generateCustomPetImage } from '../engine/imageGen.js'
import { requestSeedanceMotion } from '../engine/seedance.js'

export const BODY = {
  rosemary: '#6F8A5B',
  ginger: '#D98A3D',
  mint: '#7FBFA6',
  lemon: '#F3D955',
  garlic: '#DCEBC5',
  cilantro: '#9CC15B',
  osmanthus: '#F4D66C',
  chili: '#EA5A45',
  mint_osmanthus: '#B6DFA5',
  lemon_chili: '#F2A45A',
}

const accentFor = (bartender) => {
  if (bartender?.placeholder) return '#F4D66C'
  return '#58BDB8'
}

const BADGE_LABELS = {
  rosemary: '吧台主理',
  ginger: '启动侍者',
  mint: '缓冲调饮',
  lemon: '清醒试饮',
  garlic: '边界守卫',
  cilantro: '灵活招待',
  chili: '冲刺火手',
  osmanthus: '优雅老板娘',
  mint_osmanthus: '清香双调',
  lemon_chili: '醒神双调',
}

const visitDaysFromState = (state) =>
  Math.max(1, new Set([state.today, ...(state.cellar || []).map((item) => item.date).filter(Boolean)]).size)

const formatClock = (date) =>
  date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

const formatDate = (date) =>
  date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
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
  const [summonBartender, setSummonBartender] = useState(null)
  const [armedId, setArmedId] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
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
  const [currentDate, setCurrentDate] = useState(() => formatDate(new Date()))
  const [petSummonNote, setPetSummonNote] = useState('')
  const [summonMotion, setSummonMotion] = useState({ videoUrl: '' })
  const [arrowFlash, setArrowFlash] = useState('')
  const dragX = useRef(null)
  const summonTimer = useRef(null)
  const arrowTimer = useRef(null)
  const tapTimer = useRef(null)

  const go = (dir) => {
    setArmedId(null)
    setCustomOpen(false)
    setDetailsOpen(false)
    setArrowFlash(dir < 0 ? 'left' : 'right')
    clearTimeout(arrowTimer.current)
    arrowTimer.current = setTimeout(() => setArrowFlash(''), 220)
    setIdx((i) => (i + dir + methodSlots.length) % methodSlots.length)
  }
  const cur = methodSlots[idx] || methodSlots[0]
  const visitDays = visitDaysFromState(state)
  const lockedByVisit = Boolean(cur.unlockDays && visitDays < cur.unlockDays)
  const canSummon = !cur.placeholder && !lockedByVisit
  const canAct = canSummon || cur.helper || cur.customCreator

  useEffect(() => {
    return () => {
      clearTimeout(summonTimer.current)
      clearTimeout(arrowTimer.current)
      clearTimeout(tapTimer.current)
    }
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setCurrentTime(formatClock(now))
      setCurrentDate(formatDate(now))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (summoning) return
    if (canSummon && state.lockedBartenderId) {
      pushPetState({ state: 'idle', bartenderId: state.lockedBartenderId, selected: true, schedule: [], customBartender: cur.custom ? cur : undefined })
    }
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
    const available = BARTENDERS.filter((b) => !b.unlockDays || visitDays >= b.unlockDays)
    const currentRealIndex = available.findIndex((b) => b.id === state.bartenderId)
    const nextRealIndex = (currentRealIndex + 1 + Math.floor(Math.random() * Math.max(1, available.length - 1))) % available.length
    const nextId = available[nextRealIndex]?.id
    const slotIndex = methodSlots.findIndex((b) => b.id === nextId)
    setArmedId(null)
    setIdx(slotIndex >= 0 ? slotIndex : 0)
  }

  const summonDesktopPet = async () => {
    if (lockedByVisit) {
      setPetSummonNote(`${cur.name}还在熟客酒柜里。再来 ${cur.unlockDays - visitDays} 天就能邀请。`)
      return
    }
    if (!canSummon) {
      setPetSummonNote('先选定一只种种，再把它召唤到桌面。')
      return
    }
    const ok = await ensurePetState({
      state: 'idle',
      bartenderId: cur.id,
      selected: true,
      schedule: [],
      customBartender: cur.custom ? cur : undefined,
    })
    setPetSummonNote(ok ? '种种已经在桌面等你。' : '桌面种种暂时没有出现，先打开桌宠预览窗口。')
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
    if (lockedByVisit) {
      setPetSummonNote(`${cur.unlockText || `酒馆来访 ${cur.unlockDays} 天后解锁`}。`)
      setDetailsOpen(true)
      return
    }
    if (!canSummon) return
    setSummonBartender(cur)
    setSummoning(true)
    setSummonMotion({ videoUrl: '' })
    requestSeedanceMotion({ scene: 'walk_to_bar', bartender: cur, referenceImage: cur.image }).then((motion) => {
      setSummonMotion({ videoUrl: motion.videoUrl || '' })
    })
    dispatch({ type: 'SET_BARTENDER', id: cur.id })
    ensurePetState({ state: 'idle', bartenderId: cur.id, selected: true, schedule: [], customBartender: cur.custom ? cur : undefined })
    summonTimer.current = setTimeout(() => {
      dispatch({ type: 'GO', step: 'todos' })
    }, 1650)
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
    if (lockedByVisit) {
      setPetSummonNote(`${cur.unlockText || `酒馆来访 ${cur.unlockDays} 天后解锁`}。`)
      setDetailsOpen(true)
      return
    }
    if (!canSummon) return
    if (event?.detail > 1) {
      clearTimeout(tapTimer.current)
      setDetailsOpen(true)
      return
    }
    clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => {
      summon()
    }, 280)
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
      setSummonBartender(bartender)
      setSummoning(true)
      setSummonMotion({ videoUrl: '' })
      requestSeedanceMotion({ scene: 'walk_to_bar', bartender, referenceImage: bartender.image }).then((motion) => {
        setSummonMotion({ videoUrl: motion.videoUrl || '' })
      })
      ensurePetState({ state: 'idle', bartenderId: id, selected: true, schedule: [], customBartender: bartender })
      summonTimer.current = setTimeout(() => {
        dispatch({ type: 'GO', step: 'todos' })
      }, 850)
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
  const renderPetImage = (bartender, className = 'hero-pet-img sprite-bob') => {
    if (bartender.blendImages?.length) {
      return (
        <div className="blend-pet-pair" aria-label={bartender.name}>
          {bartender.blendImages.slice(0, 2).map((src, index) => (
            <img key={src} className={`blend-pet-img blend-${index}`} src={src} alt="" />
          ))}
        </div>
      )
    }
    return <img className={className} src={bartender.image} alt={bartender.name} />
  }

  return (
    <div className="summon-page">
      <div className="summon-clock" aria-live="polite" aria-label={`现在时间 ${currentTime}`}>
        <span>{currentTime}</span>
        <em>{currentDate}</em>
      </div>
      <p className="subtitle summon-subtitle">{summoning ? `${cur.name} 正在赶来吧台。` : '你想邀请哪只种种一起喝一杯？'}</p>
      <button className="pet-summon-link" type="button" onClick={summonDesktopPet}>
        把种种召唤到桌面
      </button>
      {petSummonNote && <div className="pet-summon-note">{petSummonNote}</div>}

      <div className="picker" onPointerDown={onDown} onPointerUp={onUp}>
        <button className={`picker-arrow ${arrowFlash === 'left' ? 'flash' : ''}`} disabled={summoning} onClick={() => go(-1)} aria-label="上一只">
          <span className="pixel-arrow left" aria-hidden="true" />
        </button>

        <div
          className={`hero ${cur.helper ? 'is-helper' : ''} ${heroArmed ? 'is-armed' : ''}`}
          onClick={touchHero}
          onKeyDown={onHeroKeyDown}
          role="button"
          tabIndex={canAct && !summoning ? 0 : -1}
          aria-label={lockedByVisit ? `${cur.name}尚未解锁` : heroArmed ? `确认召唤 ${cur.name}` : `选中 ${cur.name}`}
        >
          <div className={`hero-sprite pet-${cur.id} ${cur.image ? 'has-image' : ''} ${cur.blendImages ? 'has-blend' : ''} ${lockedByVisit ? 'is-locked' : ''} ${heroArmed ? 'confirm-ready' : ''} ${summoning ? 'happy-summon' : ''}`}>
            {cur.image ? (
              renderPetImage(cur)
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
            {lockedByVisit && <span className="unlock-badge" aria-hidden="true">{cur.unlockDays}日</span>}
            {!cur.helper && <span className={`role-badge badge-${cur.id}`} aria-hidden="true">
              <b>{BADGE_LABELS[cur.id] || '专属调酒师'}</b>
              <i />
            </span>}
          </div>
          <div className="hero-name">{cur.name}</div>
          <div className="hero-tags" aria-label={`${cur.name} 的基础标签`}>
            <span>{lockedByVisit ? cur.unlockText : BADGE_LABELS[cur.id] || cur.style || '今日调酒师'}</span>
            <span>{lockedByVisit ? `还差 ${cur.unlockDays - visitDays} 天熟客记录` : cur.style || cur.fit}</span>
          </div>
        </div>

        <button className={`picker-arrow ${arrowFlash === 'right' ? 'flash' : ''}`} disabled={summoning} onClick={() => go(1)} aria-label="下一只">
          <span className="pixel-arrow right" aria-hidden="true" />
        </button>
      </div>

      {detailsOpen && (
        <div className="sprite-detail-scrim" role="dialog" aria-modal="true" aria-label={`${cur.name}介绍`} onClick={() => setDetailsOpen(false)}>
          <section className="sprite-detail-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="sprite-detail-close" type="button" aria-label="收起介绍" onClick={() => setDetailsOpen(false)}>
              ×
            </button>
            <div className="sprite-detail-image">
              {cur.image ? (
                cur.blendImages?.length ? renderPetImage(cur, 'sprite-detail-img') : <img src={cur.image} alt={cur.name} />
              ) : (
                <PixelSprite sprite={CREATURE} scale={7} colors={{ b: BODY[cur.id] || '#7FBFA6' }} />
              )}
            </div>
            <div className="sprite-detail-copy">
              <span>{BADGE_LABELS[cur.id] || '今日调酒师'}</span>
              <h3>{cur.name}</h3>
              <p>{cur.fit}</p>
              <p>{cur.blurb}</p>
              {lockedByVisit && <p className="unlock-copy">{cur.unlockText}。现在酒馆来访 {visitDays} 天。</p>}
            </div>
            <button className="btn-primary sprite-detail-action" type="button" disabled={lockedByVisit} onClick={summon}>
              {lockedByVisit ? `还差 ${cur.unlockDays - visitDays} 天` : '邀请它'}
            </button>
          </section>
        </div>
      )}

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
        <div className="summon-journey" role="status" aria-live="polite">
          <div className="journey-rail" aria-hidden="true">
            <span className="journey-door left" />
            <span className="journey-door right" />
            <span className="journey-floor f1" />
            <span className="journey-floor f2" />
            <span className="journey-floor f3" />
            <span className="journey-spark j1" />
            <span className="journey-spark j2" />
            <span className="journey-spark j3" />
            {summonMotion.videoUrl ? (
              <video className="journey-video" src={summonMotion.videoUrl} autoPlay muted loop playsInline />
            ) : (
              <div className="journey-pet">
                {(summonBartender || cur).image ? (
                  <img src={(summonBartender || cur).image} alt="" />
                ) : (
                  <PixelSprite sprite={CREATURE} scale={5} colors={{ b: BODY[(summonBartender || cur).id] || '#7FBFA6' }} />
                )}
              </div>
            )}
            <div className="journey-bar">
              <span className="bar-counter" />
              <span className="bar-cup" />
              <span className="bar-lamp" />
            </div>
          </div>
          <span className="journey-copy">种种赶往吧台</span>
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
              setDetailsOpen(false)
              setIdx(i)
            }}
            style={{ background: i === idx ? accentFor(b) : undefined }}
          />
        ))}
      </div>
    </div>
  )
}
