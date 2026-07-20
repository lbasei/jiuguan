import tapUrl from '../../assets/audio/sfx-tap.wav'
import confirmUrl from '../../assets/audio/sfx-confirm.wav'
import enterUrl from '../../assets/audio/sfx-enter.wav'
import bellUrl from '../../assets/audio/sfx-bell.wav'
import successUrl from '../../assets/audio/sfx-success.wav'

const SFX_ATTR = 'data-tavern-sfx'

/** @type {Record<string, { url: string, volume: number }>} */
const SFX = {
  tap: { url: tapUrl, volume: 0.42 },
  confirm: { url: confirmUrl, volume: 0.52 },
  enter: { url: enterUrl, volume: 0.58 },
  bell: { url: bellUrl, volume: 0.6 },
  success: { url: successUrl, volume: 0.55 },
}

/** @type {Record<string, HTMLAudioElement[]>} */
const pool = {}

function borrowAudio(id) {
  const cfg = SFX[id]
  if (!cfg) return null
  const list = pool[id] || (pool[id] = [])
  const free = list.find((audio) => audio.paused || audio.ended)
  if (free) return free

  const audio = new window.Audio(cfg.url)
  audio.preload = 'auto'
  audio.volume = cfg.volume
  audio.setAttribute(SFX_ATTR, id)
  audio.setAttribute('aria-hidden', 'true')
  audio.hidden = true
  list.push(audio)
  return audio
}

/**
 * @param {'tap'|'confirm'|'enter'|'bell'|'success'} id
 */
export function playUiSound(id) {
  if (typeof window === 'undefined' || !SFX[id]) return false
  const cfg = SFX[id]
  const audio = borrowAudio(id)
  if (!audio) return false

  try {
    audio.pause()
    audio.currentTime = 0
    audio.volume = cfg.volume
    void audio.play()
    return true
  } catch {
    return false
  }
}

/**
 * Map a clicked control to one of the five tavern SFX ids.
 * @param {Element | null | undefined} target
 * @returns {'tap'|'confirm'|'enter'|'bell'|'success'|null}
 */
export function resolveButtonSfx(target) {
  if (!target || typeof target.closest !== 'function') return null

  const btn = target.closest('button, a[href], [role="button"]')
  if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return null
  if (btn.dataset.sfx === 'off') return null

  const className = String(btn.className || '')
  const aria = btn.getAttribute('aria-label') || ''
  const text = String(btn.textContent || '').replace(/\s+/g, ' ').trim()

  if (className.includes('service-bell') || className.includes('service-bell-action')) {
    return 'bell'
  }

  if (
    className.includes('task-complete-check')
    || /做完了|确认出杯|开新的一天/.test(text)
    || (className.includes('result-final-btn') && className.includes('is-ready'))
  ) {
    return 'success'
  }

  if (
    (className.includes('start-spell') && className.includes('primary'))
    || aria.includes('进入酒馆')
  ) {
    return 'enter'
  }

  if (className.includes('btn-primary')) {
    return 'confirm'
  }

  if (
    className.includes('btn-ghost')
    || className.includes('top-icon-btn')
    || className.includes('setting-card')
    || className.includes('start-spell')
    || className.includes('guest-edge-pull')
    || className.includes('guest-name-button')
    || className.includes('language-choice-list')
    || btn.closest('.tavern-bottom-nav')
    || btn.closest('.intro-actions')
    || btn.closest('.btn-row')
    || btn.closest('.adventure-actions')
  ) {
    return 'tap'
  }

  if (btn.tagName === 'BUTTON') return 'tap'
  return null
}
