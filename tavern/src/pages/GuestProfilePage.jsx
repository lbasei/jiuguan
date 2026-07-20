import { useState } from 'react'
import { saveUserProfile } from '../engine/cellarApi.js'
import { useStore } from '../store/store.jsx'

const PROFILE_TAGS = {
  preferences: [
    '先做最难的事',
    '喜欢清爽节奏',
    '需要明确截止',
    '适合短冲刺',
    '先整理再开工',
    '留一点机动时间',
  ],
  avoidances: [
    '不要排太满',
    '晚上不碰重任务',
    '别连续开会',
    '避免临时打断',
    '低电量少社交',
    '不要太多切换',
  ],
  habitSummary: [
    '上午更清醒',
    '午后需要缓冲',
    '开始前会拖一下',
    '完成后想被记录',
    '适合边做边勾',
    '需要提醒喝水',
  ],
}

function coordsLabel(coords) {
  if (!coords) return ''
  return `北纬 ${coords.latitude.toFixed(2)} · 东经 ${coords.longitude.toFixed(2)}`
}

function toggleTagValue(value, tag) {
  const parts = String(value || '')
    .split(/[、,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
  const exists = parts.includes(tag)
  const next = exists ? parts.filter((part) => part !== tag) : [...parts, tag]
  return next.join('、')
}

export default function GuestProfilePage({ onStart }) {
  const { state, dispatch } = useStore()
  const [profile, setProfile] = useState(() => ({
    name: state.userProfile?.name || '',
    gender: state.userProfile?.gender || 'neutral',
    locationLabel: state.userProfile?.locationLabel || '',
    coords: state.userProfile?.coords || null,
    preferences: state.userProfile?.preferences || '',
    avoidances: state.userProfile?.avoidances || '',
    habitSummary: state.userProfile?.habitSummary || '',
  }))
  const [locating, setLocating] = useState(false)
  const [locationHint, setLocationHint] = useState('')

  const updateProfile = (patch) => setProfile((current) => ({ ...current, ...patch }))

  const toggleProfileTag = (field, tag) => {
    setProfile((current) => ({
      ...current,
      [field]: toggleTagValue(current[field], tag),
    }))
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setLocationHint('这台设备暂时不能定位，可以手动写城市。')
      return
    }
    setLocating(true)
    setLocationHint('正在找今晚的吧台方位...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }
        updateProfile({ coords, locationLabel: coordsLabel(coords) })
        setLocationHint('位置已经记在酒馆签上。')
        setLocating(false)
      },
      () => {
        setLocationHint('定位没有拿到，也可以直接写城市、学校或公司。')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 1000 * 60 * 15 },
    )
  }

  const start = () => {
    const nextProfile = {
      ...state.userProfile,
      ...profile,
      id: state.userProfile?.id || `guest-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: profile.name.trim() || '无名旅人',
      locationLabel: profile.locationLabel.trim() || '远方',
    }
    dispatch({ type: 'SET_USER_PROFILE', profile: nextProfile })
    saveUserProfile(nextProfile).catch(() => {})
    onStart()
  }

  return (
    <main className="guest-page">
      <section className="guest-form-panel" aria-label="今日来客登记">
        <div className="guest-heading">
          <span>今日酒馆签</span>
          <h1>先把座位留给你</h1>
          <p>这些信息只会用在最后的签文和冰柜存档里。</p>
        </div>

        <label className="guest-field">
          <span>顾客名牌</span>
          <input
            value={profile.name}
            onChange={(event) => updateProfile({ name: event.target.value })}
            placeholder="例如：小林"
            maxLength={24}
          />
        </label>

        <div className="guest-field">
          <span>酒馆称谓</span>
          <div className="guest-gender" role="radiogroup" aria-label="称谓">
            {[
              ['female', '小姐'],
              ['male', '先生'],
              ['neutral', '旅人'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={profile.gender === value ? 'active' : ''}
                onClick={() => updateProfile({ gender: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="guest-field">
          <span>来访方位</span>
          <div className="guest-location">
            <input
              value={profile.locationLabel}
              onChange={(event) => updateProfile({ locationLabel: event.target.value })}
              placeholder="城市、学校、公司都可以"
              maxLength={36}
            />
            <button type="button" onClick={locate} disabled={locating}>{locating ? '定位中' : '定位'}</button>
          </div>
          {locationHint && <small>{locationHint}</small>}
        </label>

        <div className="guest-field">
          <span>常点偏好</span>
          <div className="guest-tag-prompt">不知道怎么写的话，先点几个像你的口味。</div>
          <div className="guest-tag-grid" aria-label="常点偏好标签">
            {PROFILE_TAGS.preferences.map((tag) => (
              <button
                key={tag}
                type="button"
                className={profile.preferences.includes(tag) ? 'selected' : ''}
                onClick={() => toggleProfileTag('preferences', tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <input
            value={profile.preferences}
            onChange={(event) => updateProfile({ preferences: event.target.value })}
            placeholder="也可以自己补一句"
            maxLength={80}
          />
        </div>

        <div className="guest-field">
          <span>忌口提醒</span>
          <div className="guest-tag-prompt">这些会帮种种少安排让你卡住的东西。</div>
          <div className="guest-tag-grid" aria-label="忌口提醒标签">
            {PROFILE_TAGS.avoidances.map((tag) => (
              <button
                key={tag}
                type="button"
                className={profile.avoidances.includes(tag) ? 'selected' : ''}
                onClick={() => toggleProfileTag('avoidances', tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <input
            value={profile.avoidances}
            onChange={(event) => updateProfile({ avoidances: event.target.value })}
            placeholder="也可以写自己的禁忌"
            maxLength={80}
          />
        </div>

        <div className="guest-field">
          <span>熟客习惯</span>
          <div className="guest-tag-prompt">先留一个印象，之后会按你的记录慢慢变准。</div>
          <div className="guest-tag-grid" aria-label="熟客习惯标签">
            {PROFILE_TAGS.habitSummary.map((tag) => (
              <button
                key={tag}
                type="button"
                className={profile.habitSummary.includes(tag) ? 'selected' : ''}
                onClick={() => toggleProfileTag('habitSummary', tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <textarea
            value={profile.habitSummary}
            onChange={(event) => updateProfile({ habitSummary: event.target.value })}
            placeholder="还有什么想让种种记住？"
            maxLength={120}
          />
        </div>

        <button className="guest-next" type="button" onClick={start}>
          存入顾客卡
        </button>
      </section>
    </main>
  )
}
