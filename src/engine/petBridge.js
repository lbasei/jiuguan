// 网页 → 桌宠的轻量桥。把"当前在做哪类任务"推给本地 Electron 桌宠。
// 桌宠没开也不报错——fire-and-forget，失败静默。
// 自动匹配：心跳每 2.5s 重推当前状态，桌宠任何时候启动都能自动同步、徽标自动亮。

const PET_URL = 'http://localhost:7878/state'

let lastOk = false
let lastPayload = { state: 'idle', bartenderId: 'rosemary' }
let hb = null
const listeners = new Set()

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
