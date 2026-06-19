// 桌宠渲染逻辑：可操作的调酒清单 + 杯底分层可视化。
// 点击原材料 = 原料飞入杯中；全部完成后桌宠举着满杯。

const spriteEl = document.getElementById('sprite')
const bubbleEl = document.getElementById('bubble')
const plateEl = document.getElementById('plate')
const counterEl = document.getElementById('counter')
const cupEl = document.getElementById('cup')

let greeted = false
let bubbleTimer = null
let currentBartenderId = 'rosemary'
let lastState = 'idle'
let lastCounterHtml = ''
let lastCupHtml = ''

function render(data) {
  // 防止缺 bartenderId 时闪回默认姜色；固定为最近一次有效值
  if (data.bartenderId) currentBartenderId = data.bartenderId
  const body = window.BODY[currentBartenderId] || '#D98A3D'
  const imgUrl = window.IMAGE?.[currentBartenderId]
  if (imgUrl) {
    spriteEl.innerHTML = `<img src="${imgUrl}" width="108" height="108" style="image-rendering:pixelated; display:block;" alt="${window.NAME[currentBartenderId] || ''}">`
  } else {
    spriteEl.innerHTML = window.renderSprite(window.CREATURE, 9, { b: body })
  }
  plateEl.textContent = window.NAME[currentBartenderId] || '小精灵'

  const schedule = data.schedule || []
  const pending = schedule.filter((t) => t.status !== 'completed' && t.status !== 'skipped')
  const done = schedule.filter((t) => t.status === 'completed' || t.status === 'skipped')

  if (data.state === 'brewing' && data.title) {
    spriteEl.className = 'shake'
    const act = window.ACTION[data.category] || '调制中'
    showBubble(`${escapeHtml(data.title)}<span class="act">${act}…</span>`, 0)
    renderCounter(pending, done, false)
  } else if (data.state === 'done') {
    spriteEl.className = 'bob'
    showBubble('今日特调完成 ✦', 0)
    renderCounter([], done, false)
  } else {
    spriteEl.className = 'bob'
    if (greeted && !counterEl.classList.contains('show')) hideBubble()
    renderCounter(pending, done, true)
  }

  renderCup(done)
  lastState = data.state
}

function renderCounter(pending, done, showIt) {
  let html = ''
  if (pending.length === 0 && done.length === 0) {
    html = '<div class="ingredient"><span class="ing-title">还没有倒出待办</span></div>'
  } else if (pending.length === 0) {
    html = ''
  } else {
    html = pending
      .map(
        (t) => `
      <div class="ingredient" data-id="${escapeHtml(t.id)}" data-status="pending">
        <span class="ing-title">${escapeHtml(t.title)}</span>
        <span class="ing-meta">${t.estimatedTime} 分钟</span>
      </div>`
      )
      .join('')
  }

  if (html === lastCounterHtml) {
    counterEl.classList.toggle('show', showIt && pending.length > 0)
    return
  }
  lastCounterHtml = html
  counterEl.innerHTML = html
  counterEl.classList.toggle('show', showIt && pending.length > 0)

  counterEl.querySelectorAll('.ingredient[data-status="pending"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = el.dataset.id
      if (!id) return
      // 视觉：原料飞入杯中
      el.classList.add('pouring')
      cupEl.classList.remove('pour-flash')
      void cupEl.offsetWidth // 触发重绘
      cupEl.classList.add('pour-flash')
      window.pet?.sendAction?.({ type: 'complete', todoId: id, completedAt: Date.now() })
      // 动画结束后移除元素
      setTimeout(() => {
        if (el.parentNode) el.remove()
      }, 600)
    })
  })
}

// 杯底分层：按已完成顺序，每个任务一层颜色
function renderCup(done) {
  if (done.length === 0) {
    cupEl.classList.remove('show')
    cupEl.innerHTML = ''
    lastCupHtml = ''
    return
  }
  const colors = ['#6F8A5B', '#D98A3D', '#7FBFA6', '#E0CFA0', '#9CC15B', '#B5662A', '#8C3B2B']
  const total = done.length
  const heightPct = 100 / total
  let html = done
    .map((t, i) => {
      const color = colors[i % colors.length]
      return `<div class="layer" style="height:${heightPct}%; bottom:${i * heightPct}%; background:${color};"
        title="${escapeHtml(t.title)}"></div>`
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

// 点击精灵/木牌/满杯：打开揭晓页
function openReveal() {
  window.pet?.openApp?.('reveal')
}
spriteEl.addEventListener('click', (e) => { e.stopPropagation(); openReveal() })
plateEl.addEventListener('click', (e) => { e.stopPropagation(); openReveal() })
cupEl.addEventListener('click', (e) => { e.stopPropagation(); openReveal() })

// 初始 idle + 启动打招呼（4 秒），方便你确认它真的在
render({ state: 'idle', bartenderId: 'rosemary' })
showBubble('今天我来 ✦', 4000)
setTimeout(() => (greeted = true), 4000)

if (window.pet) window.pet.onState(render)
