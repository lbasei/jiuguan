const BASE = import.meta.env.VITE_TRANSCRIBE_BASE_URL || '/openai'
const ENDPOINT = `${BASE}/audio/transcriptions`
const MODEL = import.meta.env.VITE_TRANSCRIBE_MODEL || 'gpt-4o-transcribe'

async function readErrorMessage(res) {
  const raw = await res.text().catch(() => '')
  if (!raw) return ''
  try {
    const data = JSON.parse(raw)
    return data.error?.message || data.message || raw
  } catch {
    return raw
  }
}

export async function transcribeAudio(blob) {
  if (!blob || blob.size === 0) throw new Error('没有录到声音')

  const form = new FormData()
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('file', blob, `life-kitchen-voice.${ext}`)
  form.append('model', MODEL)
  form.append('prompt', '这是一段中文日程倾诉，请忠实转写用户说的话。')

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const message = await readErrorMessage(res)
    if (res.status === 401) throw new Error('语音 API key 没配好，或者 Vite 服务启动时没有读到 key。')
    if (res.status === 404) throw new Error('语音转写接口没有接上，请检查 /openai 代理或模型名。')
    if (res.status === 413) throw new Error('这段录音太长了，先短一点说。')
    throw new Error(message || `语音转写失败 ${res.status}`)
  }

  const data = await res.json()
  const text = data.text || data.transcript || ''
  if (!text.trim()) throw new Error('没有听清楚，可以再说一次')
  return text.trim()
}
