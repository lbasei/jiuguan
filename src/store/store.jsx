// 全局状态：调酒师层 + 原料层 + 进化层的单一数据源。
// engine 是纯函数，store 负责编排它们并落 localStorage。

import { createContext, useContext, useReducer, useEffect } from 'react'
import { getBartender } from '../data/bartenders.js'
import { extractIngredients, aggregateRecipe } from '../engine/extract.js'
import { orderTodos, nameDrink, judgeRecipe, adviseManagement } from '../engine/plan.js'
import { applyExperience } from '../engine/evolve.js'
import { buildReviewCard } from '../engine/review.js'

const STORAGE_KEY = 'life-kitchen-v2'
const StoreCtx = createContext(null)

// 流程：选小精灵 → 倒待办 → 小精灵优化 → 执行 → 揭晓
// 原料/茶底/特调全程隐藏，直到 reveal 才揭晓（保留惊喜）。
export const STEPS = ['bartender', 'todos', 'optimize', 'execute', 'reveal']

const initial = {
  step: 'bartender',
  bartenderId: 'rosemary',
  bartenderNote: '',
  todos: [],
  ingredients: [],
  recipe: [],
  strategy: 'deep_first',
  order: [],
  drinkName: '',
  judge: { warnings: [], comment: '' }, // 揭晓阶段用（含原料名）
  advice: { tips: [], comment: '' }, // 优化阶段用（不剧透原料）
  manualSorted: false,
  absorbed: [], // 已吸收的 EvoMap 经验 id
  records: {}, // todoId -> { status, actualTime, mood }
  reviewCard: null,
  today: new Date().toISOString().slice(0, 10),
}

// 由 todos + strategy 重算整条原料/规划链
function recompute(state) {
  const bartender = getBartender(state.bartenderId)
  const ingredients = extractIngredients(state.todos)
  const recipe = aggregateRecipe(ingredients)
  // 手动排序过就保留用户的顺序，否则按策略重排
  const order = state.manualSorted && state.order.length === state.todos.length
    ? state.order
    : orderTodos(state.todos, state.strategy)
  const drinkName = nameDrink(recipe)
  const judge = judgeRecipe(recipe, bartender)
  const advice = adviseManagement(state.todos, bartender)
  return { ...state, ingredients, recipe, order, drinkName, judge, advice }
}

function reducer(state, action) {
  switch (action.type) {
    case 'GO':
      return { ...state, step: action.step }

    case 'SET_BARTENDER':
      return { ...state, bartenderId: action.id, bartenderNote: action.note || '', strategy: getBartender(action.id).strategy }

    case 'SET_TODOS':
      return recompute({ ...state, todos: action.todos })

    case 'UPDATE_TODO': {
      const todos = state.todos.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t))
      return recompute({ ...state, todos })
    }

    case 'REMOVE_TODO':
      return recompute({ ...state, todos: state.todos.filter((t) => t.id !== action.id) })

    case 'ABSORB': {
      const res = applyExperience(action.exp, state.recipe, getBartender(state.bartenderId))
      const newBartender = getBartender(res.recommendedBartenderId)
      const order = orderTodos(state.todos, res.newStrategy) // 进化后顺序重排（可见的进化效果）
      return {
        ...state,
        recipe: res.recipe,
        strategy: res.newStrategy,
        bartenderId: res.recommendedBartenderId,
        order,
        manualSorted: false,
        drinkName: nameDrink(res.recipe),
        judge: res.judge,
        advice: adviseManagement(state.todos, newBartender),
        absorbed: [...new Set([...state.absorbed, action.exp.id])],
      }
    }

    case 'MOVE_ORDER': {
      const order = [...state.order]
      const j = action.dir === 'up' ? action.index - 1 : action.index + 1
      if (j < 0 || j >= order.length) return state
      ;[order[action.index], order[j]] = [order[j], order[action.index]]
      return { ...state, order, manualSorted: true, strategy: 'manual' }
    }

    case 'SET_RECORD':
      return {
        ...state,
        records: { ...state.records, [action.todoId]: { ...state.records[action.todoId], ...action.record } },
      }

    case 'FINALIZE': {
      const bartender = getBartender(state.bartenderId)
      const records = state.todos.map((t) => {
        const r = state.records[t.id] || {}
        return {
          todoId: t.id,
          taskType: t.taskType,
          status: r.status || 'skipped',
          actualTime: r.actualTime || 0,
          estimatedTime: t.estimatedTime,
        }
      })
      const reviewCard = buildReviewCard({
        date: state.today,
        todos: state.todos,
        ingredients: state.ingredients,
        recipe: state.recipe,
        bartender,
        drinkName: state.drinkName,
        records,
      })
      return { ...state, reviewCard, step: 'reveal' }
    }

    case 'RESET':
      return { ...initial, today: new Date().toISOString().slice(0, 10) }

    default:
      return state
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...initial, ...JSON.parse(raw) }
  } catch {}
  return initial
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])
  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

export const useStore = () => {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}
