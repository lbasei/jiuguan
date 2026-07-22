// 全局状态：调酒师层 + 原料层 + 进化层的单一数据源。
// engine 是纯函数，store 负责编排它们并落 localStorage。

import { createContext, useContext, useReducer, useEffect } from 'react'
import { getBartender } from '../data/bartenders.js'
import { extractIngredients, aggregateRecipe } from '../engine/extract.js'
import { orderTodos, nameDrink, judgeRecipe, adviseManagement } from '../engine/plan.js'
import { applyRhythmToOrder, buildRhythmAdvisoryTips } from '../engine/rhythm.js'
import { applyExperience } from '../engine/evolve.js'
import { EVOMAP_EXPERIENCES } from '../data/evomap.js'
import { buildReviewCard } from '../engine/review.js'
import { fetchUserHabits } from '../engine/cellarApi.js'
import { setApiAuthToken } from '../engine/apiClient.js'

const STORAGE_KEY = 'life-kitchen-v2'
const StoreCtx = createContext(null)

function makeGuestId() {
  return `guest-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function normalizeProfile(profile = {}) {
  const name = String(profile.name || profile.displayName || '').trim().slice(0, 24)
  return {
    id: profile.id || makeGuestId(),
    name,
    displayName: name,
    gender: ['male', 'female', 'neutral'].includes(profile.gender) ? profile.gender : 'neutral',
    locationLabel: String(profile.locationLabel || profile.locationName || '').trim().slice(0, 36),
    coords: profile.coords || null,
    preferences: String(profile.preferences || '').trim().slice(0, 80),
    avoidances: String(profile.avoidances || '').trim().slice(0, 80),
    habitSummary: String(profile.habitSummary || '').trim().slice(0, 120),
    updatedAt: new Date().toISOString(),
  }
}

function chooseVesselForRecipe(recipe = [], mode = 'daily') {
  if (!recipe.length) return 'highball'
  const cats = recipe.map((r) => r.category)
  const top = cats[0]
  if (mode === 'long_goal') return 'orb'
  if (cats.includes('creative')) return 'coupe'
  if (cats.includes('recovery')) return 'orb'
  if (top === 'communication') return 'wine'
  if (top === 'urgent') return 'rocks'
  if (top === 'admin') return 'tart'
  return ['highball', 'coupe', 'orb', 'rocks'][recipe.length % 4]
}

// 流程：选小精灵 → 倒待办 → 小精灵优化 → 执行 → 揭晓
// 原料/茶底/特调全程隐藏，直到 reveal 才揭晓（保留惊喜）。
export const STEPS = ['bartender', 'todos', 'optimize', 'execute', 'reveal']

const initial = {
  step: 'bartender',
  workflowMode: 'quick',
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
  drinkVessel: 'highball',
  customVesselLabel: '',
  judge: { warnings: [], comment: '' }, // 揭晓阶段用（含原料名）
  advice: { tips: [], comment: '' }, // 优化阶段用（不剧透原料）
  manualSorted: false,
  absorbed: [], // 已吸收的 EvoMap 经验 id
  records: {}, // todoId -> { status, actualTime, mood }
  reviewCard: null,
  cellar: [], // 本地冰柜：保存生成过的今日出品报告
  userProfile: null,
  userHabits: null,
  authToken: '',
  authUser: null,
  today: new Date().toISOString().slice(0, 10),
}

// 由 todos + strategy 重算整条原料/规划链
function recompute(state) {
  const bartender = getBartender(state.bartenderId, state.customBartenders)
  const ingredients = extractIngredients(state.todos)
  const recipe = aggregateRecipe(ingredients)
  // 手动排序过就保留用户的顺序，否则按策略重排
  const todosById = new Map(state.todos.map((todo) => [todo.id, todo]))
  const keptManualOrder = state.manualSorted && state.order.length === state.todos.length
    ? state.order.map((todo) => todosById.get(todo.id)).filter(Boolean)
    : null
  let order = keptManualOrder?.length === state.todos.length
    ? keptManualOrder
    : orderTodos(state.todos, state.strategy)
  if (!keptManualOrder && state.userHabits?.rhythmProfile) {
    order = applyRhythmToOrder(state.todos, order, state.userHabits.rhythmProfile)
  }
  const drinkName = nameDrink(recipe, { bartender, mode: state.assistantMode, todos: state.todos, date: state.today })
  const judge = judgeRecipe(recipe, bartender)
  const advice = adviseManagement(state.todos, bartender)
  if (state.userHabits?.rhythmProfile) {
    const rhythmTips = buildRhythmAdvisoryTips(state.userHabits.rhythmProfile, state.userHabits.stats || {})
    if (rhythmTips.length) {
      advice.tips = [...rhythmTips, ...advice.tips].slice(0, 3)
      advice.comment = `${bartender.name} 为你写下今日酒单：${advice.tips[0]}`
    }
  }
  return { ...state, ingredients, recipe, order, drinkName, judge, advice }
}

function applyAbsorbedExperiences(baseState, absorbedIds = []) {
  const bartender = getBartender(baseState.bartenderId, baseState.customBartenders)
  let nextState = { ...baseState, absorbed: [] }
  absorbedIds.forEach((id) => {
    const exp = EVOMAP_EXPERIENCES.find((item) => item.id === id)
    if (!exp) return
    const res = applyExperience(exp, nextState.recipe, bartender)
    nextState = {
      ...nextState,
      recipe: res.recipe,
      strategy: res.newStrategy,
      order: orderTodos(nextState.todos, res.newStrategy),
      manualSorted: false,
      drinkName: nameDrink(res.recipe, { bartender, mode: nextState.assistantMode, todos: nextState.todos, date: nextState.today }),
      judge: res.judge,
      advice: adviseManagement(nextState.todos, bartender),
      absorbed: [...new Set([...nextState.absorbed, exp.id])],
    }
  })
  return nextState
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

    case 'SET_USER_PROFILE':
      return { ...state, userProfile: normalizeProfile({ ...(state.userProfile || {}), ...(action.profile || {}) }) }

    case 'SET_USER_HABITS':
      return recompute({ ...state, userHabits: action.habits || null })

    case 'SET_AUTH': {
      const authUser = action.user ? normalizeProfile(action.user) : null
      return {
        ...state,
        authToken: action.token || state.authToken || '',
        authUser,
        userProfile: authUser ? normalizeProfile({ ...(state.userProfile || {}), ...authUser }) : state.userProfile,
      }
    }

    case 'LOGOUT':
      return { ...state, authToken: '', authUser: null }

    case 'SET_WORKFLOW_MODE':
      return { ...state, workflowMode: action.mode === 'full' ? 'full' : 'quick' }

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
      return recompute({
        ...state,
        todos: action.todos,
        records: {},
        order: [],
        manualSorted: false,
        activeId: null,
        reviewCard: null,
        assistantMode: action.mode || state.assistantMode,
        sessionNote: action.note || state.sessionNote,
      })

    case 'UPDATE_TODO': {
      const todos = state.todos.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t))
      return recompute({ ...state, todos })
    }

    case 'REORDER_TODOS':
      return recompute({
        ...state,
        todos: action.todos,
        order: action.todos,
        manualSorted: true,
        strategy: 'manual',
      })

    case 'REMOVE_TODO': {
      const records = { ...state.records }
      delete records[action.id]
      return recompute({ ...state, todos: state.todos.filter((t) => t.id !== action.id), records })
    }

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
        drinkName: nameDrink(res.recipe, { bartender: getBartender(state.bartenderId, state.customBartenders), mode: state.assistantMode, todos: state.todos, date: state.today }),
        judge: res.judge,
        advice: adviseManagement(state.todos, getBartender(state.bartenderId, state.customBartenders)),
        absorbed: [...new Set([...state.absorbed, action.exp.id])],
      }
    }

    case 'UNABSORB': {
      const remaining = state.absorbed.filter((id) => id !== action.id)
      return applyAbsorbedExperiences(recompute({ ...state, absorbed: [] }), remaining)
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

    case 'SET_VESSEL':
      return { ...state, drinkVessel: action.vessel || 'highball', customVesselLabel: action.label ?? state.customVesselLabel }

    case 'SET_RECORD':
      return {
        ...state,
        records: { ...state.records, [action.todoId]: { ...state.records[action.todoId], ...action.record } },
      }

    case 'CLEAR_RECORD': {
      const records = { ...state.records }
      delete records[action.todoId]
      return { ...state, records }
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
      const finalDrinkName = finalRecipe.length ? nameDrink(finalRecipe, { bartender, mode: state.assistantMode, todos: completedTodos, date: state.today }) : '空杯'
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
      reviewCard.vessel = state.customVesselLabel ? (state.drinkVessel || 'custom') : chooseVesselForRecipe(finalRecipe, state.assistantMode)
      reviewCard.customVesselLabel = state.customVesselLabel || ''
      reviewCard.userProfile = state.userProfile
      reviewCard.records = records
      return { ...state, reviewCard, ingredients: finalIngredients, recipe: finalRecipe, drinkName: finalDrinkName, step: 'reveal' }
    }

    case 'SAVE_TO_CELLAR': {
      if (!state.reviewCard) return state
      const saved = {
        ...state.reviewCard,
        id: `${state.reviewCard.date}-${state.reviewCard.drinkName}`,
        savedAt: new Date().toISOString(),
        userProfile: state.userProfile,
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
        userProfile: state.userProfile,
        userHabits: state.userHabits,
        authToken: state.authToken,
        authUser: state.authUser,
        customBartenders: state.customBartenders,
        workflowMode: state.workflowMode || 'quick',
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
    setApiAuthToken(state.authToken)
  }, [state.authToken])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])
  useEffect(() => {
    const userId = state.userProfile?.id
    if (!userId || !state.authToken) return
    fetchUserHabits(userId)
      .then((habit) => {
        if (habit) dispatch({ type: 'SET_USER_HABITS', habits: habit })
      })
      .catch(() => {})
  }, [state.userProfile?.id, state.authToken])
  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

export const useStore = () => {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}
