import { useStore, STEPS } from './store/store.jsx'
import { llmEnabled } from './engine/llm.js'
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

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          Life Kitchen<small>进化酒馆</small>
        </div>
        <span className={`llm-badge ${llmEnabled() ? 'on' : ''}`}>
          {llmEnabled() ? '🟢 真·AI 解析' : '⚪ 规则解析'}
        </span>
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
