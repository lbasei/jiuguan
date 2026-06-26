import { useStore, STEPS } from './store/store.jsx'
import { useEffect, useRef, useState } from 'react'
import { pushPetState, startActionPoll, stopActionPoll, onPetAction } from './engine/petBridge.js'
import IntroPage from './pages/IntroPage.jsx'
import GuestProfilePage from './pages/GuestProfilePage.jsx'
import BartenderPage from './pages/BartenderPage.jsx'
import TodoPage from './pages/TodoPage.jsx'
import OptimizePage from './pages/OptimizePage.jsx'
import ExecutePage from './pages/ExecutePage.jsx'
import RevealPage from './pages/RevealPage.jsx'

const STEP_META = {
  bartender: { label: '召唤种种', hint: '空杯待命', icon: 'empty-cup' },
  todos: { label: '吧台聊聊', hint: '说说今天的事', icon: 'filled-cup' },
  optimize: { label: '调配酒单', hint: '排好处理顺序', icon: 'receipt' },
  execute: { label: '精灵调配', hint: '种种施一点魔法', icon: 'wand' },
  reveal: { label: '生成饮品', hint: '今日特调完成', icon: 'drink' },
}

const PAGES = {
  bartender: BartenderPage,
  todos: TodoPage,
  optimize: OptimizePage,
  execute: ExecutePage,
  reveal: RevealPage,
}

export default function App() {
  const { state, dispatch } = useStore()
  const [introStage, setIntroStage] = useState('intro')
  const bartenderReadyAt = useRef(0)
  const Page = PAGES[state.step] || BartenderPage
  const curIdx = STEPS.indexOf(state.step)
  const showFlow = state.step !== 'bartender'
  const selectedCustomBartender = state.customBartenders?.find((b) => b.id === state.lockedBartenderId)

  const openGuestProfile = () => {
    dispatch({ type: 'SET_WORKFLOW_MODE', mode: 'full' })
    setIntroStage('guest')
  }

  const startIntro = (mode = 'full') => {
    dispatch({ type: 'SET_WORKFLOW_MODE', mode })
    if (mode === 'quick') {
      const id = state.lockedBartenderId || state.bartenderId || 'lemon'
      if (!state.lockedBartenderId) dispatch({ type: 'SET_BARTENDER', id })
      dispatch({ type: 'SET_ASSISTANT_MODE', mode: 'daily' })
      dispatch({ type: 'GO', step: 'todos' })
    } else {
      dispatch({ type: 'GO', step: 'bartender' })
    }
    setIntroStage('app')
  }

  useEffect(() => {
    if (introStage === 'app' && state.step === 'bartender') {
      bartenderReadyAt.current = Date.now()
    }
  }, [introStage, state.step])

  useEffect(() => {
    if (introStage !== 'app') return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [introStage, state.step])

  // 一旦选定小精灵，在静态页面也保持桌宠形象同步，避免它回到默认色。
  // 酒单页会自己推送调配/倒计时状态，所以这里不抢它的同步。
  useEffect(() => {
    if (!state.lockedBartenderId || state.step === 'execute' || state.step === 'optimize' || state.step === 'bartender') return
    const idle = { state: 'idle', bartenderId: state.lockedBartenderId, selected: true, schedule: [], customBartender: selectedCustomBartender }
    pushPetState(idle)
    const t = setInterval(() => pushPetState(idle), 5000)
    return () => clearInterval(t)
  }, [state.lockedBartenderId, state.step, selectedCustomBartender])

  useEffect(() => {
    if (introStage !== 'app') return undefined
    startActionPoll()
    const off = onPetAction((action) => {
      if (action.type !== 'select-bartender' || !action.bartenderId) return
      if (state.step !== 'bartender') return
      if (!action.selectedAt || action.selectedAt < bartenderReadyAt.current) return
      const customBartender = state.customBartenders?.find((b) => b.id === action.bartenderId)
      dispatch({ type: 'SET_BARTENDER', id: action.bartenderId })
      dispatch({ type: 'GO', step: 'todos' })
      pushPetState({ state: 'idle', bartenderId: action.bartenderId, selected: true, schedule: [], customBartender })
    })
    return () => {
      off()
      stopActionPoll()
    }
  }, [dispatch, introStage, state.step, state.customBartenders])

  if (introStage === 'intro') return <IntroPage onQuickStart={() => startIntro('quick')} onFullStart={() => startIntro('full')} />
  if (introStage === 'guest') return <GuestProfilePage onStart={startIntro} />

  return (
    <div className={`app step-${state.step}`}>
      {showFlow && (
        <div className="topbar">
          <div className="brand">
            Life Kitchen
          </div>
        </div>
      )}

      {showFlow && (
        <div className="steps brew-path" aria-label="饮品生成流程">
          {STEPS.map((s, i) => {
            const meta = STEP_META[s]
            const stepState = s === state.step ? 'current' : i < curIdx ? 'passed' : 'upcoming'
            return (
            <div key={s} className={`brew-step-wrap ${stepState}`}>
              <span className={`step-dot ${s === state.step ? 'active' : i < curIdx ? 'done' : ''}`} aria-current={s === state.step ? 'step' : undefined}>
                <span className={`step-icon ${meta.icon}`} aria-hidden="true">
                  <span className="step-icon-part" />
                </span>
                <span className="step-label">{meta.label}</span>
                <span className="step-hint">{meta.hint}</span>
              </span>
              {i < STEPS.length - 1 && <span className="brew-arrow" aria-hidden="true" />}
            </div>
          )})}
        </div>
      )}

      <Page />
    </div>
  )
}
