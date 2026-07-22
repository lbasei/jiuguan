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

  const canLogin =
    normalizeEmailInput(email).includes('@') &&
    password.trim().length >= 6 &&
    inviteCode.trim().length >= 4

  async function login() {
    if (loading) return
    if (!canLogin) {
      setMessage('请填写邮箱、至少 6 位密码，以及酒馆请柬码。')
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
        setMessage('现在不是网页入口。请打开 http://127.0.0.1:5173/ 或线上站点再入座。')
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
            autoComplete="email"
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
          <span>邀请码</span>
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase().slice(0, 24))}
            placeholder="ZHONGZHONG"
          />
        </label>

        {message && <div className="login-message">{message}</div>}
        <div className="login-hint">
          默认内测码：ZHONGZHONG。首次入座会用该邮箱自动开户；之后同一邮箱密码即可再次入座。
        </div>

        <button className="login-submit" type="button" onClick={login} disabled={loading}>
          {loading ? '核验中' : '入座'}
        </button>
      </section>
    </main>
  )
}
