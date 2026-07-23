import { useState } from 'react'
import { loginWithEmailPassword } from '../engine/cellarApi.js'
import { useStore } from '../store/store.jsx'

function normalizeEmailInput(value) {
  return value.trim().slice(0, 254)
}

export default function LoginPage({ onAuthenticated }) {
  const { dispatch } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const canLogin = normalizeEmailInput(email).includes('@') && password.length >= 6

  async function login() {
    if (loading) return
    if (!canLogin) {
      setMessage('请填写邮箱和至少 6 位密码。首次入座还需要酒馆请柬码。')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const data = await loginWithEmailPassword({
        email: normalizeEmailInput(email).toLowerCase(),
        password,
        inviteCode: inviteCode.trim().toUpperCase(),
      })
      dispatch({ type: 'SET_AUTH', token: data.token, user: data.user })
      onAuthenticated?.()
    } catch (error) {
      const detail = error?.data?.message || error?.data?.error || error?.message
      if (error?.message === 'Failed to fetch') {
        setMessage('暂时连不上酒馆后端，请检查网络或生产 API 地址。')
      } else {
        setMessage(detail ? `入座失败：${detail}` : '邮箱或密码不对，请再试一次。')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card tavern-pass" aria-label="Life Kitchen 登录">
        <div className="login-emblem" aria-hidden="true">
          <span />
          <i />
        </div>
        <div className="login-heading">
          <span>Life Kitchen</span>
          <h1>酒馆请柬</h1>
        </div>

        <label className="login-field">
          <span>邮箱</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="login-field">
          <span>密码</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 6 位"
          />
        </label>

        <label className="login-field">
          <span>邀请码（首次入座）</span>
          <input
            autoCapitalize="characters"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase().slice(0, 24))}
            placeholder="老用户可留空"
          />
        </label>

        {message && <div className="login-message">{message}</div>}
        <div className="login-hint">首次入座会用请柬码创建 Supabase 账号；以后使用同一邮箱和密码即可直接入座。</div>

        <button className="login-submit" type="button" onClick={login} disabled={loading}>
          {loading ? '核验中' : '入座'}
        </button>
      </section>
    </main>
  )
}
