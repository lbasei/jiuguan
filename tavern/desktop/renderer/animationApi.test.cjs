const test = require('node:test')
const assert = require('node:assert/strict')

const { createAnimationPlan } = require('./animationApi.js')

test('maps idle and brewing pet states to generated animation plans', () => {
  assert.equal(createAnimationPlan({ state: 'idle' }).sprite.name, 'still')
  assert.equal(createAnimationPlan({ state: 'brewing', category: 'deep_work' }).sprite.name, 'focusBreathe')
})

test('generates pour and cup flash plans for ingredient completion', () => {
  const plan = createAnimationPlan({ state: 'brewing' })

  assert.equal(plan.pour.name, 'pourIntoCup')
  assert.equal(plan.cupFlash.name, 'cupFlash')
  assert.equal(plan.pour.timing.duration, 550)
})

test('generates image animations and tap interaction beyond left-right shaking', () => {
  const idle = createAnimationPlan({ state: 'idle' })
  const brewing = createAnimationPlan({ state: 'brewing' })

  assert.equal(idle.pet.name, 'quietIdle')
  assert.equal(brewing.pet.name, 'quietFocus')
  assert.match(JSON.stringify(idle.pet.keyframes), /scale/)
  assert.match(JSON.stringify(brewing.pet.keyframes), /scale/)
  assert.equal(createAnimationPlan({ state: 'idle' }).tap.name, 'patBounce')
})

test('brewing animation stays calm for focus mode', () => {
  const brewing = createAnimationPlan({ state: 'brewing' })

  assert.equal(brewing.sprite.timing.duration, 6800)
  assert.equal(brewing.pet.timing.duration, 7200)
  assert.doesNotMatch(JSON.stringify(brewing.pet.keyframes), /rotate/)
  assert.doesNotMatch(JSON.stringify(brewing.pet.keyframes), /translateY\(-/)
})

test('idle animation is nearly still for focus-friendly desktop use', () => {
  const idle = createAnimationPlan({ state: 'idle' })

  assert.equal(idle.sprite.timing.iterations, 1)
  assert.doesNotMatch(JSON.stringify(idle.sprite.keyframes), /-6px/)
  assert.equal(idle.pet.timing.duration, 5200)
  assert.doesNotMatch(JSON.stringify(idle.pet.keyframes), /translateY\(-/)
})
