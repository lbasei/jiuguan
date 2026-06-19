// 桌宠渲染逻辑：按主进程推来的状态切换小精灵的颜色与动画。
// idle → 轻轻晃；brewing → 摇杯 + 气泡显示在做的事和手法。木牌始终显示当前小精灵名。

const spriteEl = document.getElementById('sprite')
const bubbleEl = document.getElementById('bubble')
const plateEl = document.getElementById('plate')

let greeted = false
let bubbleTimer = null

function render(data) {
  const body = window.BODY[data.bartenderId] || '#D98A3D'
  spriteEl.innerHTML = window.renderSprite(window.CREATURE, 11, { b: body })
  plateEl.textContent = window.NAME[data.bartenderId] || '小精灵'

  if (data.state === 'brewing') {
    spriteEl.className = 'shake'
    const act = window.ACTION[data.category] || '调制中'
    showBubble(`${escapeHtml(data.title || '忙活中')}<span class="act">${act}…</span>`, 0)
  } else {
    spriteEl.className = 'bob'
    if (greeted) hideBubble()
  }
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

// 初始 idle + 启动打招呼（4 秒），方便你确认它真的在
render({ state: 'idle', bartenderId: 'rosemary' })
showBubble('今天我来 ✦', 4000)
setTimeout(() => (greeted = true), 4000)

if (window.pet) window.pet.onState(render)
