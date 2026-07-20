import test from 'node:test'
import assert from 'node:assert/strict'
import { canAutoFinalize, canCompleteTask } from './execution.js'

test('never auto-finalizes after skipped or partially completed tasks', () => {
  const order = [{ id: 'one' }, { id: 'two' }]
  const records = {
    one: { status: 'completed' },
    two: { status: 'skipped' },
  }

  assert.equal(canAutoFinalize({ order, records }), false)
})

test('only the actively timed task can be marked completed', () => {
  assert.equal(canCompleteTask({ activeId: '', todoId: 'one' }), false)
  assert.equal(canCompleteTask({ activeId: 'two', todoId: 'one' }), false)
  assert.equal(canCompleteTask({ activeId: 'one', todoId: 'one' }), true)
})
