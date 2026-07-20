// 桌宠渲染逻辑：可操作的调酒清单 + 杯底分层可视化。
// 点击原材料 = 原料飞入杯中；全部完成后桌宠举着满杯。

const spriteEl = document.getElementById('sprite')
const bubbleEl = document.getElementById('bubble')
const plateEl = document.getElementById('plate')
const counterEl = document.getElementById('counter')
const cupEl = document.getElementById('cup')
const stageEl = document.getElementById('stage')
const magicFxEl = document.getElementById('magicFx')
const petPrevEl = document.getElementById('petPrev')
const petNextEl = document.getElementById('petNext')
const petMoodEl = document.getElementById('petMood')
const petDockEl = document.getElementById('petDock')
const petConfirmEl = document.getElementById('petConfirm')
const timerChipEl = document.getElementById('timerChip')
const timerTextEl = document.getElementById('timerText')
const islandCompleteEl = document.getElementById('islandComplete')
const islandTaskEl = document.getElementById('islandTask')
const animationApi = window.petAnimations?.createPetAnimations?.()

let greeted = false
let bubbleTimer = null
let currentBartenderId = 'rosemary'
let currentCustomBartender = null
let lastState = 'idle'
let lastCounterHtml = ''
let lastCupHtml = ''
let dragState = null
let suppressNextClick = false
let currentPetImageEl = null
let chooserIndex = 0
let petMode = 'normal'
let countdownTimer = null
let countdownStartedAt = 0
let countdownPlannedSec = 0
let countdownLastText = ''
let activeBrewKey = ''
let activeIslandTodoId = ''
let focusModeActive = false
let ticketOpen = false
let boardCollapsed = false
let lastScheduleKey = ''

function setLocalMode(mode) {
  petMode = mode === 'island' ? 'island' : 'normal'
  stageEl.classList.toggle('island-mode', petMode === 'island')
  petDockEl.setAttribute('aria-label', petMode === 'island' ? '计时器运行中' : '进入像素计时器')
  if (currentPetImageEl) {
    animationApi?.setSpriteState(spriteEl, { state: lastState }, { image: currentPetImageEl })
  }
}

function render(data) {
  stageEl.classList.remove('choosing-mode')
  if (data.state === 'choosing' && data.allowDesktopChoice) {
    cacheCustomBartender(data.customBartender)
    renderChooser(data)
    return
  }

  // 防止缺 bartenderId 时闪回默认姜色；固定为最近一次有效值
  if (data.bartenderId) currentBartenderId = data.bartenderId
  cacheCustomBartender(data.customBartender)
  stageEl.dataset.pet = currentBartenderId
  spriteEl.dataset.pet = currentBartenderId
  const customPet = getCustomPet(currentBartenderId)
  const body = window.BODY[currentBartenderId] || '#D98A3D'
  const imgUrl = customPet?.image || window.PET_IMAGE || window.IMAGE?.[currentBartenderId]
  if (imgUrl) {
    spriteEl.innerHTML = `<img src="${escapeAttr(imgUrl)}" alt="${escapeAttr(customPet?.name || window.NAME[currentBartenderId] || '')}" draggable="false">`
    currentPetImageEl = spriteEl.querySelector('img')
    currentPetImageEl.dataset.pet = currentBartenderId
  } else {
    spriteEl.innerHTML = window.renderSprite(window.CREATURE, 9, { b: body })
    currentPetImageEl = null
  }
  plateEl.textContent = ''

  const schedule = data.schedule || []
  const scheduleKey = schedule.map((t) => `${t.id || t.title}:${t.status || 'pending'}`).join('|')
  if (scheduleKey !== lastScheduleKey) {
    lastScheduleKey = scheduleKey
    boardCollapsed = false
  }
  const pending = schedule.filter((t) => t.status !== 'completed' && t.status !== 'skipped')
  const done = schedule.filter((t) => t.status === 'completed' || t.status === 'skipped')

  if (data.state === 'brewing' && data.title) {
    spriteEl.className = animationApi ? '' : 'focus'
    animationApi?.setSpriteState(spriteEl, data, { image: currentPetImageEl })
    const act = window.ACTION[data.category] || '调制中'
    showBubble(`${escapeHtml(data.title)}<span class="act">${act}…</span>`, 0)
    activeIslandTodoId = data.activeTodoId || pending[0]?.id || ''
    const islandTask = data.title || pending.find((t) => t.id === activeIslandTodoId)?.title || pending[0]?.title || ''
    setIslandTask(islandTask)
    islandCompleteEl?.classList.toggle('show', !!activeIslandTodoId)
    startCountdown(data)
    setLocalMode('island')
    window.pet?.setMode?.('island')
    ticketOpen = false
    renderCounter(pending, done, false, { state: data.state, activeTodoId: activeIslandTodoId })
  } else if (data.state === 'done') {
    spriteEl.className = animationApi ? '' : 'bob'
    animationApi?.setSpriteState(spriteEl, data, { image: currentPetImageEl })
    showBubble('今日特调完成 ✦', 0)
    stopCountdown()
    activeIslandTodoId = ''
    setIslandTask('')
    islandCompleteEl?.classList.remove('show')
    setLocalMode('normal')
    window.pet?.setMode?.('normal')
    ticketOpen = false
    renderCounter([], done, done.length > 0 && !boardCollapsed)
  } else {
    spriteEl.className = animationApi ? '' : 'bob'
    animationApi?.setSpriteState(spriteEl, data, { image: currentPetImageEl })
    if (greeted && !counterEl.classList.contains('show')) hideBubble()
    if (!focusModeActive) stopCountdown()
    activeIslandTodoId = ''
    if (!focusModeActive) setIslandTask('')
    islandCompleteEl?.classList.remove('show')
    if (!focusModeActive && petMode === 'island') {
      setLocalMode('normal')
      window.pet?.setMode?.('normal')
    }
    renderCounter(pending, done, (pending.length + done.length > 0 && !boardCollapsed) || ticketOpen, {
      state: data.state,
      activeTodoId: data.activeTodoId || '',
    })
  }

  renderCup(done)
  lastState = data.state
}

function cacheCustomBartender(customBartender) {
  if (customBartender?.id && customBartender?.image) currentCustomBartender = customBartender
}

function getCustomPet(id) {
  return currentCustomBartender?.id === id ? currentCustomBartender : null
}

function getChooserIds() {
  const ids = [...(window.BARTENDER_IDS || Object.keys(window.NAME || {}))]
  if (currentCustomBartender?.id && !ids.includes(currentCustomBartender.id)) ids.unshift(currentCustomBartender.id)
  return ids
}

function renderChooser(data) {
  const ids = getChooserIds()
  const nextIndex = ids.indexOf(data?.bartenderId || currentBartenderId)
  chooserIndex = nextIndex >= 0 ? nextIndex : 0
  stageEl.classList.add('choosing-mode')
  paintChooser()
  stopCountdown()
  lastState = 'choosing'
}

function paintChooser() {
  const ids = getChooserIds()
  if (!ids.length) return
  currentBartenderId = ids[(chooserIndex + ids.length) % ids.length]
  stageEl.dataset.pet = currentBartenderId
  spriteEl.dataset.pet = currentBartenderId
  const customPet = getCustomPet(currentBartenderId)
  const imgUrl = customPet?.image || window.IMAGE?.[currentBartenderId]
  const body = window.BODY[currentBartenderId] || '#D98A3D'
  if (imgUrl) {
    spriteEl.innerHTML = `<img src="${escapeAttr(imgUrl)}" alt="${escapeAttr(customPet?.name || window.NAME[currentBartenderId] || '')}" draggable="false">`
    currentPetImageEl = spriteEl.querySelector('img')
    currentPetImageEl.dataset.pet = currentBartenderId
  } else {
    spriteEl.innerHTML = window.renderSprite(window.CREATURE, 9, { b: body })
    currentPetImageEl = null
  }
  spriteEl.className = animationApi ? 'choosing' : 'bob'
  animationApi?.setSpriteState(spriteEl, { state: 'choosing' }, { image: currentPetImageEl })
  plateEl.textContent = ''
  cupEl.classList.remove('show')
  counterEl.classList.remove('show')
  showBubble('<span class="summon-call">确认召唤</span>', 0)
}

function moveChooser(dir) {
  const ids = getChooserIds()
  if (!ids.length) return
  chooserIndex = (chooserIndex + dir + ids.length) % ids.length
  paintChooser()
}

function formatTime(sec) {
  const safe = Math.max(0, Math.floor(sec))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function renderCountdown() {
  const elapsed = Math.max(0, Math.floor((Date.now() - countdownStartedAt) / 1000))
  const isOver = countdownPlannedSec > 0 && elapsed > countdownPlannedSec
  const remaining = countdownPlannedSec > 0 ? Math.max(0, countdownPlannedSec - elapsed) : elapsed
  const text = isOver ? `+${formatTime(elapsed - countdownPlannedSec)}` : formatTime(remaining)
  if (text !== countdownLastText) {
    countdownLastText = text
    timerTextEl.textContent = text
  }
  timerChipEl.classList.toggle('over', isOver)
  timerChipEl.classList.add('show')
}

function setIslandTask(title = '') {
  if (!islandTaskEl) return
  islandTaskEl.textContent = title || ''
  islandTaskEl.title = title || ''
  islandTaskEl.classList.toggle('show', Boolean(title))
}

function startCountdown(data) {
  focusModeActive = false
  const duration = Number(data.durationSec || 0)
  if (!duration) {
    stopCountdown()
    return
  }
  const key = `${data.title || ''}-${duration}`
  if (key !== activeBrewKey || !countdownStartedAt) {
    activeBrewKey = key
    countdownStartedAt = Date.now()
    countdownPlannedSec = duration
  }
  if (countdownTimer) clearInterval(countdownTimer)
  renderCountdown()
  countdownTimer = setInterval(renderCountdown, 250)
}

function startFocusCountdown(durationSec = 25 * 60) {
  focusModeActive = true
  activeBrewKey = 'focus'
  countdownStartedAt = Date.now()
  countdownPlannedSec = durationSec
  if (countdownTimer) clearInterval(countdownTimer)
  renderCountdown()
  countdownTimer = setInterval(renderCountdown, 250)
}

function stopCountdown() {
  focusModeActive = false
  activeBrewKey = ''
  countdownStartedAt = 0
  countdownPlannedSec = 0
  countdownLastText = ''
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = null
  timerChipEl.classList.remove('show', 'over')
}

function renderCounter(pending, done, showIt, options = {}) {
  let html = ''
  if (pending.length === 0 && done.length === 0) {
    html = ''
  } else {
    const total = pending.length + done.length
    const current = pending.find((t) => t.id === options.activeTodoId) || pending[0]
    const progressHtml = Array.from({ length: total })
      .map((_, index) => {
        const cls = index < done.length ? 'done' : index === done.length ? 'current' : ''
        return `<span class="${cls}" aria-hidden="true"></span>`
      })
      .join('')
    html = `
      <div class="ticket-progress">${progressHtml}</div>
      <div class="counter-compact">
        <small>${done.length}/${total}</small>
        ${current
          ? `<button class="task-start compact-start" data-action="start" data-id="${escapeAttr(current.id)}" aria-label="开始当前任务"></button>`
          : `<button class="compact-finalize" data-action="finalize" aria-label="生成饮品"></button>`}
      </div>`
  }

  counterEl.dataset.hasTasks = pending.length + done.length > 0 ? '1' : '0'
  if (html === lastCounterHtml) {
    counterEl.classList.toggle('show', showIt)
    return
  }
  lastCounterHtml = html
  counterEl.innerHTML = html
  counterEl.classList.toggle('show', showIt)

  counterEl.querySelectorAll('[data-action="start"]').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = button.dataset.id
      if (!id) return
      button.disabled = true
      window.pet?.sendAction?.({ type: 'start', todoId: id, startedAt: Date.now() })
      showBubble('开始调配 ✦', 900)
    })
  })
  counterEl.querySelector('[data-action="finalize"]')?.addEventListener('click', (e) => {
    e.stopPropagation()
    window.pet?.sendAction?.({ type: 'finalize', requestedAt: Date.now() })
    showBubble('准备出杯 ✦', 1200)
  })
}

const PET_VOLUME_RULES = {
  deep_work: { color: '#A66A3F', min: 18, max: 58, weight: 1.15 },
  communication: { color: '#78B9C8', min: 16, max: 54, weight: 1.05 },
  creative: { color: '#E9A86A', min: 8, max: 22, weight: 0.75 },
  urgent: { color: '#D86F63', min: 7, max: 18, weight: 0.7 },
  recovery: { color: '#F4E9D2', min: 10, max: 24, weight: 0.82 },
  admin: { color: '#B8A7D8', min: 5, max: 13, weight: 0.48 },
  review: { color: '#86B98A', min: 4, max: 11, weight: 0.42 },
}
const PET_FALLBACK_COLORS = ['#A66A3F', '#E9A86A', '#78B9C8', '#F4E9D2', '#B8A7D8', '#86B98A', '#D86F63']
const PET_FALLBACK_RULE = { min: 7, max: 32, weight: 0.75 }

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getPetLayer(t, index, totalMinutes) {
  const category = t.category || t.taskType
  const rule = PET_VOLUME_RULES[category] || PET_FALLBACK_RULE
  const minutes = Number(t.estimatedTime || 1)
  const raw = (minutes / totalMinutes) * 100 * rule.weight
  const ml = Math.round(clamp(raw, rule.min, rule.max))
  return {
    color: rule.color || PET_FALLBACK_COLORS[index % PET_FALLBACK_COLORS.length],
    ml,
    title: `${t.title || '已完成'} ${ml}ml`,
  }
}

// 杯底分层：按饮品 ml 容量画，不再把每个完成项平均切块
function renderCup(done) {
  if (done.length === 0) {
    cupEl.classList.remove('show')
    cupEl.innerHTML = ''
    lastCupHtml = ''
    return
  }
  const totalMinutes = done.reduce((sum, t) => sum + Number(t.estimatedTime || 1), 0) || 1
  const layers = done.map((t, i) => getPetLayer(t, i, totalMinutes))
  const totalMl = layers.reduce((sum, layer) => sum + layer.ml, 0) || 1
  let bottomPct = 0
  let html = layers
    .map((layer) => {
      const heightPct = (layer.ml / totalMl) * 100
      const markup = `<div class="layer" style="height:${heightPct}%; bottom:${bottomPct}%; background:${layer.color};"
        title="${escapeHtml(layer.title)}"></div>`
      bottomPct += heightPct
      return markup
    })
    .join('')

  if (html !== lastCupHtml) {
    lastCupHtml = html
    cupEl.innerHTML = html
  }
  cupEl.classList.add('show')
}

function showBubble(html, autoHideMs) {
  clearTimeout(bubbleTimer)
  bubbleEl.innerHTML = html
  bubbleEl.classList.add('show')
  if (autoHideMs) bubbleTimer = setTimeout(hideBubble, autoHideMs)
}
function hideBubble() {
  bubbleEl.classList.remove('show')
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

// 点击精灵/木牌/满杯：打开揭晓页
function openReveal() {
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }
  window.pet?.openApp?.('reveal')
}
function confirmChooser() {
  window.pet?.selectBartender?.(currentBartenderId)
  playMagicFx('summon')
  showBubble('已上岗 ✦', 1000)
  lastState = 'idle'
  stageEl.classList.remove('choosing-mode')
}
function toggleTicket() {
  if (lastState === 'choosing') return false
  const hasMenu = counterEl.dataset.hasTasks === '1' && lastCounterHtml.includes('ticket-progress')
  if (!hasMenu) return false
  const isOpen = counterEl.classList.contains('show')
  boardCollapsed = isOpen
  ticketOpen = !isOpen
  counterEl.classList.toggle('show', ticketOpen)
  if (ticketOpen) showBubble('进度已展开', 900)
  return true
}
function patPet() {
  if (suppressNextClick) {
    suppressNextClick = false
    return false
  }
  animationApi?.tapPet(currentPetImageEl || spriteEl)
  playMagicFx('toast')
  showBubble('摸摸收到 ✦', 1200)
  return true
}
function cheerPet() {
  animationApi?.tapPet(currentPetImageEl || spriteEl)
  playMagicFx('toast')
  const lines = ['心情 +1 ✦', '魔力回满一点点', '收到摸摸，今天会乖乖陪你', '种种开心地发光了']
  showBubble(lines[Math.floor(Math.random() * lines.length)], 1300)
}
function enterFocusClock() {
  if (!countdownStartedAt) startFocusCountdown()
  setIslandTask('专注钟')
  setLocalMode('island')
  window.pet?.setMode?.('island')
  showBubble('计时开始 ✦', 1200)
}
function playMagicFx(kind) {
  if (!magicFxEl) return
  magicFxEl.className = ''
  void magicFxEl.offsetWidth
  magicFxEl.classList.add('show', kind)
  setTimeout(() => magicFxEl.className = '', kind === 'summon' ? 1050 : 900)
}
function isInteractiveTarget(target) {
  return target.closest?.('button, .chooser-arrow, .ingredient, #cup, #petControls')
}
function startManualDrag(e) {
  if (dragState) return
  if (e.button != null && e.button !== 0) return
  if (isInteractiveTarget(e.target)) return
  dragState = {
    pointerId: e.pointerId,
    x: e.screenX,
    y: e.screenY,
    total: 0,
    moved: false,
    target: stageEl,
  }
  window.pet?.beginDrag?.()
  stageEl.setPointerCapture?.(e.pointerId)
  stageEl.classList.add('dragging')
  window.addEventListener('pointermove', moveManualDrag)
  window.addEventListener('pointerup', stopManualDrag)
  window.addEventListener('pointercancel', stopManualDrag)
}
function moveManualDrag(e) {
  if (!dragState || dragState.pointerId !== e.pointerId) return
  const dx = e.screenX - dragState.x
  const dy = e.screenY - dragState.y
  if (Math.abs(dx) + Math.abs(dy) < 1) return
  dragState.x = e.screenX
  dragState.y = e.screenY
  dragState.total += Math.abs(dx) + Math.abs(dy)
  if (dragState.total > 5) dragState.moved = true
}
function stopManualDrag(e) {
  if (!dragState || dragState.pointerId !== e.pointerId) return
  dragState.target?.releasePointerCapture?.(e.pointerId)
  dragState.target?.classList.remove('dragging')
  if (dragState.moved) suppressNextClick = true
  dragState = null
  window.pet?.endDrag?.()
  window.removeEventListener('pointermove', moveManualDrag)
  window.removeEventListener('pointerup', stopManualDrag)
  window.removeEventListener('pointercancel', stopManualDrag)
}
function bindChooserButton(el, dir) {
  el?.addEventListener('pointerdown', (e) => {
    e.stopPropagation()
    e.preventDefault()
    el.setPointerCapture?.(e.pointerId)
  })
  el?.addEventListener('pointerup', (e) => {
    e.stopPropagation()
    e.preventDefault()
    el.releasePointerCapture?.(e.pointerId)
    moveChooser(dir)
  })
  el?.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
  })
}
spriteEl.addEventListener('click', (e) => {
  e.stopPropagation()
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }
  if (lastState === 'choosing') {
    confirmChooser()
    return
  }
  if (toggleTicket()) return
  patPet()
})
plateEl.addEventListener('click', (e) => {
  e.stopPropagation()
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }
  if (lastState === 'choosing') {
    confirmChooser()
    return
  }
  if (toggleTicket()) return
  patPet()
})
cupEl.addEventListener('click', (e) => { e.stopPropagation(); openReveal() })
bindChooserButton(petPrevEl, -1)
bindChooserButton(petNextEl, 1)
petConfirmEl?.addEventListener('click', (e) => {
  e.stopPropagation()
  if (lastState === 'choosing') confirmChooser()
})
petMoodEl?.addEventListener('click', (e) => { e.stopPropagation(); cheerPet() })
petDockEl?.addEventListener('click', (e) => {
  e.stopPropagation()
  enterFocusClock()
})
islandCompleteEl?.addEventListener('click', (e) => {
  e.stopPropagation()
  if (!activeIslandTodoId) return
  const id = activeIslandTodoId
  activeIslandTodoId = ''
  setIslandTask('')
  islandCompleteEl.classList.remove('show')
  cupEl.classList.remove('pour-flash')
  void cupEl.offsetWidth
  cupEl.classList.add('pour-flash')
  animationApi?.flashCup(cupEl)
  window.pet?.sendAction?.({ type: 'complete', todoId: id, completedAt: Date.now() })
  showBubble('这一项完成 ✦', 900)
})
stageEl.addEventListener('pointerdown', startManualDrag, true)
stageEl.addEventListener('click', (e) => {
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }
  if (petMode !== 'island') return
  e.stopPropagation()
  setLocalMode('normal')
  window.pet?.setMode?.('normal')
})

// 初始 idle + 启动打招呼（4 秒），方便你确认它真的在
render({ state: 'idle', bartenderId: 'rosemary' })
showBubble('', 1)
setTimeout(() => (greeted = true), 4000)

if (window.pet) window.pet.onState(render)
if (window.pet) window.pet.onMode?.(setLocalMode)
