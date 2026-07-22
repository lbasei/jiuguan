import { useStore } from './store/store.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { pushPetState, startActionPoll, stopActionPoll, onPetAction } from './engine/petBridge.js'
import { recordEvent } from './engine/cellarApi.js'
import LoginPage from './pages/LoginPage.jsx'
import IntroPage from './pages/IntroPage.jsx'
import AdventurePage from './pages/AdventurePage.jsx'
import PartnerWallPage from './pages/PartnerWallPage.jsx'
import GuidePage from './pages/GuidePage.jsx'
import GuestProfilePage from './pages/GuestProfilePage.jsx'
import BartenderPage from './pages/BartenderPage.jsx'
import TodoPage from './pages/TodoPage.jsx'
import OptimizePage from './pages/OptimizePage.jsx'
import ExecutePage from './pages/ExecutePage.jsx'
import RevealPage from './pages/RevealPage.jsx'
import OpsPage from './pages/OpsPage.jsx'
import { getRecipeVolumeLayers } from './engine/recipeVolume.js'
import { loadUiSettings, saveUiSettings } from './engine/uiSettings.js'
import { startBgm, stopBgm } from './engine/bgm.js'
import { playUiSound, resolveButtonSfx } from './engine/sfx.js'

function minutesFromRecord(item = {}) {
  const records = Array.isArray(item.records) ? item.records : []
  return records.reduce((sum, record) => sum + (record.actualTime || record.estimatedTime || 0), 0)
}

function compactTime(min = 0) {
  if (!min) return ''
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}h${m}m` : `${h}h`
  }
  return `${min}m`
}

function mainColorFromCard(item = {}) {
  const layers = getRecipeVolumeLayers(item.recipe || [])
  return layers[0]?.color || '#8FE4DF'
}
const PAGES = {
  bartender: BartenderPage,
  todos: TodoPage,
  optimize: OptimizePage,
  execute: ExecutePage,
  reveal: RevealPage,
}

const UI_TEXT = {
  'zh-CN': {
    cellar: '冰柜',
    guideAria: '打开酒馆指引',
    settingsAria: '打开设置',
    cellarAria: '打开冰柜',
    back: '返回',
    guideTitle: '吧台小引',
    guideCopy: '把今天发生的事放到吧台上。种种会先收成一张小酒单，再陪你按节奏完成。',
    guideTalk: '说今天',
    guideRecipe: '排配方',
    guideFocus: '开始计时',
    guideFinish: '调配完成',
    guideFaqTitle: '吧台答疑',
    guideFaq: [
      ['加冰 / 去冰', '想休息多一点，就加冰；今天想一路推进，就少冰。种种只会在合适的时候轻轻提醒你。'],
      ['糖度', '糖度是给自己的小奖励。甜一点，代表今天可以留一点玩乐、放空或开心时间。'],
      ['怎么开始', '先把今天说给吧台听，确认配方后开计时。做完就打勾，顺序可以按真实节奏走。'],
    ],
    settingsTitle: '吧台偏好',
    whiteNoise: '背景音乐',
    whiteNoiseHint: '酒馆氛围',
    on: '开',
    off: '关',
    language: '语言',
    switch: '切换',
    current: '当前',
    choose: '选择',
    reminder: '提醒',
    reminderHint: '桌面与计时',
    reminderOn: '开',
    reminderDenied: '未授权',
    reminderUnsupported: '不支持',
    reminderEnable: '开启',
    navToday: '今日',
    navMix: '调配',
    navDo: '执行',
    navCellar: '冰柜',
    notifyTitle: '种种提醒已开启',
    notifyBody: '番茄钟结束时，会用这张小票提醒你。',
  },
  'zh-TW': {
    cellar: '冰櫃',
    guideAria: '打開酒館指引',
    settingsAria: '打開設定',
    cellarAria: '打開冰櫃',
    back: '返回',
    guideTitle: '吧台小引',
    guideCopy: '把今天發生的事放到吧台上。種種會先收成一張小酒單，再陪你按節奏完成。',
    guideTalk: '說今天',
    guideRecipe: '排配方',
    guideFocus: '開始計時',
    guideFinish: '調配完成',
    guideFaqTitle: '吧台答疑',
    guideFaq: [
      ['加冰 / 去冰', '冰不是任務。它代表休息提醒：加冰多一點，種種會多提醒你離開螢幕、喝水或走一圈。'],
      ['糖度', '糖度是娛樂和獎勵時間。甜一點，代表今天可以留一點輕鬆小獎勵。'],
      ['怎麼開始', '先說今天，確認配方後再開始計時。完成事項時打勾，不用反覆重排。'],
    ],
    settingsTitle: '吧台偏好',
    whiteNoise: '背景音樂',
    whiteNoiseHint: '酒館氛圍',
    on: '開',
    off: '關',
    language: '語言',
    switch: '切換',
    current: '目前',
    choose: '選擇',
    reminder: '提醒',
    reminderHint: '桌面與計時',
    reminderOn: '開',
    reminderDenied: '未授權',
    reminderUnsupported: '不支援',
    reminderEnable: '開啟',
    navToday: '今日',
    navMix: '調配',
    navDo: '執行',
    navCellar: '冰櫃',
    notifyTitle: '種種提醒已開啟',
    notifyBody: '番茄鐘結束時，會用這張小票提醒你。',
  },
  en: {
    cellar: 'Cellar',
    guideAria: 'Open tavern guide',
    settingsAria: 'Open preferences',
    cellarAria: 'Open cellar',
    back: 'Back',
    guideTitle: 'At the Counter',
    guideCopy: 'Put today on the counter. Zhongzhong turns it into a small menu, then helps you follow the rhythm.',
    guideTalk: 'Tell Today',
    guideRecipe: 'Arrange',
    guideFocus: 'Start Timer',
    guideFinish: 'Finish Mix',
    guideFaqTitle: 'Counter Notes',
    guideFaq: [
      ['Ice', 'Ice means break reminders, not tasks. More ice means more nudges to drink water, look away, or take a small walk.'],
      ['Sweetness', 'Sweetness means reward time. A sweeter recipe leaves a little room for play.'],
      ['How to start', 'Tell today first, confirm the recipe, then start the timer. Check items off when they are done.'],
    ],
    settingsTitle: 'Bar Preferences',
    whiteNoise: 'Background Music',
    whiteNoiseHint: 'Tavern ambience',
    on: 'On',
    off: 'Off',
    language: 'Language',
    switch: 'Switch',
    current: 'Current',
    choose: 'Choose',
    reminder: 'Reminder',
    reminderHint: 'Desktop & timer',
    reminderOn: 'On',
    reminderDenied: 'Denied',
    reminderUnsupported: 'Unavailable',
    reminderEnable: 'Enable',
    navToday: 'Today',
    navMix: 'Mix',
    navDo: 'Do',
    navCellar: 'Cellar',
    notifyTitle: 'Zhongzhong reminders are on',
    notifyBody: 'When a focus timer ends, a small note will appear.',
  },
  ja: {
    cellar: '冷蔵棚',
    guideAria: '酒場ガイドを開く',
    settingsAria: '設定を開く',
    cellarAria: '冷蔵棚を開く',
    back: '戻る',
    guideTitle: 'カウンター案内',
    guideCopy: '今日のことをカウンターに置いてください。種種が小さなメニューにして、順番に進めます。',
    guideTalk: '今日を話す',
    guideRecipe: '並べる',
    guideFocus: '計時開始',
    guideFinish: '仕上げ',
    guideFaqTitle: 'カウンターメモ',
    guideFaq: [
      ['氷', '氷はタスクではなく休憩の合図です。多めにすると、水を飲む・目を休める通知が増えます。'],
      ['甘さ', '甘さはごほうび時間です。少し甘くすると、軽い遊び時間を残します。'],
      ['始め方', 'まず今日を話し、配方を確認してから計時します。終わったものだけチェックしてください。'],
    ],
    settingsTitle: 'バーの好み',
    whiteNoise: 'BGM',
    whiteNoiseHint: '酒場の雰囲気',
    on: '入',
    off: '切',
    language: '言語',
    switch: '切替',
    current: '現在',
    choose: '選択',
    reminder: '通知',
    reminderHint: 'デスクトップと計時',
    reminderOn: '入',
    reminderDenied: '未許可',
    reminderUnsupported: '非対応',
    reminderEnable: '有効',
    navToday: '今日',
    navMix: '調合',
    navDo: '実行',
    navCellar: '冷蔵棚',
    notifyTitle: '種種の通知を有効にしました',
    notifyBody: '集中タイマー終了時に小さなメモで知らせます。',
  },
  ko: {
    cellar: '냉장고',
    guideAria: '바 안내 열기',
    settingsAria: '설정 열기',
    cellarAria: '냉장고 열기',
    back: '뒤로',
    guideTitle: '바 안내',
    guideCopy: '오늘 있었던 일을 바 위에 올려두세요. 종종이 작은 메뉴로 정리하고 차례대로 같이 진행해요.',
    guideTalk: '오늘 말하기',
    guideRecipe: '정리하기',
    guideFocus: '타이머 시작',
    guideFinish: '완성하기',
    guideFaqTitle: '바 메모',
    guideFaq: [
      ['얼음', '얼음은 할 일이 아니라 휴식 알림이에요. 많을수록 물 마시기, 멀리 보기, 걷기 알림이 늘어요.'],
      ['당도', '당도는 보상 시간이에요. 더 달게 하면 오늘의 작은 즐거움을 남겨둬요.'],
      ['시작하기', '오늘을 먼저 말하고, 배합을 확인한 뒤 타이머를 시작해요. 끝난 항목만 체크하면 됩니다.'],
    ],
    settingsTitle: '바 취향',
    whiteNoise: '배경음악',
    whiteNoiseHint: '주점 분위기',
    on: '켬',
    off: '끔',
    language: '언어',
    switch: '전환',
    current: '현재',
    choose: '선택',
    reminder: '알림',
    reminderHint: '데스크톱과 타이머',
    reminderOn: '켬',
    reminderDenied: '거부됨',
    reminderUnsupported: '미지원',
    reminderEnable: '켜기',
    navToday: '오늘',
    navMix: '배합',
    navDo: '실행',
    navCellar: '냉장고',
    notifyTitle: '종종 알림이 켜졌어요',
    notifyBody: '집중 타이머가 끝나면 작은 쪽지로 알려드려요.',
  },
}

export default function App() {
  const { state, dispatch } = useStore()
  const isOpsPage = window.location.pathname === '/ops'
  const savedUiSettings = useMemo(loadUiSettings, [])
  const [introStage, setIntroStage] = useState('intro')
  const [pendingStartMode, setPendingStartMode] = useState('full')
  const [profileOpen, setProfileOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideDetailsOpen, setGuideDetailsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [whiteNoiseOn, setWhiteNoiseOn] = useState(Boolean(savedUiSettings.whiteNoiseOn))
  const [language, setLanguage] = useState(savedUiSettings.language || 'zh-CN')
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [remindersOn, setRemindersOn] = useState(Boolean(savedUiSettings.remindersOn))
  const [reminderPermission, setReminderPermission] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return window.Notification.permission
  })
  const [editingName, setEditingName] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const bartenderReadyAt = useRef(0)
  const swipeStartRef = useRef(null)
  const Page = PAGES[state.step] || BartenderPage
  const showShell = introStage === 'app'
  const selectedCustomBartender = state.customBartenders?.find((b) => b.id === state.lockedBartenderId)
  const profile = state.userProfile || state.authUser || {}
  const hasGuestCard = Boolean(profile?.name && profile?.locationLabel)
  const completedToday = Object.values(state.records || {}).filter((record) => record?.status === 'completed').length
  const visitDays = Math.max(1, new Set([state.today, ...(state.cellar || []).map((item) => item.date).filter(Boolean)]).size)
  const unlockedDrinks = Math.max(state.cellar?.length || 0, state.recipe?.length || 0)
  const guestExp = visitDays * 20 + completedToday * 30 + unlockedDrinks * 45 + (state.customBartenders?.length || 0) * 55
  const tastingLevel = Math.max(1, Math.floor(guestExp / 120) + 1)
  const expProgress = Math.min(100, Math.round((guestExp % 120) / 120 * 100))
  const languageOptions = [
    { id: 'zh-CN', label: '简体中文' },
    { id: 'zh-TW', label: '繁體中文' },
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' },
    { id: 'ko', label: '한국어' },
  ]
  const currentLanguage = languageOptions.find((item) => item.id === language)?.label || '简体中文'
  const text = UI_TEXT[language] || UI_TEXT['zh-CN']
  const reminderStatusLabel = reminderPermission === 'unsupported'
    ? text.reminderUnsupported
    : reminderPermission === 'denied'
      ? text.reminderDenied
      : remindersOn
        ? text.reminderOn
        : text.reminderEnable
  const cellarByDate = useMemo(() => {
    const map = new Map()
    ;(state.cellar || []).forEach((item) => {
      if (!item.date || map.has(item.date)) return
      map.set(item.date, {
        color: mainColorFromCard(item),
        time: compactTime(minutesFromRecord(item)),
        name: item.drinkName || item.name || '今日出品',
      })
    })
    return map
  }, [state.cellar])
  const heatmapDays = useMemo(() => {
    const today = new Date(`${state.today || new Date().toISOString().slice(0, 10)}T00:00:00`)
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    const total = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    return Array.from({ length: total }, (_, index) => {
      const date = new Date(first)
      date.setDate(index + 1)
      const iso = date.toISOString().slice(0, 10)
      const drink = cellarByDate.get(iso)
      const isToday = iso === state.today
      return { iso, day: date.getDate(), drink, isToday }
    })
  }, [cellarByDate, state.today])
  const guestBadges = useMemo(() => {
    const cellarCount = state.cellar?.length || 0
    const todoCount = state.todos.length
    return [
      { id: 'first-seat', label: '入座', hint: '留下顾客卡', unlocked: Boolean(profile.name), icon: 'seat' },
      { id: 'regular', label: '熟客', hint: '来访 3 天', unlocked: visitDays >= 3, icon: 'stamp' },
      { id: 'cellar', label: '藏酒', hint: '存 3 杯', unlocked: cellarCount >= 3, icon: 'bottle' },
      { id: 'closer', label: '收口', hint: '完成 5 件', unlocked: completedToday >= 5 || todoCount >= 5, icon: 'star' },
      { id: 'taster', label: '品酒师', hint: '达到 Lv.3', unlocked: tastingLevel >= 3, icon: 'medal' },
    ]
  }, [completedToday, profile.name, state.cellar?.length, state.todos.length, tastingLevel, visitDays])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dataset.locale = language
    saveUiSettings({ language, whiteNoiseOn, remindersOn })
  }, [language, remindersOn, whiteNoiseOn])

  useEffect(() => {
    if (reminderPermission === 'denied' || reminderPermission === 'unsupported') {
      setRemindersOn(false)
    }
  }, [reminderPermission])

  useEffect(() => {
    const handler = (event) => {
      const target = event.target?.closest?.('button,a,[role="button"]')
      if (!target) return
      const sfxId = resolveButtonSfx(target)
      if (sfxId) playUiSound(sfxId)
      const label = target.getAttribute('aria-label') || target.textContent || target.className || 'tap'
      recordEvent({
        type: 'click',
        label: String(label).replace(/\s+/g, ' ').trim().slice(0, 80),
        page: isOpsPage ? 'ops' : state.step || introStage,
        userId: state.authUser?.id || state.userProfile?.id || '',
      }).catch(() => {})
    }
    window.addEventListener('click', handler, { capture: true })
    return () => window.removeEventListener('click', handler, { capture: true })
  }, [introStage, isOpsPage, state.authUser?.id, state.step, state.userProfile?.id])

  if (isOpsPage) return <OpsPage />

  const openGuestProfile = () => {
    dispatch({ type: 'SET_WORKFLOW_MODE', mode: 'full' })
    setIntroStage('guest')
  }

  const openProfileDrawer = () => {
    setRenameDraft(profile.name || '')
    setEditingName(false)
    setProfileOpen(true)
  }

  const saveGuestName = () => {
    const name = renameDraft.trim()
    if (!name) return
    dispatch({ type: 'SET_USER_PROFILE', profile: { ...profile, name, displayName: name } })
    setEditingName(false)
  }

  const openCellar = () => {
    setGuideOpen(false)
    setSettingsOpen(false)
    dispatch({ type: 'GO', step: 'reveal' })
  }

  const toggleWhiteNoise = () => {
    setWhiteNoiseOn((on) => {
      if (on) {
        stopBgm()
        return false
      }
      startBgm().then((started) => {
        if (!started) setWhiteNoiseOn(false)
      })
      return true
    })
  }

  const toggleReminders = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setReminderPermission('unsupported')
      setRemindersOn(false)
      return
    }

    if (remindersOn) {
      setRemindersOn(false)
      return
    }

    const permission = window.Notification.permission === 'default'
      ? await window.Notification.requestPermission()
      : window.Notification.permission
    setReminderPermission(permission)
    if (permission !== 'granted') {
      setRemindersOn(false)
      return
    }

    setRemindersOn(true)
    try {
      new window.Notification(text.notifyTitle, { body: text.notifyBody })
    } catch {}
  }

  const startIntro = (mode = 'full', authenticated = false) => {
    if (!authenticated && (!state.authToken || !state.authUser)) {
      setPendingStartMode(mode)
      setIntroStage('login')
      return
    }
    if (introStage !== 'guest' && !hasGuestCard) {
      setPendingStartMode(mode)
      setIntroStage('guest')
      return
    }
    dispatch({ type: 'SET_WORKFLOW_MODE', mode })
    if (mode === 'quick') {
      const id = state.lockedBartenderId || state.bartenderId || 'lemon'
      if (!state.lockedBartenderId) dispatch({ type: 'SET_BARTENDER', id })
      dispatch({ type: 'SET_ASSISTANT_MODE', mode: 'daily' })
      dispatch({ type: 'GO', step: 'todos' })
    } else {
      dispatch({ type: 'GO', step: 'bartender' })
    }
    setIntroStage('app')
  }

  useEffect(() => {
    if (introStage === 'app' && state.step === 'bartender') {
      bartenderReadyAt.current = Date.now()
    }
  }, [introStage, state.step])

  useEffect(() => {
    if (introStage !== 'app') return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [introStage, state.step])

  useEffect(() => () => stopBgm(), [])

  useEffect(() => {
    if (!showShell) return undefined
    const onPointerDown = (event) => {
      if (event.clientX > 28) return
      swipeStartRef.current = { x: event.clientX, y: event.clientY }
    }
    const onPointerUp = (event) => {
      const start = swipeStartRef.current
      swipeStartRef.current = null
      if (!start) return
      const dx = event.clientX - start.x
      const dy = Math.abs(event.clientY - start.y)
      if (dx > 54 && dy < 90) openProfileDrawer()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [showShell, profile.name])

  // 一旦选定小精灵，在静态页面也保持桌宠形象同步，避免它回到默认色。
  // 酒单页会自己推送调配/倒计时状态，所以这里不抢它的同步。
  useEffect(() => {
    if (!state.lockedBartenderId || state.step === 'execute' || state.step === 'optimize' || state.step === 'bartender') return
    const idle = { state: 'idle', bartenderId: state.lockedBartenderId, selected: true, schedule: [], customBartender: selectedCustomBartender }
    pushPetState(idle)
    const t = setInterval(() => pushPetState(idle), 5000)
    return () => clearInterval(t)
  }, [state.lockedBartenderId, state.step, selectedCustomBartender])

  useEffect(() => {
    if (introStage !== 'app') return undefined
    startActionPoll()
    const off = onPetAction((action) => {
      if (action.type !== 'select-bartender' || !action.bartenderId) return
      if (state.step !== 'bartender') return
      if (!action.selectedAt || action.selectedAt < bartenderReadyAt.current) return
      const customBartender = state.customBartenders?.find((b) => b.id === action.bartenderId)
      dispatch({ type: 'SET_BARTENDER', id: action.bartenderId })
      dispatch({ type: 'GO', step: 'todos' })
      pushPetState({ state: 'idle', bartenderId: action.bartenderId, selected: true, schedule: [], customBartender })
    })
    return () => {
      off()
      stopActionPoll()
    }
  }, [dispatch, introStage, state.step, state.customBartenders])

  if (introStage === 'intro') {
    return (
      <IntroPage
        onQuickStart={() => startIntro('quick')}
        onFullStart={() => setIntroStage('guide')}
        onAdventure={() => setIntroStage('adventure')}
      />
    )
  }
  if (introStage === 'guide') {
    return (
      <GuidePage
        onAdventure={() => setIntroStage('adventure')}
        onDailyTavern={() => startIntro('full')}
        onBack={() => setIntroStage('intro')}
      />
    )
  }
  // Adventure 展会入口：不强制登录，直接深链到 collection。
  if (introStage === 'adventure') {
    return (
      <AdventurePage
        onBack={() => setIntroStage('intro')}
        onOpenPartnerWall={() => setIntroStage('partner-wall')}
      />
    )
  }
  if (introStage === 'partner-wall') return <PartnerWallPage onBack={() => setIntroStage('adventure')} />
  if (introStage === 'login') return <LoginPage onAuthenticated={() => setIntroStage('guest')} />
  if (!state.authToken || !state.authUser) return <LoginPage onAuthenticated={() => setIntroStage('intro')} />
  if (introStage === 'guest') return <GuestProfilePage onStart={() => startIntro(pendingStartMode, true)} />

  return (
    <div className={`app step-${state.step}`}>
      {showShell && (
        <div className="topbar tavern-topbar">
          <div className="tavern-top-actions">
            <button className="top-icon-btn cellar-icon-btn" type="button" onClick={openCellar} aria-label={text.cellarAria}>
              <span className="cellar-top-icon" aria-hidden="true" />
            </button>
            <button className="top-icon-btn" type="button" onClick={() => { setSettingsOpen(false); setGuideOpen((open) => !open); setGuideDetailsOpen(false) }} aria-label={text.guideAria}>
              <span className="guide-icon" aria-hidden="true" />
            </button>
            <button className="top-icon-btn settings-icon-btn" type="button" onClick={() => { setGuideOpen(false); setSettingsOpen((open) => !open) }} aria-label={text.settingsAria}>
              <span className="settings-top-icon" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {showShell && guideOpen && (
        <div className="tavern-guide-popover app-sheet-panel" role="dialog" aria-modal="true" aria-label={text.guideAria}>
          <div className="app-sheet-head">
            <button type="button" onClick={() => setGuideOpen(false)} aria-label={text.back}>‹</button>
            <strong>{text.guideTitle}</strong>
            <span />
          </div>
          <div className="guide-hero-scene" aria-hidden="true">
            <span className="guide-bar" />
            <span className="guide-bottle"><i /></span>
            <span className="guide-ticket"><i /></span>
            <span className="guide-cup"><i /></span>
          </div>
          <button className={`guide-summary-strip ${guideDetailsOpen ? 'open' : ''}`} type="button" onClick={() => setGuideDetailsOpen((open) => !open)} aria-expanded={guideDetailsOpen}>
            <span>{text.guideCopy}</span>
            <b>{guideDetailsOpen ? '收起' : '展开'}</b>
          </button>
          {guideDetailsOpen && (
            <>
              <div className="guide-card-grid" aria-label={text.guideTitle}>
                <span className="guide-card talk"><i /><b>{text.guideTalk}</b></span>
                <span className="guide-card recipe"><i /><b>{text.guideRecipe}</b></span>
                <span className="guide-card focus"><i /><b>{text.guideFocus}</b></span>
                <span className="guide-card finish"><i /><b>{text.guideFinish}</b></span>
              </div>
              <section className="guide-faq-panel" aria-label={text.guideFaqTitle}>
                <strong>{text.guideFaqTitle}</strong>
                <div>
                  {(text.guideFaq || []).map(([title, body], index) => (
                    <article key={title} className={`faq-note faq-note-${index + 1}`}>
                      <i aria-hidden="true" />
                      <b>{title}</b>
                      <p>{body}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {showShell && settingsOpen && (
        <div className="settings-popover app-sheet-panel" role="dialog" aria-modal="true" aria-label={text.settingsTitle}>
          <div className="app-sheet-head">
            <button type="button" onClick={() => setSettingsOpen(false)} aria-label={text.back}>‹</button>
            <strong>{text.settingsTitle}</strong>
            <span />
          </div>
          <div className="settings-card-list">
            <button className={`setting-card ${whiteNoiseOn ? 'on' : ''}`} type="button" onClick={toggleWhiteNoise}>
              <span className="setting-sound-icon" aria-hidden="true" />
              <span><strong>{text.whiteNoise}</strong><small>{text.whiteNoiseHint}</small></span>
              <b>{whiteNoiseOn ? text.on : text.off}</b>
            </button>
            <div className={`language-card-wrap ${languagePickerOpen ? 'open' : ''}`}>
              <button className="setting-card language-card language-cycle-card" type="button" onClick={() => setLanguagePickerOpen((open) => !open)}>
                <span className="setting-lang-icon" aria-hidden="true" />
                <span><strong>{text.language}</strong><small>{currentLanguage}</small></span>
                <b>{text.switch}</b>
              </button>
              {languagePickerOpen && (
                <div className="language-choice-list" role="listbox" aria-label={text.language}>
                  {languageOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={language === option.id ? 'selected' : ''}
                      onClick={() => {
                        setLanguage(option.id)
                        setLanguagePickerOpen(false)
                      }}
                      role="option"
                      aria-selected={language === option.id}
                    >
                      <span>{option.label}</span>
                      <b>{language === option.id ? text.current : text.choose}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className={`setting-card ${remindersOn ? 'on' : ''}`} type="button" onClick={toggleReminders}>
              <span className="setting-bell-icon" aria-hidden="true" />
              <span><strong>{text.reminder}</strong><small>{text.reminderHint}</small></span>
              <b>{reminderStatusLabel}</b>
            </button>
          </div>
        </div>
      )}

      {showShell && (
        <>
          <button className="guest-edge-pull" type="button" onClick={openProfileDrawer} aria-label="左滑打开顾客卡">
            <span aria-hidden="true" />
          </button>
          <button className={`profile-scrim ${profileOpen ? 'open' : ''}`} type="button" aria-label="关闭顾客卡" onClick={() => setProfileOpen(false)} />
          <aside className={`guest-drawer ${profileOpen ? 'open' : ''}`} aria-label="顾客卡">
            <div className="drawer-head">
              <strong>顾客卡</strong>
              <button type="button" onClick={openGuestProfile}>定制</button>
            </div>
            <div className="guest-passport">
              <div className={`guest-avatar level-${Math.min(5, tastingLevel)}`} aria-hidden="true">{profile.name?.slice(0, 1) || '客'}</div>
              <div>
                <span>今晚来客</span>
                {editingName ? (
                  <form className="guest-inline-name" onSubmit={(event) => { event.preventDefault(); saveGuestName() }}>
                    <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} placeholder="今晚的客人" maxLength={24} autoFocus />
                    <button type="submit">确认</button>
                  </form>
                ) : (
                  <button className="guest-name-button" type="button" onClick={() => { setRenameDraft(profile.name || ''); setEditingName(true) }}>
                    <h3>{profile.name || '无名旅人'}</h3>
                    <small>种种如何称呼您，今晚的客人。</small>
                  </button>
                )}
                <p>{profile.locationLabel || '远方'}</p>
              </div>
            </div>
            <div className="guest-visit-script" aria-label={`酒馆来访 ${visitDays} 天`}>
              酒馆来访 {visitDays} 天
            </div>
            <div className="guest-stats-row">
              <span><b>{state.todos.length}</b>今日配料</span>
              <span><b>{unlockedDrinks}</b>解锁酒单</span>
              <span><b>{state.cellar?.length || 0}</b>冰柜存酒</span>
            </div>
            <div className="tasting-level-card">
              <div>
                <span>品酒等级</span>
                <strong>Lv.{tastingLevel}</strong>
              </div>
              <div className="tasting-xp" aria-label={`经验进度 ${expProgress}%`}>
                <i style={{ width: `${expProgress}%` }} />
              </div>
              <p>来访、出杯、完成任务都会给这张卡添一点熟客经验。</p>
            </div>
            <div className="mini-cellar-heatmap" aria-label="每日饮用情况">
              <div className="mini-heatmap-head">
                <strong>月度酒柜</strong>
                <span>{state.today.slice(0, 7)}</span>
              </div>
              <div className="mini-heatmap-grid">
                {heatmapDays.map((day) => (
                  <span
                    key={day.iso}
                    className={`${day.drink ? 'has-drink' : ''} ${day.isToday ? 'today' : ''}`}
                    title={day.drink ? `${day.iso} ${day.drink.name} ${day.drink.time}` : day.iso}
                    style={day.drink ? { '--drink-color': day.drink.color } : undefined}
                  >
                    <b>{day.day}</b>
                    {day.drink?.time && <em>{day.drink.time}</em>}
                  </span>
                ))}
              </div>
            </div>
            <div className="guest-achievement-card">
              <div className="mini-heatmap-head">
                <strong>成就徽章</strong>
                <span>{guestBadges.filter((badge) => badge.unlocked).length}/{guestBadges.length}</span>
              </div>
              <div className="guest-badge-grid">
                {guestBadges.map((badge) => (
                  <span key={badge.id} className={badge.unlocked ? 'unlocked' : ''}>
                    <i className={`badge-${badge.icon}`} aria-hidden="true" />
                    <b>{badge.label}</b>
                    <em>{badge.hint}</em>
                  </span>
                ))}
              </div>
            </div>
            <div className="guest-preference-card">
              <label>常点偏好</label>
              <p>{profile.preferences || '还没留下偏好，种种会从今天开始观察。'}</p>
            </div>
            <div className="guest-preference-card">
              <label>忌口提醒</label>
              <p>{profile.avoidances || '暂时没有忌口。'}</p>
            </div>
            <div className="guest-preference-card">
              <label>熟客习惯</label>
              <p>{profile.habitSummary || '完成几次之后，这里会变成你的行为口味小抄。'}</p>
            </div>
          </aside>
        </>
      )}

      <Page />

      {showShell && (
        <nav className="tavern-bottom-nav" aria-label={text.guideTitle}>
          <button type="button" className={state.step === 'todos' ? 'active' : ''} onClick={() => dispatch({ type: 'GO', step: 'todos' })}>
            <i className="nav-note" aria-hidden="true" />
            {text.navToday}
          </button>
          <button type="button" className={state.step === 'optimize' ? 'active' : ''} onClick={() => dispatch({ type: 'GO', step: 'optimize' })}>
            <i className="nav-bottle" aria-hidden="true" />
            {text.navMix}
          </button>
          <button type="button" className={state.step === 'execute' ? 'active' : ''} onClick={() => dispatch({ type: 'GO', step: 'execute' })}>
            <i className="nav-clock" aria-hidden="true" />
            {text.navDo}
          </button>
          <button type="button" className={state.step === 'reveal' ? 'active' : ''} onClick={() => dispatch({ type: 'GO', step: 'reveal' })}>
            <i className="nav-cellar" aria-hidden="true" />
            {text.navCellar}
          </button>
        </nav>
      )}
    </div>
  )
}
