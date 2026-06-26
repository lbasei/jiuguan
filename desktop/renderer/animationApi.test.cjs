const test = require('node:test')
const assert = require('node:assert/strict')

const { createAnimationPlan } = require('./animationApi.js')

test('maps idle and brewing pet states to generated animation plans', () => {
  assert.equal(createAnimationPlan({ state: 'idle' }).sprite.name, 'bob')
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

  assert.equal(idle.pet.name, 'breathe')
  assert.equal(brewing.pet.name, 'quietFocus')
  assert.match(JSON.stringify(idle.pet.keyframes), /scale/)
  assert.match(JSON.stringify(brewing.pet.keyframes), /translateY/)
  assert.equal(createAnimationPlan({ state: 'idle' }).tap.name, 'patBounce')
})

test('brewing animation stays calm for focus mode', () => {
  const brewing = createAnimationPlan({ state: 'brewing' })

  assert.equal(brewing.sprite.timing.duration, 3200)
  assert.equal(brewing.pet.timing.duration, 3600)
  assert.doesNotMatch(JSON.stringify(brewing.pet.keyframes), /rotate/)
})
