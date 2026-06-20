const DEFAULT_TOTAL_ML = 420
const LIGHT_TOTAL_ML = 260

const VOLUME_RULES = {
  deep_work: { role: 'base', min: 100, max: 280, weight: 1.15 },
  communication: { role: 'base', min: 90, max: 260, weight: 1.05 },
  creative: { role: 'syrup', min: 18, max: 76, weight: 0.75 },
  urgent: { role: 'shot', min: 15, max: 62, weight: 0.7 },
  recovery: { role: 'foam', min: 32, max: 92, weight: 0.82 },
  admin: { role: 'topping', min: 10, max: 42, weight: 0.48 },
  review: { role: 'garnish', min: 8, max: 34, weight: 0.42 },
}

const FALLBACK_RULE = { role: 'syrup', min: 16, max: 72, weight: 0.65 }

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getRule(category) {
  return VOLUME_RULES[category] || FALLBACK_RULE
}

function hasBaseLayer(layers) {
  return layers.some((layer) => getRule(layer.category).role === 'base')
}

function distributeRemaining(layers, remaining) {
  if (remaining <= 0) return
  let left = remaining
  const expandable = layers
    .filter((layer) => getRule(layer.category).role === 'base' && layer.ml < getRule(layer.category).max)
    .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
  while (left > 0.5 && expandable.length) {
    const active = expandable.filter((layer) => layer.ml < getRule(layer.category).max)
    if (!active.length) break
    const totalWeight = active.reduce((sum, layer) => sum + ((layer.ratio || 0.1) * getRule(layer.category).weight), 0) || 1
    let moved = 0
    active.forEach((layer) => {
      const rule = getRule(layer.category)
      const share = left * (((layer.ratio || 0.1) * rule.weight) / totalWeight)
      const add = Math.min(share, rule.max - layer.ml)
      layer.ml += add
      moved += add
    })
    if (moved < 0.5) break
    left -= moved
  }
}

export function getRecipeVolumeLayers(recipe, options = {}) {
  if (!recipe?.length) return []
  const baseTotalMl = options.totalMl || (hasBaseLayer(recipe) ? DEFAULT_TOTAL_ML : LIGHT_TOTAL_ML)
  const layers = recipe.map((layer) => {
    const rule = getRule(layer.category)
    const ratio = Number(layer.ratio || 0)
    const target = baseTotalMl * ratio * rule.weight
    const ml = clamp(target, rule.min, rule.max)
    return {
      ...layer,
      volumeRole: rule.role,
      ml,
    }
  })

  if (hasBaseLayer(layers)) {
    const currentTotal = layers.reduce((sum, layer) => sum + layer.ml, 0)
    distributeRemaining(layers, Math.max(0, baseTotalMl - currentTotal))
  }

  const visualTotalMl = Math.max(baseTotalMl, layers.reduce((sum, layer) => sum + layer.ml, 0))
  return layers.map((layer) => {
    const ml = Math.round(layer.ml)
    return {
      ...layer,
      ml,
      volumeLabel: `${ml}ml`,
      heightPercent: Math.max(3, (layer.ml / visualTotalMl) * 100),
    }
  })
}

export function getIngredientVolume(ingredient, totalMl = DEFAULT_TOTAL_ML) {
  const rule = getRule(ingredient.category)
  const ratio = Number(ingredient.ratio || 0)
  const ml = Math.round(clamp(totalMl * ratio * rule.weight, rule.min, rule.max))
  return { ml, label: `${ml}ml`, role: rule.role }
}
