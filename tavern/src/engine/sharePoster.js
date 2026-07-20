import { getRecipeVolumeLayers } from './recipeVolume.js'

const COOL_CATEGORIES = new Set(['communication', 'review', 'recovery'])
const WARM_CATEGORIES = new Set(['deep_work', 'creative', 'urgent', 'admin'])

function drinkTone(layers) {
  const cool = layers.filter((layer) => COOL_CATEGORIES.has(layer.category)).length
  const warm = layers.filter((layer) => WARM_CATEGORIES.has(layer.category)).length
  if (cool >= Math.max(2, warm + 1)) return 'cool'
  if (warm >= Math.max(2, cool + 1)) return 'warm'
  return 'balanced'
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16))
}

function mix(hex, mixHex = '#ffffff', amount = 0.28) {
  const base = hexToRgb(hex)
  const other = hexToRgb(mixHex)
  return `#${base.map((value, index) => Math.round(value * (1 - amount) + other[index] * amount).toString(16).padStart(2, '0')).join('')}`
}

function harmonizeLayers(recipe) {
  const raw = getRecipeVolumeLayers(recipe || []).slice(0, 5)
  const tone = drinkTone(raw)
  const palette =
    tone === 'cool'
      ? { rim: '#8BCFD2', accent: '#9BE8B6', second: '#9DD3FF', paper: '#F7FEFC', panel: '#E8F7F8' }
      : tone === 'warm'
        ? { rim: '#EFCB72', accent: '#FFD978', second: '#F8B1D4', paper: '#FFFBEF', panel: '#FFF4D8' }
        : { rim: '#A8CFE0', accent: '#FFD978', second: '#9BE8B6', paper: '#F8FCFA', panel: '#EDF8F4' }
  const layers = raw.map((layer) => ({
    ...layer,
    visualColor: tone === 'cool' && WARM_CATEGORIES.has(layer.category) ? mix(layer.color, '#9DD3FF', 0.34) : layer.color,
  }))
  return { tone, palette, layers }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawStar(ctx, x, y, size, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 ? size * 0.42 : size
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 10
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const chars = String(text || '').split('')
  const lines = []
  let line = ''
  chars.forEach((char) => {
    const test = line + char
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = char
    } else {
      line = test
    }
  })
  if (line) lines.push(line)
  lines.slice(0, maxLines).forEach((row, index) => ctx.fillText(row, x, y + index * lineHeight))
}

function honorific(profile = {}) {
  if (profile.gender === 'male') return '先生'
  if (profile.gender === 'female') return '小姐'
  return '旅人'
}

function guestLine(card) {
  const profile = card.userProfile || {}
  const place = profile.locationLabel || '远方'
  const name = profile.name || profile.displayName || '无名'
  return `来自${place}的${name}${honorific(profile)}`
}

function drawPosterDrink(ctx, layers, palette) {
  const cx = 450
  const top = 420
  const glassW = 238
  const glassH = 250
  const left = cx - glassW / 2
  const right = cx + glassW / 2
  const bottom = top + glassH

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.lineWidth = 6
  ctx.lineJoin = 'miter'
  ctx.strokeStyle = palette.rim
  ctx.fillStyle = 'rgba(255,255,255,.78)'
  ctx.beginPath()
  ctx.moveTo(left, top)
  ctx.lineTo(right, top)
  ctx.lineTo(right - 18, bottom - 30)
  ctx.lineTo(right - 42, bottom)
  ctx.lineTo(left + 42, bottom)
  ctx.lineTo(left + 18, bottom - 30)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,.38)'
  ctx.fillRect(left + 28, top + 28, 18, glassH - 76)
  ctx.fillRect(right - 48, top + 24, 10, 56)

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(left + 22, top + 28)
  ctx.lineTo(right - 22, top + 28)
  ctx.lineTo(right - 56, bottom - 26)
  ctx.lineTo(left + 56, bottom - 26)
  ctx.closePath()
  ctx.clip()

  let y = bottom - 26
  const liquidTotal = glassH - 68
  layers.forEach((layer) => {
    const h = Math.round(Math.max(18, liquidTotal * (layer.heightPercent / 100)) / 6) * 6
    ctx.fillStyle = layer.visualColor
    ctx.fillRect(left + 26, y - h, glassW - 52, h)
    ctx.fillStyle = 'rgba(255,255,255,.26)'
    ctx.fillRect(left + 26, y - h, glassW - 52, 8)
    ctx.fillStyle = 'rgba(255,255,255,.18)'
    ctx.fillRect(left + 58, y - h + 20, 24, 14)
    ctx.fillRect(right - 86, y - h + 34, 18, 12)
    y -= h
  })
  ctx.restore()

  ctx.fillStyle = 'rgba(255,255,255,.84)'
  ctx.strokeStyle = palette.rim
  ctx.lineWidth = 6
  ctx.fillRect(cx - 10, bottom - 2, 20, 106)
  ctx.strokeRect(cx - 10, bottom - 2, 20, 106)
  ctx.fillRect(cx - 82, bottom + 100, 164, 22)
  ctx.strokeRect(cx - 82, bottom + 100, 164, 22)

  ctx.fillStyle = palette.accent
  ctx.strokeStyle = palette.rim
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(cx + 116, top + 18)
  ctx.lineTo(cx + 166, top + 34)
  ctx.lineTo(cx + 122, top + 70)
  ctx.lineTo(cx + 138, top + 40)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = mix(palette.accent, '#ffffff', 0.42)
  ctx.fillRect(cx + 132, top + 34, 28, 8)
  ctx.fillRect(cx + 124, top + 50, 22, 7)

  ctx.restore()
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95))
}

export async function shareDrinkPoster(card) {
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 1200
  const ctx = canvas.getContext('2d')
  const { palette, layers } = harmonizeLayers(card.recipe || [])
  const score = card.report?.score || { total: 0, stars: 0 }

  ctx.fillStyle = palette.paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = 'rgba(62,55,45,.12)'
  ctx.lineWidth = 1
  for (let y = 0; y < canvas.height; y += 8) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }

  ctx.strokeStyle = palette.rim
  ctx.lineWidth = 6
  roundRect(ctx, 44, 44, 812, 1112, 28)
  ctx.stroke()
  ctx.lineWidth = 2
  roundRect(ctx, 72, 72, 756, 1056, 16)
  ctx.stroke()

  ctx.fillStyle = palette.panel
  roundRect(ctx, 120, 220, 660, 650, 36)
  ctx.fill()
  ctx.strokeStyle = mix(palette.rim, '#ffffff', 0.2)
  ctx.lineWidth = 3
  roundRect(ctx, 120, 220, 660, 650, 36)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(86,132,148,.12)'
  ctx.lineWidth = 2
  for (let x = 148; x < 760; x += 16) {
    ctx.beginPath()
    ctx.moveTo(x, 238)
    ctx.lineTo(x, 852)
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#567FA1'
  ctx.font = '700 52px Georgia, "Songti SC", serif'
  wrapText(ctx, card.drinkName || '今日出品', 450, 112, 620, 56, 2)
  ctx.font = '700 24px Georgia, "Songti SC", serif'
  ctx.fillStyle = '#24445C'
  ctx.fillText('Life Kitchen', 450, 206)

  ctx.save()
  ctx.translate(238, 252)
  ctx.rotate(-0.05)
  ctx.fillStyle = mix(palette.accent, '#8A6D3B', 0.18)
  roundRect(ctx, 0, 0, 260, 64, 20)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '700 31px Georgia, "Songti SC", serif'
  ctx.textAlign = 'center'
  ctx.fillText('酒馆出品', 130, 42)
  ctx.restore()

  ctx.font = 'italic 23px Georgia, "Songti SC", serif'
  ctx.fillStyle = 'rgba(36,68,92,.68)'
  ctx.fillText(`To: ${guestLine(card)}`, 450, 238)
  ctx.fillText(`From: ${card.bartender || '种种'}`, 450, 238)

  drawPosterDrink(ctx, layers, palette)

  drawStar(ctx, 180, 360, 18, '#FFF3C4')
  drawStar(ctx, 720, 390, 22, '#FFF3C4')
  drawStar(ctx, 220, 790, 16, '#FFF3C4')
  drawStar(ctx, 690, 755, 13, '#FFF3C4')

  ctx.font = '44px Georgia, "Songti SC", serif'
  ctx.fillStyle = '#E5B020'
  ctx.fillText('★'.repeat(Math.max(0, score.stars || 0)) || '☆', 450, 932)
  ctx.fillStyle = '#24445C'
  ctx.font = '700 31px Georgia, "Songti SC", serif'
  wrapText(ctx, card.report?.managementRelation?.title || '今晚的节奏，已经被调成一杯可收藏的配方。', 450, 990, 650, 46, 2)

  ctx.fillStyle = 'rgba(138,109,59,.18)'
  roundRect(ctx, 120, 1048, 660, 76, 18)
  ctx.fill()
  ctx.fillStyle = '#536B78'
  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif'
  wrapText(ctx, card.suggestion || '明天可以继续微调这杯酒的比例。', 450, 1095, 570, 30, 1)

  ctx.fillStyle = 'rgba(36,68,92,.62)'
  ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('由 Life Kitchen 生成 · 今日管理饮品', 450, 1148)

  const blob = await canvasToBlob(canvas)
  const filename = `life-kitchen-${Date.now()}.png`
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: card.drinkName || 'Life Kitchen 今日特调',
      text: '我的今日管理饮品出杯了。',
    })
    return { mode: 'shared' }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return { mode: 'downloaded' }
}
