export function canAutoFinalize() {
  return false
}

export function canCompleteTask({ activeId, todoId }) {
  return Boolean(activeId && todoId && activeId === todoId)
}
