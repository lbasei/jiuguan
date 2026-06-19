// 桌宠精灵（与网页端同款小精灵网格，独立一份避免跨工程耦合）。
window.CREATURE = {
  w: 12,
  h: 12,
  rows: [
    '.....ll.....',
    '....lll.....',
    '...oooooo...',
    '..obbbbbbo..',
    '.obbbbbbbbo.',
    'obbwbbbbwbbo',
    'obwkbbbbkwbo',
    'obbbbbbbbbbo',
    'obbbmmmmbbbo',
    '.obbbbbbbbo.',
    '..oobbbboo..',
    '....oooo....',
  ],
  palette: { o: '#3E2A18', b: '#D98A3D', w: '#FBF6EA', k: '#2A1C10', m: '#8C3B2B', l: '#6F8A5B' },
}

window.BODY = {
  rosemary: '#6F8A5B',
  ginger: '#D98A3D',
  mint: '#7FBFA6',
  garlic: '#E0CFA0',
  cilantro: '#9CC15B',
}

window.NAME = {
  rosemary: '迷迭香种种',
  ginger: '姜味种种',
  mint: '薄荷种种',
  garlic: '蒜香种种',
  cilantro: '香菜种种',
}

// 美术资源映射：有真实图片的小精灵优先用图片，没有则回退到像素网格
window.IMAGE = {
  mint: '../../assets/sprites/mint.png',
}

// 调制手法文案（不点名原料，与网页端一致）
window.ACTION = {
  deep_work: '慢熬中',
  creative: '发酵中',
  communication: '打气中',
  admin: '速调中',
  recovery: '打发中',
  urgent: '浓缩中',
  review: '收口中',
}

// 把网格渲染成 SVG 字符串
window.renderSprite = function (sprite, scale, colors) {
  const palette = Object.assign({}, sprite.palette, colors || {})
  let rects = ''
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      const fill = palette[ch]
      if (!fill || ch === '.') continue
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`
    }
  })
  return `<svg width="${sprite.w * scale}" height="${sprite.h * scale}" viewBox="0 0 ${sprite.w} ${sprite.h}" shape-rendering="crispEdges" style="image-rendering:pixelated">${rects}</svg>`
}
