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
  bartenderId: 'lemon',
  lockedBartenderId: null, // 用户选定后锁定，全程不变
  bartenderNote: '',
  assistantMode: 'daily',
  sessionNote: '',
  customBartenders: [],
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
  cellar: [], // 本地酒柜：保存生成过的今日特调报告
  today: new Date().toISOString().slice(0, 10),
}

// 由 todos + strategy 重算整条原料/规划链
function recompute(state) {
  const bartender = getBartender(state.bartenderId, state.customBartenders)
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

    case 'SET_BARTENDER': {
      const id = action.id
      return {
        ...state,
        bartenderId: id,
        lockedBartenderId: id,
        bartenderNote: action.note || '',
        strategy: getBartender(id, state.customBartenders).strategy,
      }
    }

    case 'SET_ASSISTANT_MODE':
      return { ...state, assistantMode: action.mode || 'daily' }

    case 'ADD_CUSTOM_BARTENDER': {
      const bartender = action.bartender
      if (!bartender?.id) return state
      const customBartenders = [bartender, ...state.customBartenders.filter((b) => b.id !== bartender.id)].slice(0, 8)
      return {
        ...state,
        customBartenders,
        bartenderId: bartender.id,
        lockedBartenderId: bartender.id,
        strategy: bartender.strategy,
      }
    }

    case 'SET_TODOS':
      return recompute({ ...state, todos: action.todos, assistantMode: action.mode || state.assistantMode, sessionNote: action.note || state.sessionNote })

    case 'UPDATE_TODO': {
      const todos = state.todos.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t))
      return recompute({ ...state, todos })
    }

    case 'REMOVE_TODO':
      return recompute({ ...state, todos: state.todos.filter((t) => t.id !== action.id) })

    case 'ABSORB': {
      const res = applyExperience(action.exp, state.recipe, getBartender(state.bartenderId, state.customBartenders))
      // 小精灵形象锁定不变，只借用经验的策略和配方微调
      const newStrategy = res.newStrategy
      const order = orderTodos(state.todos, newStrategy)
      return {
        ...state,
        recipe: res.recipe,
        strategy: newStrategy,
        order,
        manualSorted: false,
        drinkName: nameDrink(res.recipe),
        judge: res.judge,
        advice: adviseManagement(state.todos, getBartender(state.bartenderId, state.customBartenders)),
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

    case 'SET_ORDER':
      return { ...state, order: action.order, manualSorted: true, strategy: 'manual' }

    case 'SET_RECORD':
      return {
        ...state,
        records: { ...state.records, [action.todoId]: { ...state.records[action.todoId], ...action.record } },
      }

    case 'FINALIZE': {
      const bartender = getBartender(state.bartenderId, state.customBartenders)
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
      const completedIds = new Set(records.filter((r) => r.status === 'completed').map((r) => r.todoId))
      const completedTodos = state.todos.filter((t) => completedIds.has(t.id))
      const finalIngredients = extractIngredients(completedTodos)
      const finalRecipe = aggregateRecipe(finalIngredients)
      const finalDrinkName = finalRecipe.length ? nameDrink(finalRecipe) : '空杯'
      const reviewCard = buildReviewCard({
        date: state.today,
        todos: state.todos,
        mode: state.assistantMode,
        sessionNote: state.sessionNote,
        ingredients: finalIngredients,
        recipe: finalRecipe,
        bartender,
        drinkName: finalDrinkName,
        records,
      })
      return { ...state, reviewCard, ingredients: finalIngredients, recipe: finalRecipe, drinkName: finalDrinkName, step: 'reveal' }
    }

    case 'SAVE_TO_CELLAR': {
      if (!state.reviewCard) return state
      const saved = {
        ...state.reviewCard,
        id: `${state.reviewCard.date}-${state.reviewCard.drinkName}`,
        savedAt: new Date().toISOString(),
      }
      const cellar = [saved, ...state.cellar.filter((item) => item.id !== saved.id)].slice(0, 12)
      return { ...state, cellar }
    }

    case 'RESET':
      return {
        ...initial,
        bartenderId: state.lockedBartenderId || state.bartenderId,
        lockedBartenderId: state.lockedBartenderId,
        cellar: state.cellar,
        customBartenders: state.customBartenders,
        today: new Date().toISOString().slice(0, 10),
      }

    default:
      return state
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // 兼容旧数据：锁定小精灵为当前 bartenderId
      if (!parsed.lockedBartenderId) parsed.lockedBartenderId = parsed.bartenderId || 'rosemary'
      return { ...initial, ...parsed }
    }
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
