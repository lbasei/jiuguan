;(function (root) {
  const spritePlans = {
    idle: {
      name: 'still',
      keyframes: [{ transform: 'translateY(0)' }, { transform: 'translateY(0)' }],
      timing: { duration: 1, iterations: 1, easing: 'linear' },
    },
    done: {
      name: 'bob',
      keyframes: [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }],
      timing: { duration: 1300, iterations: Infinity, easing: 'steps(2)' },
    },
    brewing: {
      name: 'focusBreathe',
      keyframes: [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(0) scale(1.004)' },
        { transform: 'translateY(0) scale(1)' },
      ],
      timing: { duration: 6800, iterations: Infinity, easing: 'ease-in-out' },
    },
  }

  const petPlans = {
    idle: {
      name: 'quietIdle',
      keyframes: [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(0) scale(1.004)' },
        { transform: 'translateY(0) scale(1)' },
      ],
      timing: { duration: 5200, iterations: Infinity, easing: 'ease-in-out' },
    },
    done: {
      name: 'celebrate',
      keyframes: [
        { transform: 'translateY(0) rotate(0deg) scale(1)' },
        { transform: 'translateY(-12px) rotate(-5deg) scale(1.04)' },
        { transform: 'translateY(-6px) rotate(5deg) scale(1.02)' },
        { transform: 'translateY(0) rotate(0deg) scale(1)' },
      ],
      timing: { duration: 820, iterations: Infinity, easing: 'ease-out' },
    },
    brewing: {
      name: 'quietFocus',
      keyframes: [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translateY(0) scale(1.004)', filter: 'brightness(1.01)' },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ],
      timing: { duration: 7200, iterations: Infinity, easing: 'ease-in-out' },
    },
    choosing: {
      name: 'summonPulse',
      keyframes: [
        { transform: 'translateY(0) scale(.94)', filter: 'drop-shadow(0 0 0 rgba(164,124,240,0))' },
        { transform: 'translateY(-7px) scale(1.08)', filter: 'drop-shadow(0 0 10px rgba(164,124,240,.72))' },
        { transform: 'translateY(0) scale(.94)', filter: 'drop-shadow(0 0 0 rgba(164,124,240,0))' },
      ],
      timing: { duration: 1350, iterations: Infinity, easing: 'ease-in-out' },
    },
  }

  const tapPlan = {
    name: 'patBounce',
    keyframes: [
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(8px) scale(1.08, .9)' },
      { transform: 'translateY(-10px) scale(.96, 1.08)' },
      { transform: 'translateY(0) scale(1)' },
    ],
    timing: { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' },
  }

  const pourPlan = {
    name: 'pourIntoCup',
    keyframes: [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: 'translate(52px, 78px) scale(0.2)', opacity: 0 },
    ],
    timing: { duration: 550, fill: 'forwards', easing: 'ease-in' },
  }

  const cupFlashPlan = {
    name: 'cupFlash',
    keyframes: [
      { boxShadow: '0 0 0 #C9FFF0' },
      { boxShadow: '0 0 8px #C9FFF0' },
      { boxShadow: '0 0 0 #C9FFF0' },
    ],
    timing: { duration: 250, easing: 'ease-out' },
  }

  function createAnimationPlan(data) {
    const state = data && data.state ? data.state : 'idle'
    return {
      sprite: spritePlans[state] || spritePlans.idle,
      pet: petPlans[state] || petPlans.idle,
      tap: tapPlan,
      pour: pourPlan,
      cupFlash: cupFlashPlan,
    }
  }

  function play(element, plan) {
    if (!element || !plan || typeof element.animate !== 'function') return null
    const animation = element.animate(applyPetBaseTransform(element, plan.keyframes), plan.timing)
    animation.__petAnimationName = plan.name
    return animation
  }

  function getPetBaseTransform(element) {
    if (element?.dataset?.pet !== 'ginger') return ''
    const island = element.closest?.('#stage')?.classList.contains('island-mode')
    return island ? 'translateY(4px) ' : 'translateY(8px) '
  }

  function applyPetBaseTransform(element, keyframes) {
    const base = getPetBaseTransform(element)
    if (!base) return keyframes
    return keyframes.map((frame) => {
      if (!frame.transform) return frame
      return { ...frame, transform: `${base}${frame.transform}` }
    })
  }

  function createPetAnimations() {
    let spriteAnimation = null
    let spriteAnimationKey = null
    let petAnimation = null
    let petAnimationKey = null

    return {
      setSpriteState(spriteElement, data, parts) {
        const plan = createAnimationPlan(data)
        const legacyPlan = plan.sprite
        if (parts?.image) {
          if (spriteAnimation) {
            spriteAnimation.cancel()
            spriteAnimation = null
            spriteAnimationKey = null
          }
          const nextPetAnimationKey = `${plan.pet.name}:${getPetBaseTransform(parts.image)}`
          if (petAnimationKey !== nextPetAnimationKey) {
            if (petAnimation) petAnimation.cancel()
            petAnimation = play(parts.image, plan.pet)
            petAnimationKey = nextPetAnimationKey
          }
        } else if (spriteAnimationKey !== legacyPlan.name) {
          if (spriteAnimation) spriteAnimation.cancel()
          spriteAnimation = play(spriteElement, legacyPlan)
          spriteAnimationKey = legacyPlan.name
        }
      },
      tapPet(element) {
        return play(element, tapPlan)
      },
      setLegacySpriteState(element, data) {
        const plan = createAnimationPlan(data).sprite
        if (spriteAnimation && spriteAnimation.__petAnimationName === plan.name) return
        if (spriteAnimation) spriteAnimation.cancel()
        spriteAnimation = play(element, plan)
      },
      pourIngredient(element) {
        return play(element, pourPlan)
      },
      flashCup(element) {
        return play(element, cupFlashPlan)
      },
    }
  }

  const api = { createAnimationPlan, createPetAnimations }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  if (root) root.petAnimations = api
})(typeof window !== 'undefined' ? window : globalThis)
