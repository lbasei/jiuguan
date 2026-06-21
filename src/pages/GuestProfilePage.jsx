import { useState } from 'react'
import { saveUserProfile } from '../engine/cellarApi.js'
import { useStore } from '../store/store.jsx'

function coordsLabel(coords) {
  if (!coords) return ''
  return `北纬 ${coords.latitude.toFixed(2)} · 东经 ${coords.longitude.toFixed(2)}`
}

export default function GuestProfilePage({ onStart }) {
  const { state, dispatch } = useStore()
  const [profile, setProfile] = useState(() => ({
    name: state.userProfile?.name || '',
    gender: state.userProfile?.gender || 'neutral',
    locationLabel: state.userProfile?.locationLabel || '',
    coords: state.userProfile?.coords || null,
  }))
  const [locating, setLocating] = useState(false)
  const [locationHint, setLocationHint] = useState('')

  const updateProfile = (patch) => setProfile((current) => ({ ...current, ...patch }))

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
          <p>这些信息只会用在最后的签文和酒柜存档里。</p>
        </div>

        <label className="guest-field">
          <span>怎么称呼你</span>
          <input
            value={profile.name}
            onChange={(event) => updateProfile({ name: event.target.value })}
            placeholder="例如：小林"
            maxLength={24}
          />
        </label>

        <div className="guest-field">
          <span>签文称谓</span>
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
          <span>今晚从哪里来</span>
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

        <button className="guest-next" type="button" onClick={start}>
          进入酒馆
        </button>
      </section>
    </main>
  )
}
