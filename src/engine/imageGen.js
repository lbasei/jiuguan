const IMAGE_MODEL = import.meta.env.VITE_IMAGE_MODEL || 'gpt-image-1'
const IMAGE_ENDPOINT = '/openai/images/generations'

function hashText(text) {
  return Array.from(String(text || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function localCustomPet({ name, ingredient, personality }) {
  const seed = hashText(`${name}${ingredient}${personality}`)
  const palettes = [
    ['#9DD3FF', '#E6F5FF', '#5B8FA6'],
    ['#F8B1D4', '#FFE6F2', '#A85B82'],
    ['#FFD978', '#FFF0B8', '#A77A22'],
    ['#9BE8B6', '#E7F9EA', '#548F67'],
    ['#7EDFD8', '#DDF9F5', '#4D8B91'],
  ]
  const [body, light, line] = palettes[seed % palettes.length]
  const mood = /急|凶|催|辣|火|快/.test(personality || '') ? 'sharp' : /温柔|软|慢|安静|治愈/.test(personality || '') ? 'soft' : 'bright'
  const mouth = mood === 'sharp' ? 'M122 146L134 154L146 146' : mood === 'soft' ? 'M122 148Q134 156 146 148' : 'M124 146Q134 154 144 146'
  const motif = /星|糖|莓|甜/.test(ingredient || '') ? 'star' : /茶|叶|薄荷|香|草/.test(ingredient || '') ? 'leaf' : 'drop'
  const motifPath = motif === 'star'
    ? 'M134 18L144 44L172 47L150 64L157 91L134 76L111 91L118 64L96 47L124 44Z'
    : motif === 'leaf'
      ? 'M88 26C134 12 176 34 184 76C142 84 104 70 88 26ZM188 32C226 28 252 50 252 86C218 92 194 72 188 32Z'
      : 'M134 16C164 54 184 84 184 112C184 143 162 164 134 164C106 164 84 143 84 112C84 84 104 54 134 16Z'
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 268 268">
    <g fill="none" stroke="${line}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
      <path d="${motifPath}" fill="${light}"/>
      <path d="M52 138C30 146 18 166 22 190C46 194 66 184 76 164" fill="${body}"/>
      <path d="M216 138C238 146 250 166 246 190C222 194 202 184 192 164" fill="${body}"/>
      <path d="M64 116C74 72 108 52 134 52C160 52 194 72 204 116C224 198 188 232 134 232C80 232 44 198 64 116Z" fill="${body}"/>
      <path d="M78 206C76 226 92 242 112 236" fill="${body}"/>
      <path d="M190 206C192 226 176 242 156 236" fill="${body}"/>
      <path d="M92 118C104 102 124 104 130 122C116 134 100 132 92 118Z" fill="#FFFFFF"/>
      <path d="M176 118C164 102 144 104 138 122C152 134 168 132 176 118Z" fill="#FFFFFF"/>
      <path d="M104 118L112 126M164 118L156 126" stroke="${line}" stroke-width="5"/>
      <path d="${mouth}" stroke="${line}" stroke-width="5"/>
      <path d="M80 154C86 146 98 146 104 154" stroke="#F4A7B9" stroke-width="7"/>
      <path d="M164 154C170 146 182 146 188 154" stroke="#F4A7B9" stroke-width="7"/>
      <path d="M52 70L60 52L68 70L86 78L68 86L60 104L52 86L34 78Z" fill="#C7B8FF" stroke-width="4"/>
      <path d="M214 62L220 48L226 62L240 68L226 74L220 88L214 74L200 68Z" fill="#F8D97C" stroke-width="4"/>
    </g>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export async function generateCustomPetImage({ name, ingredient, personality, method }) {
  const prompt = [
    'Create a transparent-background pixel art desktop pet sprite for Life Kitchen.',
    'Style reference: cute chubby ingredient creature, pastel magic tavern, glossy eyes, tiny blush, small sparkles, clean silhouette.',
    'Do not add text, watermark, UI frame, white background, or rectangular card.',
    'Centered full-body mascot, 1:1 composition, transparent background.',
    `Character name: ${name || '自定义种种'}.`,
    `Ingredient / motif: ${ingredient || 'magical herb dessert drink ingredient'}.`,
    `Personality: ${personality || 'helpful bartender spirit'}.`,
    `Schedule management method: ${method || 'gentle but efficient daily planning'}.`,
  ].join(' ')

  const res = await fetch(IMAGE_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size: '1024x1024',
      quality: 'low',
      background: 'transparent',
      n: 1,
    }),
  }).catch(() => null)

  if (!res?.ok) return localCustomPet({ name, ingredient, personality })

  const data = await res.json()
  const image = data.data?.[0]
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`
  if (image?.url) return image.url
  return localCustomPet({ name, ingredient, personality })
}

export async function generateBartenderDrinkMoment({ bartender, drinkName, recipe = [], tone = 'balanced' }) {
  const recipeHint = recipe
    .slice(0, 4)
    .map((layer) => `${layer.name || layer.category} ${Math.round((layer.ratio || 0) * 100)}%`)
    .join(', ')
  const colorMood =
    tone === 'cool'
      ? 'cool mint blue and leafy green drink palette, only tiny warm highlights'
      : tone === 'warm'
        ? 'warm honey yellow, ginger orange, soft cream drink palette'
        : 'balanced aqua, pale yellow, and soft green drink palette'

  const prompt = [
    'Create a square magical tavern character reaction illustration for Life Kitchen.',
    'Subject: the selected cute ingredient spirit bartender is very happy, holding today\'s finished drink with both tiny hands.',
    'Style: polished cute pixel-art inspired mascot illustration, soft neon magic glow, pastel tavern, expressive happy face, glossy eyes, tiny blush, celebratory sparkles.',
    'Composition: mascot centered, drink clearly visible in front, no UI frame, no speech bubble, no text, no watermark.',
    'The mascot should resemble the ingredient and personality below, not a human.',
    `Bartender name: ${bartender?.name || '种种调酒师'}.`,
    `Ingredient motif: ${bartender?.plant || bartender?.name || 'magical ingredient spirit'}.`,
    `Personality / management style: ${bartender?.style || bartender?.reminderTone || 'helpful magical bartender'}.`,
    `Drink name: ${drinkName || 'today special drink'}.`,
    `Drink recipe hint: ${recipeHint || 'layered magical drink'}.`,
    `Color mood: ${colorMood}.`,
    'Keep the background simple, soft, and low saturation so the mascot and drink are the focus.',
  ].join(' ')

  const res = await fetch(IMAGE_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size: '1024x1024',
      quality: 'low',
      n: 1,
    }),
  })

  if (!res.ok) {
    const message = await res.text().catch(() => '')
    throw new Error(message || `合影生成失败：${res.status}`)
  }

  const data = await res.json()
  const image = data.data?.[0]
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`
  if (image?.url) return image.url
  throw new Error('生图接口没有返回图片')
}
