/* ============================================================================
 * Life Kitchen · Landing 渲染 + 交互
 * 从 window.LK（data.js）渲染各区块，挂导航高亮、进店跳转、移动端菜单。
 * 纯原生 JS，无依赖，可直接 file:// 打开。
 * ========================================================================== */
(function () {
  const LK = window.LK
  const $ = (sel, root = document) => root.querySelector(sel)
  const el = (tag, cls, html) => {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (html != null) n.innerHTML = html
    return n
  }
  const colorOf = (cat) => (LK.INGREDIENTS.find((i) => i.category === cat) || {}).color || '#7EDFD8'
  const ingredientOf = (cat) => LK.INGREDIENTS.find((i) => i.category === cat) || { name: cat, emoji: '·' }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  /* —— 进店：点击 → 推门动画 → 同标签跳转游戏 —— */
  function wireEnter() {
    const url = LK.GAME_URL
    const overlay = $('#doorTransition')
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let leaving = false
    const enter = (e) => {
      // ⌘/Ctrl/Shift/中键 → 放行默认行为（在新标签打开），不拦截
      if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)) return
      if (e) e.preventDefault()
      if (leaving) return
      leaving = true
      if (!overlay || reduce) { window.location.href = url; return }
      overlay.classList.add('show')
      void overlay.offsetWidth // 强制回流，确保动画每次从头播放
      overlay.classList.add('opening')
      window.setTimeout(() => { window.location.href = url }, 880)
    }
    ;['#enterSpell', '#enterSpellFooter', '#navEnter'].forEach((sel) => {
      const node = $(sel)
      if (node) {
        node.setAttribute('href', url) // 保留 href：右键/新标签打开仍可用，JS 失效也能跳
        node.addEventListener('click', enter)
      }
    })
  }

  /* —— hero 底部一排小精灵探头 —— */
  function renderHeroBar() {
    const bar = $('#heroBar')
    LK.BARTENDERS.forEach((b) => {
      const img = el('img')
      img.src = b.img
      img.alt = b.name
      img.loading = 'lazy'
      bar.appendChild(img)
    })
  }

  /* —— 小精灵图鉴 —— */
  function renderSprites() {
    const grid = $('#spritesGrid')
    LK.BARTENDERS.forEach((b) => {
      const card = el('div', 'card lift sprite-card')
      card.innerHTML = `
        <div class="sprite-stage"><img src="${b.img}" alt="${esc(b.name)}" loading="lazy" /></div>
        <div class="sprite-name">${esc(b.name)}</div>
        <span class="sprite-style">${esc(b.style)}</span>
        <p class="sprite-blurb">「${esc(b.blurb)}」</p>
        <p class="sprite-fit">适合：${esc(b.fit)}</p>
        <div class="sprite-meta">
          <span class="chip strat">调法 · ${esc(b.strategyName)}</span>
          <span class="chip">口吻 · ${esc(b.tone)}</span>
        </div>`
      grid.appendChild(card)
    })
  }

  /* —— 原料图鉴 —— */
  function renderIngredients() {
    const grid = $('#ingredientsGrid')
    LK.INGREDIENTS.forEach((ing) => {
      const card = el('div', 'card lift ingredient-card')
      card.innerHTML = `
        <div class="vial">
          <div class="fill" style="background:${ing.color}"></div>
          <span class="bubble"></span>
        </div>
        <div>
          <div class="ingredient-top">
            <span class="ingredient-emoji">${ing.emoji}</span>
            <span class="ingredient-name">${esc(ing.name)}</span>
            <span class="ingredient-method">手法 · ${esc(ing.method)}</span>
          </div>
          <p class="ingredient-desc">${esc(ing.desc)}</p>
          <p class="ingredient-taste">${esc(ing.taste)}</p>
        </div>`
      grid.appendChild(card)
    })
  }

  /* —— 调配流程 + 手法 —— */
  function renderBrew() {
    const flow = $('#brewFlow')
    LK.BREW_FLOW.forEach((s) => {
      const row = el('div', 'flow-step')
      row.innerHTML = `
        <div class="flow-num">${s.step}</div>
        <div class="flow-body">
          <h4>${esc(s.title)}<small>${esc(s.sub)}</small></h4>
          <p>${esc(s.desc)}</p>
        </div>`
      flow.appendChild(row)
    })
    const methods = $('#methodsGrid')
    LK.METHODS.forEach((m) => {
      const pill = el('div', 'method-pill')
      pill.innerHTML = `
        <span class="method-name">${esc(m.method)}</span>
        <span class="method-for">${esc(m.for)}</span>
        <span class="method-desc">${esc(m.desc)}</span>`
      methods.appendChild(pill)
    })
  }

  /* —— 酒柜 —— */
  function renderCabinet() {
    const grid = $('#cabinetGrid')
    LK.CABINET.forEach((d) => {
      const rarity = LK.RARITY[d.rarity] || LK.RARITY.common
      const layers = d.layers
        .map((c) => `<div class="glass-layer" style="background:${c}"></div>`)
        .join('')
      const recipe = d.recipe
        .map((cat) => {
          const ing = ingredientOf(cat)
          return `<span class="recipe-dot"><i style="background:${colorOf(cat)}"></i>${esc(ing.name)}</span>`
        })
        .join('')
      const card = el('div', 'card lift cabinet-card' + (d.unlocked ? '' : ' locked'))
      card.innerHTML = `
        ${d.unlocked ? '' : '<span class="lock-badge">🔒 未解锁</span>'}
        <div class="glass">
          <div class="glass-cup">
            <div class="glass-liquid">${layers}</div>
            <span class="glass-shine"></span>
          </div>
        </div>
        <div class="cabinet-name">${esc(d.name)}</div>
        <span class="rarity" style="background:${rarity.color}">${rarity.label}</span>
        <div class="cabinet-recipe">${recipe}</div>
        <p class="cabinet-flavor">${esc(d.flavor)}</p>
        <div class="cabinet-unlock"><b>解锁条件</b> · ${esc(d.unlock)}</div>`
      grid.appendChild(card)
    })
  }

  /* —— 秘方墙 —— */
  function renderWall() {
    const wall = $('#recipeWall')
    const kindLabel = { bartender: '种种调法', evomap: '进化档案', player: '玩家投稿' }
    LK.RECIPES.forEach((r) => {
      const tags = (r.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')
      const conf = r.confidence != null ? `<div class="wall-conf">采纳信心 ${Math.round(r.confidence * 100)}%</div>` : ''
      const card = el('div', 'card lift wall-card')
      card.innerHTML = `
        <div class="wall-top">
          <span class="wall-author">${esc(r.author)}</span>
          <span class="wall-kind ${r.kind}">${kindLabel[r.kind] || ''}</span>
        </div>
        <h4 class="wall-title">${esc(r.title)}</h4>
        <p class="wall-body">${esc(r.body)}</p>
        <div class="wall-tags">${tags}</div>
        ${conf}`
      wall.appendChild(card)
    })
  }

  /* —— 导航：滚动高亮当前区块 + 移动端折叠 —— */
  function wireNav() {
    const toggle = $('#navToggle')
    const links = $('#navLinks')
    if (toggle) toggle.addEventListener('click', () => links.classList.toggle('open'))
    links.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => links.classList.remove('open'))
    )

    const sections = ['home', 'sprites', 'ingredients', 'brew', 'cabinet', 'wall']
      .map((id) => document.getElementById(id))
      .filter(Boolean)
    const navMap = {}
    links.querySelectorAll('a').forEach((a) => {
      const id = a.getAttribute('href').slice(1)
      navMap[id] = a
    })
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            Object.values(navMap).forEach((a) => a.classList.remove('active'))
            const active = navMap[e.target.id]
            if (active) active.classList.add('active')
          }
        })
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    )
    sections.forEach((s) => obs.observe(s))
  }

  /* —— 启动 —— */
  function init() {
    if (!LK) return
    wireEnter()
    renderHeroBar()
    renderSprites()
    renderIngredients()
    renderBrew()
    renderCabinet()
    renderWall()
    wireNav()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
