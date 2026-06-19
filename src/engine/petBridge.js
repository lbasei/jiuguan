// 网页 ↔ 桌宠的轻量桥。
// 网页把当前状态 POST 给桌宠；桌宠产生的动作通过主进程队列，网页端 GET 拉取消费。
// 桌宠没开也不报错——fire-and-forget，失败静默。

const PET_URL = 'http://localhost:7878/state'

let lastOk = false
let lastPayload = { state: 'idle', bartenderId: 'rosemary' }
let hb = null
let poll = null
const listeners = new Set()
const actionListeners = new Set()

export const onPetStatus = (fn) => {
  listeners.add(fn)
  fn(lastOk)
  return () => listeners.delete(fn)
}
const setOk = (ok) => {
  if (ok !== lastOk) {
    lastOk = ok
    listeners.forEach((f) => f(ok))
  }
}

export async function pushPetState(payload) {
  if (payload) lastPayload = payload
  try {
    await fetch(PET_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lastPayload),
    })
    setOk(true)
  } catch {
    setOk(false)
  }
}

export const petBrew = (p) => pushPetState({ state: 'brewing', ...p })
export const petIdle = (bartenderId) => pushPetState({ state: 'idle', bartenderId })

// 心跳：持续重推当前状态。桌宠中途启动也能在一拍内自动接上。
export function startPetSync(getPayload) {
  stopPetSync()
  const tick = () => pushPetState(getPayload ? getPayload() : lastPayload)
  tick()
  hb = setInterval(tick, 2500)
}
export function stopPetSync() {
  if (hb) clearInterval(hb)
  hb = null
}

// 轮询桌宠产生的动作（如点击原材料完成）
export function onPetAction(fn) {
  actionListeners.add(fn)
  return () => actionListeners.delete(fn)
}

export function startActionPoll() {
  stopActionPoll()
  const tick = async () => {
    try {
      const res = await fetch(PET_URL)
      const data = await res.json()
      if (data.actions && data.actions.length > 0) {
        data.actions.forEach((action) => actionListeners.forEach((f) => f(action)))
      }
      setOk(true)
    } catch {
      setOk(false)
    }
  }
  tick()
  poll = setInterval(tick, 2500)
}
export function stopActionPoll() {
  if (poll) clearInterval(poll)
  poll = null
}
