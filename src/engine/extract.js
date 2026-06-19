// 纯函数：原料层。把 Todo 萃取成原料，并按时间算比例。
// 对应 PRD 5.1 / 10：比例=预计时间占比，浓度=精力，风味=情绪，口感=完成状态。

import { INGREDIENTS } from '../data/ingredients.js'

const FLAVOR_BY_EMOTION = {
  low: ['clean'],
  medium: ['layered'],
  high: ['intense'],
}

// 单个 Todo → 原料对象（ratio 先留空，由 computeRatios 统一计算）
export function todoToIngredient(todo) {
  const base = INGREDIENTS[todo.taskType] || INGREDIENTS.admin
  return {
    id: `ing_${todo.id}`,
    todoId: todo.id,
    sourceTodo: todo.title,
    category: base.category,
    name: base.name,
    emoji: base.emoji,
    color: base.color,
    method: base.method,
    ratio: 0,
    concentration: todo.energyCost, // 浓度由精力消耗决定
    flavor: FLAVOR_BY_EMOTION[todo.emotionalLoad] || ['layered'],
    flavorStrength: todo.emotionalLoad, // 风味强度由情绪负担决定
    statusTaste: todo.status,
    estimatedTime: todo.estimatedTime,
  }
}

// 一批 Todo → 一组原料，比例 = 各任务预计时间 / 今日总时间
export function extractIngredients(todos) {
  const total = todos.reduce((s, t) => s + (t.estimatedTime || 0), 0) || 1
  return todos.map((t) => {
    const ing = todoToIngredient(t)
    ing.ratio = +(ing.estimatedTime / total).toFixed(4)
    return ing
  })
}

// 把同类原料的比例合并，得到"今日配方"——按类别聚合
export function aggregateRecipe(ingredients) {
  const map = {}
  for (const ing of ingredients) {
    if (!map[ing.category]) {
      map[ing.category] = { category: ing.category, name: ing.name, emoji: ing.emoji, color: ing.color, ratio: 0 }
    }
    map[ing.category].ratio += ing.ratio
  }
  return Object.values(map)
    .map((r) => ({ ...r, ratio: +r.ratio.toFixed(4) }))
    .sort((a, b) => b.ratio - a.ratio)
}
