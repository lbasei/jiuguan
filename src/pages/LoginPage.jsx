import { useState } from 'react'
import { loginWithPhoneCode, sendLoginCode } from '../engine/cellarApi.js'
import { useStore } from '../store/store.jsx'

function normalizePhoneInput(value) {
  return value.replace(/[^\d+]/g, '').slice(0, 20)
}

export default function LoginPage({ onAuthenticated }) {
  const { dispatch } = useStore()
  const [phone, setPhone] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [devCode, setDevCode] = useState('')

  const canSend = normalizePhoneInput(phone).replace(/\D/g, '').length >= 8 && inviteCode.trim().length >= 4
  const canLogin = canSend && code.trim().length >= 4

  async function requestCode() {
    if (loading) return
    if (!canSend) {
      setMessage('先填手机号和酒馆请柬码，再取验证码。')
      return
    }
    setLoading(true)
    setMessage('')
    setDevCode('')
    try {
      const data = await sendLoginCode({
        phone: normalizePhoneInput(phone),
        inviteCode: inviteCode.trim().toUpperCase(),
      })
      setSent(true)
      setDevCode(data.devCode || '')
      if (data.devCode) {
        setCode(data.devCode)
        setMessage(`测试验证码：${data.devCode}，已自动填入。`)
      } else {
        setMessage(data.provider === 'dev-console' ? '测试验证码已生成。' : '验证码已送到手机。')
      }
    } catch (error) {
      const detail = error?.data?.detail || error?.data?.message || error?.data?.error
      if (error?.message === 'Failed to fetch') {
        setMessage('现在不是网页入口。请打开 http://127.0.0.1:5173/ 或线上站点再取号。')
      } else {
        const status = error?.status ? `(${error.status})` : ''
        setMessage(detail ? `验证码没有送到${status}：${detail}` : (error?.message || '验证码没有送到。'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function login() {
    if (loading) return
    if (!canLogin) {
      setMessage('请输入手机号、邀请码和 6 位验证码。')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const data = await loginWithPhoneCode({
        phone: normalizePhoneInput(phone),
        code: code.trim(),
        inviteCode: inviteCode.trim().toUpperCase(),
      })
      dispatch({ type: 'SET_AUTH', token: data.token, user: data.user })
      onAuthenticated?.()
    } catch (error) {
      const detail = error?.data?.message || error?.data?.error || error?.message
      setMessage(detail ? `入座失败：${detail}` : '验证码不对，或者已经过期了。')
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
          <span>手机号</span>
          <input
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(normalizePhoneInput(event.target.value))}
            placeholder="手机"
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

        <label className="login-field code-field">
          <span>验证码</span>
          <div>
            <input
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={sent ? '验证码' : '取验证码'}
            />
            <button type="button" onClick={requestCode} disabled={loading}>
              {sent ? '再取' : '取号'}
            </button>
          </div>
        </label>

        {message && <div className={`login-message ${devCode ? 'dev' : ''}`}>{message}</div>}
        <div className="login-hint">默认内测码：ZHONGZHONG。掌柜可生成薄荷、姜、柠檬等种种主题请柬；未接短信服务时，测试验证码固定为 123456。</div>

        <button className="login-submit" type="button" onClick={login} disabled={loading}>
          {loading ? '核验中' : '入座'}
        </button>
      </section>
    </main>
  )
}
