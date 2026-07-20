import bgmUrl from '../../assets/audio/zongzong-bgm.wav'

const DEFAULT_VOLUME = 0.32
const BGM_ATTR = 'data-tavern-bgm'

/** @type {HTMLAudioElement | null} */
let sharedAudio = null

function getAudio() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  if (!sharedAudio) {
    sharedAudio = new window.Audio(bgmUrl)
    sharedAudio.loop = true
    sharedAudio.preload = 'auto'
    sharedAudio.volume = DEFAULT_VOLUME
    sharedAudio.setAttribute(BGM_ATTR, '1')
    sharedAudio.setAttribute('aria-hidden', 'true')
    sharedAudio.hidden = true
    document.body.appendChild(sharedAudio)
  }
  return sharedAudio
}

export function stopBgm() {
  const audio = sharedAudio
  if (!audio) return
  try {
    audio.pause()
    audio.currentTime = 0
  } catch {}
}

export async function startBgm() {
  const audio = getAudio()
  if (!audio) return false
  audio.loop = true
  audio.volume = DEFAULT_VOLUME
  try {
    await audio.play()
    return true
  } catch {
    stopBgm()
    return false
  }
}
