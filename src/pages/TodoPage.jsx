// 步骤二：在吧台和今日种种聊天 → 结构化 Todo（可编辑）。

import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store.jsx'
import { parseTodosSmart } from '../engine/llm.js'
import { transcribeAudio } from '../engine/voice.js'
import { getBartender } from '../data/bartenders.js'
import { formatDuration } from '../engine/time.js'

const SAMPLE =
  '今天有点乱。我想把 PRD 写完，晚上还要讨论比赛方案，小精灵设定表也一直挂在心上。老师那边的信息要回，报销截图也要找一下。其实我有点累，但还想运动半小时，晚上最好能复盘一下今天做了什么。'

const ASSISTANT_MODES = {
  daily: {
    label: '今日调酒',
    title: '和种种聊聊今天',
    subtitle: '把今天发生的事写下来就好。种种会帮你整理成可以执行的酒单。',
    field: '今天想和种种说什么？',
    action: '整理一遍',
    redo: '重新整理',
    paper: '今日配料纸',
    next: '请今日调酒师定制配方 →',
    note: (count) => `调酒师听出了 ${count} 个心事片段，可以继续改写和调整时间。`,
    placeholder: SAMPLE,
  },
  free_time: {
    label: '空闲小酌',
    title: '问问这段空闲怎么用',
    subtitle: '告诉种种你现在有多久、什么状态、手边有什么限制，它会给出一小段可执行安排。',
    field: '现在这段空闲是什么情况？',
    action: '调一杯建议',
    redo: '重新建议',
    paper: '空闲小酌单',
    next: '生成这段空闲时间表 →',
    note: (count) => `种种给这段空闲配了 ${count} 个可选小动作，可以挑一项或直接进入调配。`,
    placeholder: '我现在大概有 40 分钟空闲，有点累但不想浪费。电脑在身边，不太想做很重的事，可以安排点什么？',
  },
  long_goal: {
    label: '长期酿造',
    title: '把长期目标酿成今天的一小口',
    subtitle: '告诉种种你想长期推进什么、期限和卡点，它会拆出今天能完成的任务并留下记录。',
    field: '这个长期目标想怎么推进？',
    action: '拆成今日任务',
    redo: '重新拆解',
    paper: '长期酿造纸',
    next: '生成今日推进安排 →',
    note: (count) => `种种从长期目标里拆出了 ${count} 个今日推进动作，后续可以存进你的酒柜记录。`,
    placeholder: '我想在一个月内把作品集整理出来，但现在材料很散，也不知道每天该推进什么。今天只有一小时，可以先做哪几步？',
  },
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
  if (mode === 'daily') return parsedTodos
  const now = Date.now()
  if (mode === 'free_time') {
    const minutes = inferFreeMinutes(input)
    const light = /累|困|没精神|低能量|不想/.test(input)
    const focus = Math.max(10, Math.min(light ? 20 : 35, Math.floor(minutes * 0.55)))
    const reset = Math.max(5, Math.min(15, Math.floor(minutes * 0.22)))
    const close = Math.max(5, minutes - focus - reset)
    return [
      {
        id: `todo_${now}_free_0`,
        title: light ? '选一件低阻力小事' : '处理一件最顺手的事',
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
        title: '喝水走动让状态回温',
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
        title: '记录下一步要接哪里',
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

const TALK_LINES = {
  rosemary: [
    '坐。先报最要紧的主菜，碎料我等会儿替你收边。',
    '今天如果乱，就先讲 deadline 和必须交付的东西。顺序错了，整杯会散。',
    '我会把高优先级放到炉火最稳的时候。还有哪件事不能拖？',
    '别急着把所有杂事倒进来。先说主线，再说消息、截图、收尾。',
  ],
  ginger: [
    '来，先开火。别讲完整计划，先讲一个能十分钟启动的口子。',
    '卡住没关系。把最容易开始的那件事丢进锅里，我先让它热起来。',
    '你不用一下子做完。告诉我哪件事最小、最顺手，我们拿它点火。',
    '拖着的时候别硬拽主线，先找一口热汤：回复一句、开个文档、写三行。',
  ],
  mint: [
    '慢慢说。累本身也算味道，我会把它放进缓冲层，不逼你硬撑。',
    '先告诉我哪些事耗神，哪些事能让你回一点气。顺序要留呼吸。',
    '高压任务后面我会垫一层奶泡。你只管说，别把自己熬干。',
    '如果今天能量低，我们就少晃杯，多留空隙。哪件事最重？',
  ],
  lemon: [
    '说吧，今天是哪件事先把你酸到了？我先把黏住的地方切开。',
    '别铺垫，直接讲要做什么。发黏的脑子需要一点清醒的酸味。',
    '我会先挑一个爽快入口，再把重点捞出来。哪件事最该醒神？',
    '情绪可以有，但别让它糊住任务。讲事，我替你把废话滤掉。',
  ],
  garlic: [
    '先把被打断的事说出来。我会把消息和杂事集中放进同一只托盘。',
    '不用替所有人都留位置。哪些必须回，哪些可以晚点，我帮你立边界。',
    '今天先守住杯口：深度任务不要被零碎小料一直撒进去。',
    '把外界请求都放上吧台。我会分出“现在处理”和“集中处理”。',
  ],
  cilantro: [
    '随便说，先不用排队。我们从最轻、最顺口的一口开始。',
    '不想被计划管住也可以说。今天的顺序可以边喝边调。',
    '先挑一件不费劲的事讲，剩下的慢慢拌进去，不急着定死。',
    '你可以改主意。我只帮你铺一条能走进去的小路。',
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
  const [lineIndex, setLineIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [recipeCollapsed, setRecipeCollapsed] = useState(false)
  const [bottling, setBottling] = useState(false)
  const [parseMeta, setParseMeta] = useState(null)
  const mode = state.assistantMode || 'daily'
  const modeConfig = ASSISTANT_MODES[mode] || ASSISTANT_MODES.daily
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const mediaStreamRef = useRef(null)

  const lines = linesForBartender(bartender) || DEFAULT_LINES

  useEffect(() => {
    setLineIndex(0)
  }, [bartender.id])

  async function parse() {
    const input = text.trim() || modeConfig.placeholder
    setLoading(true)
    const res = await parseTodosSmart(input)
    const modeTodos = fallbackModeTodos(mode, input, res.todos)
    dispatch({ type: 'SET_TODOS', todos: modeTodos, mode, note: input })
    setParseMeta({ source: res.source, mode, ...(res.meta || {}) })
    setRecipeCollapsed(false)
    setBottling(false)
    setLoading(false)
  }

  function bottleRecipe() {
    if (bottling || !todos.length) return
    setBottling(true)
    window.setTimeout(() => {
      dispatch({ type: 'GO', step: 'optimize' })
    }, 780)
  }

  function setTodoTime(todo, minutes) {
    const snapped = Math.round(Number(minutes || 5) / 5) * 5
    const next = Math.max(5, Math.min(240, snapped))
    dispatch({ type: 'UPDATE_TODO', id: todo.id, patch: { estimatedTime: next } })
  }

  function nudgeTodoTime(todo, delta) {
    setTodoTime(todo, Number(todo.estimatedTime || 30) + delta)
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

  return (
    <div>
      <h2 className="title">{modeConfig.title}</h2>
      <p className="subtitle">{modeConfig.subtitle}</p>

      <div className="assistant-mode-tabs" role="tablist" aria-label="选择种种助理模式">
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
            <strong>{item.label}</strong>
            <span>{key === 'daily' ? '安排今天' : key === 'free_time' ? '用好空档' : '拆长期目标'}</span>
          </button>
        ))}
      </div>

      <div className="talk-seat">
        <div className={`bar-talk mode-${mode}`}>
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
            <span className="prop-main" />
            <span className="prop-extra" />
            <span className="prop-spark" />
          </div>
          <div className="bar-counter" aria-hidden="true" />
        </div>

        <div className="talk-card">
          <label className="field">{modeConfig.field}</label>
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
              {loading ? '整理中…' : todos.length ? modeConfig.redo : modeConfig.action}
            </button>
          </div>
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

      {todos.length > 0 && (
        <div className={`recipe-scroll ${recipeCollapsed ? 'collapsed' : 'unfurled'} ${bottling ? 'is-bottling' : ''}`}>
          <div className="scroll-head">
            <div>
              <label className="field">{modeConfig.paper}</label>
              <div className="muted-note">{modeConfig.note(todos.length)}</div>
            </div>
            <button
              className={`scroll-toggle ${recipeCollapsed ? 'is-rolled' : 'is-open'}`}
              type="button"
              onClick={() => setRecipeCollapsed((v) => !v)}
              disabled={bottling}
              aria-label={recipeCollapsed ? '展开配料纸' : '卷起配料纸'}
            >
              <span className="roll-handle" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>

          {recipeCollapsed ? (
            <button
              className="scroll-roll recipe-bottle-stage"
              type="button"
              onClick={bottleRecipe}
              disabled={bottling}
              aria-label="把配料纸放进瓶子，进入调配酒单"
            >
              <span className="bottle-mouth" aria-hidden="true" />
              <span className="bottle-body" aria-hidden="true">
                <span className="bottle-glint" />
                <span className="bottle-liquid" />
              </span>
              <span className="rolled-paper" aria-hidden="true">
                <span className="paper-cap left" />
                <span className="paper-band" />
                <span className="paper-cap right" />
              </span>
              <span className="roll-shadow" aria-hidden="true" />
              <span className="bottle-hint">{bottling ? '放入瓶中…' : '点击把配方放入瓶子'}</span>
            </button>
          ) : (
            <>
              <div className="ingredient-paper">
                {todos.map((t, index) => (
                  <div key={t.id} className="ingredient-slip" style={{ '--slip-index': index }}>
                    <span className="slip-mark" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <input
                      className="slip-title"
                      value={t.title}
                      aria-label={`第 ${index + 1} 条心事片段`}
                      onChange={(e) => dispatch({ type: 'UPDATE_TODO', id: t.id, patch: { title: e.target.value } })}
                    />
                    <div className="slip-time time-adjuster">
                      <button
                        className="time-step"
                        type="button"
                        aria-label={`第 ${index + 1} 条减少 5 分钟`}
                        onClick={() => nudgeTodoTime(t, -5)}
                      >
                        -
                      </button>
                      <input
                        className="time"
                        type="range"
                        min="5"
                        max="240"
                        step="5"
                        value={t.estimatedTime}
                        aria-label={`第 ${index + 1} 条预计分钟`}
                        onChange={(e) => setTodoTime(t, e.target.value)}
                      />
                      <button
                        className="time-step"
                        type="button"
                        aria-label={`第 ${index + 1} 条增加 5 分钟`}
                        onClick={() => nudgeTodoTime(t, 5)}
                      >
                        +
                      </button>
                      <span className="time-value">{formatDuration(t.estimatedTime)}</span>
                    </div>
                    <button className="btn-ghost slip-delete" onClick={() => dispatch({ type: 'REMOVE_TODO', id: t.id })}>删</button>
                  </div>
                ))}
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <div className="spacer" />
                <button
                  className="btn-primary"
                  disabled={!todos.length}
                  onClick={() => dispatch({ type: 'GO', step: 'optimize' })}
                >
                  {modeConfig.next}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="btn-row">
        <button className="btn-ghost" onClick={() => dispatch({ type: 'GO', step: 'bartender' })}>← 上一步</button>
        <div className="spacer" />
      </div>
    </div>
  )
}
