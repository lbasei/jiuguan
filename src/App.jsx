import { useStore, STEPS } from './store/store.jsx'
import { useEffect } from 'react'
import { pushPetState } from './engine/petBridge.js'
import BartenderPage from './pages/BartenderPage.jsx'
import TodoPage from './pages/TodoPage.jsx'
import OptimizePage from './pages/OptimizePage.jsx'
import ExecutePage from './pages/ExecutePage.jsx'
import RevealPage from './pages/RevealPage.jsx'

const STEP_LABEL = {
  bartender: '选小精灵',
  todos: '倒出待办',
  optimize: '小精灵优化',
  execute: '执行',
  reveal: '揭晓',
}

const PAGES = {
  bartender: BartenderPage,
  todos: TodoPage,
  optimize: OptimizePage,
  execute: ExecutePage,
  reveal: RevealPage,
}

export default function App() {
  const { state } = useStore()
  const Page = PAGES[state.step] || BartenderPage
  const curIdx = STEPS.indexOf(state.step)

  // 一旦选定小精灵，在非执行页也保持桌宠形象同步，避免它回到默认色
  useEffect(() => {
    if (!state.lockedBartenderId || state.step === 'execute') return
    const idle = { state: 'idle', bartenderId: state.lockedBartenderId, schedule: [] }
    pushPetState(idle)
    const t = setInterval(() => pushPetState(idle), 5000)
    return () => clearInterval(t)
  }, [state.lockedBartenderId, state.step])

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          Life Kitchen<small>进化酒馆</small>
        </div>
      </div>

      <div className="steps">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`step-dot ${s === state.step ? 'active' : i < curIdx ? 'done' : ''}`}
          >
            {i + 1}. {STEP_LABEL[s]}
          </span>
        ))}
      </div>

      <Page />
    </div>
  )
}
