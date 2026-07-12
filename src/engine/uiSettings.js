const APP_SETTINGS_KEY = 'life-kitchen-ui-settings'

const REMINDER_TEXT = {
  'zh-CN': {
    title: '种种端上了一张完成小票',
    body: (name) => `${name || '这一项'} 已经收口，可以换下一杯了。`,
  },
  'zh-TW': {
    title: '種種端上了一張完成小票',
    body: (name) => `${name || '這一項'} 已經收口，可以換下一杯了。`,
  },
  en: {
    title: 'A Zhongzhong note is ready',
    body: (name) => `${name || 'This task'} is done. Time for the next pour.`,
  },
  ja: {
    title: '種種から完了メモ',
    body: (name) => `${name || 'この一品'} は完了。次の一杯へ。`,
  },
  ko: {
    title: '종종의 완료 쪽지',
    body: (name) => `${name || '이 항목'} 완료. 다음 잔으로 넘어가요.`,
  },
}

export function loadUiSettings() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(APP_SETTINGS_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function saveUiSettings(settings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify({ ...loadUiSettings(), ...settings }))
}

export function notifyTaskDone(taskName) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  const settings = loadUiSettings()
  if (!settings.remindersOn || window.Notification.permission !== 'granted') return false
  const text = REMINDER_TEXT[settings.language] || REMINDER_TEXT['zh-CN']
  try {
    new window.Notification(text.title, { body: text.body(taskName) })
    return true
  } catch {
    return false
  }
}
