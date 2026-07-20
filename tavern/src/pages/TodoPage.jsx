// 步骤二：在吧台和今日种种聊天 → 结构化 Todo（可编辑）。

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store/store.jsx'
import { parseTodosSmart } from '../engine/llm.js'
import { transcribeAudio } from '../engine/voice.js'
import { formatDuration } from '../engine/time.js'
import { getBartender } from '../data/bartenders.js'
import { requestSeedanceMotion } from '../engine/seedance.js'
import dailyModeIcon from '../../assets/mode-icons/daily-icon.png'
import freeTimeModeIcon from '../../assets/mode-icons/free-time-icon.png'
import longGoalModeIcon from '../../assets/mode-icons/long-goal-icon.png'

const SAMPLE =
  '今天有点乱。我想把 PRD 写完，晚上还要讨论比赛方案，小精灵设定表也一直挂在心上。老师那边的信息要回，报销截图也要找一下。其实我有点累，但还想运动半小时，晚上最好能复盘一下今天做了什么。'

const ASSISTANT_MODES = {
  daily: {
    label: '今日调酒',
    title: '和种种聊聊今天',
    subtitle: '坐到吧台边，先随口说今天。种种会把真正要做的事拣出来。',
    field: '今天想和种种说什么？',
    action: '整理一遍',
    redo: '重新整理',
    paper: '今日配料纸',
    next: '请今日调酒师定制配方 →',
    note: (count) => `种种听出了 ${count} 件能落地的事。你可以再改两笔。`,
    placeholder: SAMPLE,
  },
  free_time: {
    label: '留白小酌',
    title: '把空档调成一小杯',
    subtitle: '有一小段空档，就交给吧台。想休息还是推进一点，都可以说。',
    field: '现在这段空闲是什么情况？',
    action: '调一杯安排',
    redo: '重新建议',
    paper: '留白配方',
    next: '排好这段空档 →',
    note: (count) => `这段空档可以装进 ${count} 个小动作。轻一点也算数。`,
    placeholder: '我现在大概有 40 分钟空闲，有点累但不想浪费。电脑在身边，不太想做很重的事，可以安排点什么？',
  },
  long_goal: {
    label: '慢慢酿',
    title: '把远一点的事切成今天一口',
    subtitle: '远一点的事不用一次说完。先告诉种种终点和卡住的地方。',
    field: '这个长期目标想怎么推进？',
    action: '拆出今天一步',
    redo: '重新拆解',
    paper: '配方',
    next: '排好今天这一口 →',
    note: (count) => `从远目标里先切出 ${count} 口。今天只尝这一小段。`,
    placeholder: '我想在一个月内把作品集整理出来，但现在材料很散，也不知道每天该推进什么。今天只有一小时，可以先做哪几步？',
  },
}

const MODE_ICONS = {
  daily: dailyModeIcon,
  free_time: freeTimeModeIcon,
  long_goal: longGoalModeIcon,
}

const TIME_PRESETS = [25, 45, 120]
const MAX_ESTIMATE_MINUTES = 720

const TASK_TONES = {
  deep_work: { bg: '#E4F7F4', line: '#8BCDC7', dot: '#5FB9B4' },
  creative: { bg: '#FFF1C8', line: '#E4C464', dot: '#CFA33B' },
  communication: { bg: '#E7F3FF', line: '#A8CCE8', dot: '#74ACD0' },
  admin: { bg: '#FDEBF4', line: '#E8B6CF', dot: '#CF83AA' },
  recovery: { bg: '#FFF8DC', line: '#E9DFA5', dot: '#C8B85F' },
  urgent: { bg: '#FFECEF', line: '#E7A8B3', dot: '#D07C8A' },
  review: { bg: '#EAF8E8', line: '#A8D6A3', dot: '#76B870' },
  fallback: { bg: '#F2F7F7', line: '#B8CCCC', dot: '#8BAAAA' },
}

function getTaskTone(taskType) {
  return TASK_TONES[taskType] || TASK_TONES.fallback
}

function TimeWheel({ value, label, onChange }) {
  const minutes = Number(value || 30)
  const [draft, setDraft] = useState(String(minutes))
  const clamp = (next) => Math.max(1, Math.min(MAX_ESTIMATE_MINUTES, Math.round(next)))
  const set = (next) => {
    const safe = clamp(next)
    setDraft(String(safe))
    onChange(safe)
  }
  const nudge = (delta) => set(minutes + delta)

  useEffect(() => {
    setDraft(String(minutes))
  }, [minutes])

  const commitDraft = () => {
    const next = Number(draft)
    if (!Number.isFinite(next)) {
      setDraft(String(minutes))
      return
    }
    set(next)
  }

  return (
    <div className="time-counter">
      <div className="time-readable" aria-hidden="true">{formatDuration(minutes)}</div>
      <div className="time-desktop-editor" role="group" aria-label={label}>
        <button type="button" className="counter-step minus" aria-label={`${label} 减一分钟`} onClick={() => nudge(-1)}>
          <span />
        </button>
        <label className="time-input-shell">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max={MAX_ESTIMATE_MINUTES}
            step="1"
            value={draft}
            aria-label={label}
            onChange={(event) => {
              setDraft(event.target.value)
              if (event.target.value !== '') set(Number(event.target.value))
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                nudge(1)
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                nudge(-1)
              }
            }}
          />
          <span>分钟</span>
        </label>
        <button type="button" className="counter-step plus" aria-label={`${label} 加一分钟`} onClick={() => nudge(1)}>
          <span />
        </button>
      </div>
      <div className="time-presets" aria-label="常用时长">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={minutes === preset ? 'active' : ''}
            onClick={() => set(preset)}
          >
            {formatDuration(preset)}
          </button>
        ))}
      </div>
    </div>
  )
}

const MODE_TALK = {
  daily: '把今天挂在心上的事倒上吧台，我会把能执行的部分挑出来。',
  free_time: '空闲时间也有口味。告诉我你有多久、累不累、想轻一点还是推进一点。',
  long_goal: '长期目标不要一口闷。说终点、期限和卡点，我先给你倒出今天这一小杯。',
}

function inferFreeMinutes(text) {
  const hour = text.match(/(\d+(?:\.\d+)?)\s*(小时|h)/i)
  if (hour) return Math.round(Number(hour[1]) * 60)
  const minute = text.match(/(\d+)\s*(分钟|min)/i)
  if (minute) return Number(minute[1])
  if (/半小时/.test(text)) return 30
  if (/一小时|1小时/.test(text)) return 60
  if (/半天/.test(text)) return 180
  return 45
}

function fallbackModeTodos(mode, input, parsedTodos) {
  const freeIntent = /空闲|空档|碎片时间|没事做|不知道(做什么|干嘛)|不想浪费|休息一下|放松|脑子空|卡住/.test(input)
  if (mode === 'daily') {
    if (!parsedTodos.length && freeIntent) {
      return buildFreeTimeTodos(input)
    }
    return parsedTodos
  }
  const now = Date.now()
  if (mode === 'free_time') {
    return buildFreeTimeTodos(input, now)
  }
  if (mode === 'long_goal') {
    const base = parsedTodos.length ? parsedTodos.slice(0, 3) : []
    if (base.length) return base.map((todo, index) => ({
      ...todo,
      title: index === 0 ? `今日推进：${todo.title}` : todo.title,
      mustDo: index === 0 || todo.mustDo,
    }))
    return [
      {
        id: `todo_${now}_goal_0`,
        title: '写下目标终点和完成标准',
        estimatedTime: 20,
        taskType: 'review',
        energyCost: 'low',
        emotionalLoad: 'medium',
        priority: 'high',
        mustDo: true,
        status: 'pending',
      },
      {
        id: `todo_${now}_goal_1`,
        title: '拆出本周第一个里程碑',
        estimatedTime: 25,
        taskType: 'deep_work',
        energyCost: 'medium',
        emotionalLoad: 'medium',
        priority: 'high',
        mustDo: true,
        status: 'pending',
      },
      {
        id: `todo_${now}_goal_2`,
        title: '完成今天最小推进动作',
        estimatedTime: 25,
        taskType: 'creative',
        energyCost: 'medium',
        emotionalLoad: 'low',
        priority: 'medium',
        mustDo: false,
        status: 'pending',
      },
    ]
  }
  return parsedTodos
}

function buildFreeTimeTodos(input, now = Date.now()) {
  const minutes = inferFreeMinutes(input)
  const light = /累|困|没精神|低能量|不想|烦|焦虑|头疼/.test(input)
  const outside = /外面|户外|散步|走走|远眺|窗/.test(input)
  const focus = Math.max(8, Math.min(light ? 18 : 32, Math.floor(minutes * 0.48)))
  const reset = Math.max(5, Math.min(12, Math.floor(minutes * 0.24)))
  const close = Math.max(4, minutes - focus - reset)
  return [
    {
      id: `todo_${now}_free_0`,
      title: light ? '挑一件不用硬撑的小事' : '先做一件最顺手的小事',
      estimatedTime: focus,
      taskType: light ? 'admin' : 'deep_work',
      energyCost: light ? 'low' : 'medium',
      emotionalLoad: light ? 'medium' : 'low',
      priority: 'medium',
      mustDo: false,
      status: 'pending',
    },
    {
      id: `todo_${now}_free_1`,
      title: outside ? '喝水远眺或走一小圈' : '喝水远眺让眼睛离开屏幕',
      estimatedTime: reset,
      taskType: 'recovery',
      energyCost: 'low',
      emotionalLoad: 'low',
      priority: 'low',
      mustDo: false,
      status: 'pending',
    },
    {
      id: `todo_${now}_free_2`,
      title: '记下回来要接的下一步',
      estimatedTime: close,
      taskType: 'review',
      energyCost: 'low',
      emotionalLoad: 'low',
      priority: 'medium',
      mustDo: false,
      status: 'pending',
    },
  ]
}

const TALK_LINES = {
  rosemary: [
    '先坐下。别全倒出来，最要紧的那件先说。',
    '今天乱的话，就先讲必须交出去的东西。别从边角料开始。',
    '我不怕任务多，我怕顺序散。哪件事不能拖？',
    '消息、截图、收尾都先放旁边。主线端上来。',
  ],
  ginger: [
    '来，别想太久。先讲一件十分钟能碰到边的。',
    '卡住就卡住，先把锅烧热。最容易开始的是哪件？',
    '不用立刻变厉害，先动一下。说一个小口子就行。',
    '开文档、回一句、写三行，随便哪个都行。先点火。',
  ],
  mint: [
    '慢慢说，今天累也可以算进去。',
    '先告诉我哪件事最耗神，哪件事做完会舒服一点。',
    '你不用硬撑得很漂亮。我们把空隙也排进去。',
    '如果今天能量低，就少排一点。先说最重的那件。',
  ],
  lemon: [
    '说吧，今天哪里卡住了？别铺垫太久。',
    '你现在不是没事做，是脑子糊住了。先讲具体那件。',
    '我先帮你切开一个清爽入口。哪件最该醒神？',
    '情绪可以讲，但任务别藏在后面。把那件事说出来。',
  ],
  garlic: [
    '谁又来打断你了？先把这些东西摆出来。',
    '不用什么都立刻回。哪些必须回，哪些可以晚点？',
    '今天先把门关一会儿，不然主线又被切碎。',
    '外面的请求都放这边。我帮你分现在处理和等会儿处理。',
  ],
  cilantro: [
    '随便说，不用一上来就排得很整齐。',
    '不想被计划管着也行。我们先找一个顺口的入口。',
    '先讲一件不费劲的，剩下的等会儿再拌进去。',
    '你可以改主意，我不急。先走进去再说。',
  ],
}

const DEFAULT_LINES = [
  '坐吧，今天发生了什么？慢慢说。',
  '不用整理得很漂亮，我会帮你从里面挑出今天要处理的事。',
  '如果想到一半也没关系，先写下来，我们等会儿再调顺序。',
]

const STRATEGY_TALK = {
  deep_first: '我会先把主线端上来，再把碎事放到后面收。',
  ignite_first: '我会先找一个小火苗，让今天不要卡在开头。',
  recovery_buffer: '我会在高耗能任务后面留一层缓冲，不让你被熬干。',
  batch_admin: '我会把消息和杂事集中处理，帮你守住深度时间。',
  light_first: '我会从轻的开始，顺序可以慢慢商量。',
}

function linesForBartender(bartender) {
  if (TALK_LINES[bartender.id]) return TALK_LINES[bartender.id]
  const strategyLine = STRATEGY_TALK[bartender.strategy] || '我会按你的节奏先整理出能执行的顺序。'
  const tone = bartender.reminderTone || bartender.style || '自己的方式'
  return [
    `${bartender.name}在听。先随便说，我会用${tone}帮你整理。`,
    strategyLine,
    bartender.blurb || '把今天挂在心上的事讲出来，我们再调成一杯能喝下去的安排。',
    `如果你想改变这杯的口味，也可以直接说：先做什么、避开什么、需要怎样被提醒。`,
  ]
}

export default function TodoPage() {
  const { state, dispatch } = useStore()
  const bartender = getBartender(state.lockedBartenderId || state.bartenderId, state.customBartenders)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [ticketServing, setTicketServing] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [recipeCollapsed, setRecipeCollapsed] = useState(false)
  const [bottling, setBottling] = useState(false)
  const [parseMeta, setParseMeta] = useState(null)
  const [modeMotion, setModeMotion] = useState({ videoUrl: '', loading: false })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const mode = state.assistantMode || 'daily'
  const isQuickMode = state.workflowMode !== 'full'
  const modeConfig = ASSISTANT_MODES[mode] || ASSISTANT_MODES.daily
  const rowRefs = useRef(new Map())
  const prevRects = useRef(null)
  const dragRef = useRef(null)
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const mediaStreamRef = useRef(null)

  const lines = linesForBartender(bartender) || DEFAULT_LINES

  useEffect(() => {
    setLineIndex(0)
  }, [bartender.id])

  useLayoutEffect(() => {
    if (!prevRects.current) return
    rowRefs.current.forEach((el, id) => {
      const before = prevRects.current.get(id)
      if (!before) return
      const after = el.getBoundingClientRect()
      const dy = before.top - after.top
      if (!dy) return
      el.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
        { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }
      )
    })
    prevRects.current = null
  }, [state.todos])

  useEffect(() => {
    let cancelled = false
    setModeMotion({ videoUrl: '', loading: true })
    requestSeedanceMotion({
      scene: mode,
      mode,
      bartender,
      referenceImage: bartender.image,
    }).then((motion) => {
      if (cancelled) return
      setModeMotion({ videoUrl: motion.videoUrl || '', loading: false })
    })
    return () => {
      cancelled = true
    }
  }, [mode, bartender.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function parse() {
    const input = text.trim() || modeConfig.placeholder
    setLoading(true)
    setTicketServing(false)
    const res = await parseTodosSmart(input)
    const modeTodos = fallbackModeTodos(mode, input, res.todos)
    dispatch({ type: 'SET_TODOS', todos: modeTodos, mode, note: input })
    setParseMeta({ source: res.source, mode, ...(res.meta || {}) })
    setRecipeCollapsed(false)
    setBottling(false)
    setLoading(false)
    setTicketServing(true)
    window.setTimeout(() => {
      dispatch({ type: 'GO', step: 'optimize' })
    }, 520)
  }

  function bottleRecipe() {
    if (bottling || !todos.length) return
    setBottling(true)
    window.setTimeout(() => {
      dispatch({ type: 'GO', step: 'optimize' })
    }, 360)
  }

  function setTodoTime(todo, minutes) {
    const next = Math.max(1, Math.min(MAX_ESTIMATE_MINUTES, Math.round(Number(minutes || 1))))
    dispatch({ type: 'UPDATE_TODO', id: todo.id, patch: { estimatedTime: next } })
  }

  function captureTodoRects() {
    prevRects.current = new Map()
    rowRefs.current.forEach((el, id) => prevRects.current.set(id, el.getBoundingClientRect()))
  }

  function moveTodo(index, dir) {
    const nextIndex = index + dir
    if (nextIndex < 0 || nextIndex >= todos.length) return
    captureTodoRects()
    const nextTodos = [...todos]
    ;[nextTodos[index], nextTodos[nextIndex]] = [nextTodos[nextIndex], nextTodos[index]]
    dispatch({ type: 'REORDER_TODOS', todos: nextTodos })
  }

  function startTodoDrag(event, id) {
    if (event.button != null && event.button !== 0) return
    if (event.target.closest?.('button, input, textarea, select, a, .time-counter')) return
    const fromHandle = Boolean(event.target.closest?.('.slip-drag-handle'))
    if (event.pointerType === 'touch' && !fromHandle) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      startY: event.clientY,
      y: event.clientY,
      active: fromHandle,
    }
    if (fromHandle) {
      event.preventDefault()
      setDraggingId(id)
    }
  }

  function moveTodoDrag(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const totalDy = event.clientY - drag.startY
    if (!drag.active) {
      if (Math.abs(totalDy) < 34) return
      drag.active = true
      setDraggingId(drag.id)
    }
    event.preventDefault()
    const index = todos.findIndex((t) => t.id === drag.id)
    if (index === -1) return
    const row = rowRefs.current.get(drag.id)
    const rowHeight = row?.getBoundingClientRect().height || 76
    const threshold = Math.max(58, rowHeight * 0.62)
    const dy = event.clientY - drag.y
    if (Math.abs(dy) < threshold) return
    const dir = dy > 0 ? 1 : -1
    if (index + dir < 0 || index + dir >= todos.length) return
    drag.y += dir * threshold
    moveTodo(index, dir)
  }

  function stopTodoDrag(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragRef.current = null
    setDraggingId(null)
  }

  function petTalk() {
    setLineIndex((i) => (i + 1) % lines.length)
  }

  function appendVoiceText(spoken) {
    if (spoken) setText((t) => `${t}${t ? '\n' : ''}${spoken}`)
  }

  function stopTracks() {
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }

  function startBrowserSpeechFallback() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      return false
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return true
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.continuous = true
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript || '')
        .join('')
        .trim()
      appendVoiceText(spoken)
    }
    recognition.onerror = () => {
      setVoiceStatus('浏览器听写失败，正在尝试云端转写。')
      setListening(false)
      recognitionRef.current = null
      startCloudRecording()
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
      setVoiceStatus((status) => (status === '正在听你说话…再点一次结束。' ? '已经写到纸笺上了。' : status))
    }
    recognitionRef.current = recognition
    setListening(true)
    setVoiceStatus('正在听你说话…再点一次结束。')
    try {
      recognition.start()
      return true
    } catch {
      setListening(false)
      recognitionRef.current = null
      return false
    }
  }

  async function startVoice() {
    if (transcribing) return
    if (listening) {
      mediaRecorderRef.current?.stop()
      recognitionRef.current?.stop()
      setListening(false)
      setVoiceStatus('正在整理你的声音…')
      return
    }

    if (startBrowserSpeechFallback()) return
    await startCloudRecording()
  }

  async function startCloudRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceStatus('这里的浏览器不支持录音或语音识别。')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        setListening(false)
        setTranscribing(false)
        setVoiceStatus('录音失败，麦克风可能没有权限。')
        stopTracks()
      }
      recorder.onstop = async () => {
        setListening(false)
        setTranscribing(true)
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const spoken = await transcribeAudio(blob)
          appendVoiceText(spoken)
          setVoiceStatus('已经写到纸笺上了。')
        } catch (error) {
          const fallbackStarted = startBrowserSpeechFallback()
          setVoiceStatus(
            fallbackStarted
              ? '云端转写没接上，已切到浏览器听写。请再说一次。'
              : `${error.message || '语音转写失败。'}`
          )
        } finally {
          setTranscribing(false)
          stopTracks()
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setListening(true)
      setVoiceStatus('正在录音，再点一次结束。')
    } catch {
      setVoiceStatus('麦克风没有打开，检查一下浏览器权限。')
      stopTracks()
    }
  }

  const todos = state.todos
  const modeLine = MODE_TALK[mode] || MODE_TALK.daily
  const showParsedPaper = false

  return (
    <div>
      <h2 className="title">{isQuickMode ? '今天要做什么？' : modeConfig.title}</h2>
      <p className="subtitle">{isQuickMode ? '先把今天放到吧台上，别急着整理。种种会听出能开做的部分。' : modeConfig.subtitle}</p>

      <div className={`assistant-mode-tabs ${isQuickMode ? 'quick-visible' : ''}`} role="tablist" aria-label="选择种种助理模式">
        {Object.entries(ASSISTANT_MODES).map(([key, item]) => (
          <button
            key={key}
            type="button"
            className={mode === key ? 'on' : ''}
            onClick={() => {
              dispatch({ type: 'SET_ASSISTANT_MODE', mode: key })
              setLineIndex(0)
              setParseMeta(null)
            }}
          >
            <i className="mode-tab-icon" aria-hidden="true">
              <img src={MODE_ICONS[key]} alt="" />
            </i>
            <strong>{item.label}</strong>
            <span>{key === 'daily' ? '安排今天' : key === 'free_time' ? '留一点气口' : '把远事切小'}</span>
          </button>
        ))}
      </div>

      <div className={`talk-seat ${isQuickMode ? 'quick-talk-seat' : ''}`}>
        {!isQuickMode && <div className={`bar-talk mode-${mode}`}>
          <div className="bar-back" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <button className="npc-bubble" onClick={petTalk} type="button">
            {lineIndex === 0 ? modeLine : lines[lineIndex]}
          </button>
          {bartender.image && (
            <button className="bar-bartender-btn" onClick={petTalk} type="button" aria-label="和种种对话">
              <img className="bar-bartender-img sprite-bob" src={bartender.image} alt={bartender.name} />
            </button>
          )}
          {!bartender.image && <button className="bar-bartender-fallback" onClick={petTalk} type="button" aria-label="和种种对话">✦</button>}
          <div className={`mode-scene-prop prop-${mode}`} aria-hidden="true">
            {modeMotion.videoUrl ? (
              <video className="mode-scene-video" src={modeMotion.videoUrl} autoPlay loop muted playsInline />
            ) : (
              <img className="mode-scene-icon" src={MODE_ICONS[mode]} alt="" />
            )}
          </div>
          <div className="bar-counter" aria-hidden="true" />
        </div>}

        <div className={`talk-card ${loading ? 'is-organizing' : ''} ${ticketServing ? 'ticket-serving' : ''}`}>
          <label className="field">{isQuickMode ? '今天的事' : modeConfig.field}</label>
          <textarea
            placeholder={modeConfig.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="btn-row">
            <button className="btn-ghost" onClick={startVoice} type="button" disabled={transcribing}>
              {transcribing ? '转写中…' : listening ? '结束录音' : '语音说给它听'}
            </button>
            <button className="btn-ghost" onClick={() => setText(modeConfig.placeholder)}>用示例</button>
            <div className="spacer" />
            <button className="btn-primary" onClick={parse} disabled={loading}>
              {loading ? '收小票中…' : todos.length ? '重新整理' : '整理清单'}
            </button>
          </div>
          {(loading || ticketServing) && (
            <div className="ticket-serve-motion" aria-live="polite">
              <span className="ticket-paper" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <strong>{loading ? '种种正在听重点' : '小票递到吧台了'}</strong>
            </div>
          )}
          {voiceStatus && <div className="voice-status">{voiceStatus}</div>}
          {parseMeta && (
            <div className="parse-signal" aria-live="polite">
              <span>{parseMeta.source === 'openai-evomap' ? '高级调酒识别已开启' : '本地识别兜底中'}</span>
              {parseMeta.ignoredContext?.length > 0 && (
                <span>已把 {parseMeta.ignoredContext.length} 段情绪/背景留作口味，不放进清单。</span>
              )}
              {parseMeta.evoSignals?.length > 0 && <span>EVO Map 捕捉到 {parseMeta.evoSignals.length} 条调优线索。</span>}
            </div>
          )}
        </div>
      </div>

      {showParsedPaper && todos.length > 0 && (
        <div className={`recipe-scroll ${isQuickMode ? 'quick-list' : ''} ${recipeCollapsed ? 'collapsed' : 'unfurled'} ${bottling ? 'is-bottling' : ''}`}>
          <div className="scroll-head">
            <div>
              <div className="scroll-title-line">
                <label className="field">{isQuickMode ? '今日清单' : modeConfig.paper}</label>
                <span className="scroll-count-badge" aria-label={`共 ${todos.length} 项`}>{todos.length}</span>
              </div>
              <div className="muted-note">{isQuickMode ? '确认后就可以开始。' : modeConfig.note(todos.length)}</div>
            </div>
          </div>

          <div className="ingredient-paper">
                {todos.map((t, index) => {
                  const tone = getTaskTone(t.taskType)
                  return (
                  <div
                    key={t.id}
                    className={`ingredient-slip task-tone-${t.taskType || 'fallback'} ${draggingId === t.id ? 'is-dragging' : ''}`}
                    ref={(el) => {
                      if (el) rowRefs.current.set(t.id, el)
                      else rowRefs.current.delete(t.id)
                    }}
                    style={{
                      '--slip-index': index,
                      '--task-bg': tone.bg,
                      '--task-line': tone.line,
                      '--task-dot': tone.dot,
                    }}
                    onPointerDown={(event) => startTodoDrag(event, t.id)}
                    onPointerMove={moveTodoDrag}
                    onPointerUp={stopTodoDrag}
                    onPointerCancel={stopTodoDrag}
                  >
                    <span className="slip-mark" aria-hidden="true">
                      <span className="slip-dot" />
                      <span className="slip-order">{String(index + 1).padStart(2, '0')}</span>
                    </span>
                    <span className="slip-drag-handle" aria-label="拖动调整顺序" role="button" tabIndex={0}>
                      <span />
                      <span />
                      <span />
                    </span>
                    <input
                      className="slip-title"
                      value={t.title}
                      aria-label={`第 ${index + 1} 条心事片段`}
                      onChange={(e) => dispatch({ type: 'UPDATE_TODO', id: t.id, patch: { title: e.target.value } })}
                    />
                    <div className="slip-time time-adjuster">
                      <TimeWheel
                        value={t.estimatedTime}
                        label={`第 ${index + 1} 条预计分钟，上下滑动调整`}
                        onChange={(minutes) => setTodoTime(t, minutes)}
                      />
                    </div>
                    <button
                      className="btn-ghost slip-delete"
                      onClick={() => setDeleteTarget(t)}
                      type="button"
                      aria-label={`删除第 ${index + 1} 条`}
                      title="移除"
                    >
                      <span aria-hidden="true" />
                    </button>
                  </div>
                )})}
          </div>
          <div className="scroll-action-dock" aria-label="提交今日清单">
            <button
              className="service-bell-submit text-submit"
              type="button"
              onClick={isQuickMode ? () => dispatch({ type: 'GO', step: 'optimize' }) : bottleRecipe}
              disabled={!todos.length || bottling}
              aria-label="把今日清单递给吧台，进入下一步"
            >
              <span className="service-bell-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <strong>{bottling ? '交给吧台中' : isQuickMode ? '开始' : '交给吧台'}</strong>
            </button>
          </div>
        </div>
      )}

      <div className="btn-row">
        {!isQuickMode && <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'bartender' })}>上一步</button>}
        <div className="spacer" />
      </div>
      {deleteTarget && (
        <div className="confirm-panel" role="dialog" aria-modal="true" aria-label="确认删除事项">
          <div className="confirm-card delete-confirm-card">
            <div className="confirm-title">删除这条事项？</div>
            <p>删除后会从今日配料纸里移除，当前顺序和预估时间不会保留。这个操作不能恢复。</p>
            <div className="delete-preview">{deleteTarget.title}</div>
            <div className="btn-row">
              <button className="btn-ghost" type="button" onClick={() => setDeleteTarget(null)}>取消</button>
              <div className="spacer" />
              <button
                className="btn-primary danger-action"
                type="button"
                onClick={() => {
                  dispatch({ type: 'REMOVE_TODO', id: deleteTarget.id })
                  setDeleteTarget(null)
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
