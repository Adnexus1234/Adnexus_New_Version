import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { login, googleLogin } from '../services/api'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertTriangle, Timer } from 'lucide-react'

const Login = () => {
  const navigate = useNavigate()
  const { loginUser } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  // ── lockout feature states ──
  const [attemptsLeft, setAttemptsLeft] = useState(null)
  const [lockedUntil, setLockedUntil] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  // ── Google button width (card ki width ke hisaab se, taaki hamesha center + full-width rahe) ──
  const googleWrapRef = useRef(null)
  const [googleWidth, setGoogleWidth] = useState(308)

  useEffect(() => {
    const el = googleWrapRef.current
    if (!el) return

    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width)
      if (w) setGoogleWidth(Math.min(400, Math.max(200, w)))
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── countdown timer ──
  useEffect(() => {
    if (!lockedUntil) return

    const tick = () => {
      const secs = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setRemainingSeconds(secs)
      if (secs <= 0) {
        setLockedUntil(null)
        setError('')
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setAttemptsLeft(null)

    if (lockedUntil && remainingSeconds > 0) return

    setLoading(true)
    try {
      const res = await login(form)
      loginUser(res.data.access_token, res.data.user)
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail

      if (detail && typeof detail === 'object') {
        if (detail.locked) {
          setLockedUntil(Date.now() + detail.retry_after * 1000)
          setError(detail.message || 'Too many failed attempts.')
        } else if (detail.attempts_left !== undefined) {
          setAttemptsLeft(detail.attempts_left)
          setError(detail.message || 'Invalid email or password.')
        } else {
          setError(detail.message || 'Login failed.')
        }
      } else if (detail === 'Please verify your account first') {
        navigate('/verify-otp', { state: { email: form.email } })
      } else {
        setError(detail || 'Invalid email or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('')
    try {
      const res = await googleLogin({ id_token: credentialResponse.credential })
      loginUser(res.data.access_token, res.data.user)
      navigate('/dashboard')
    } catch (err) {
      setError('Google login failed. Please try again.')
    }
  }

  const isLocked = lockedUntil && remainingSeconds > 0

  return (
    <div style={styles.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .login-input-field:focus { border-color: #2563eb !important; box-shadow: 0 0 0 4px rgba(37,99,235,0.1) !important; }
        .login-submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(37,99,235,0.4) !important; }
        .login-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .login-eye-btn:hover { color: #2563eb !important; }
        .login-link:hover { text-decoration: underline !important; }
      `}</style>

      <div style={styles.bgBlob1} />
      <div style={styles.bgBlob2} />

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src={logo} alt="AdNexus" style={styles.logoImg} />
        </div>

        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.subtitle}>Log in to manage all your ad campaigns in one place</p>

        {error && (
          <div style={styles.error}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {attemptsLeft !== null && !lockedUntil && (
          <div style={styles.warning}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{attemptsLeft} attempt{attemptsLeft > 1 ? 's' : ''} left</span>
          </div>
        )}

        {isLocked && (
          <div style={styles.warning}>
            <Timer size={15} style={{ flexShrink: 0 }} />
            <span>Try again in {formatTime(remainingSeconds)}</span>
          </div>
        )}

        <div ref={googleWrapRef} style={styles.googleWrap}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google login failed.')}
            width={googleWidth}
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
            logo_alignment="left"
          />
        </div>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or continue with email</span>
          <div style={styles.dividerLine} />
        </div>

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Email</label>
          <div style={styles.inputWrap}>
            <Mail size={16} style={styles.inputIcon} />
            <input
              className="login-input-field"
              style={{
                ...styles.input,
                borderColor: focusedField === 'email' ? '#2563eb' : '#e2e8f0',
              }}
              type="email"
              name="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              required
            />
          </div>

          <label style={styles.label}>Password</label>
          <div style={styles.inputWrap}>
            <Lock size={16} style={styles.inputIcon} />
            <input
              className="login-input-field"
              style={{
                ...styles.input,
                paddingRight: '42px',
                borderColor: focusedField === 'password' ? '#2563eb' : '#e2e8f0',
              }}
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              required
            />
            <button
              type="button"
              className="login-eye-btn"
              style={styles.eyeBtn}
              onClick={() => setShowPassword((p) => !p)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            className="login-submit-btn"
            style={{
              ...styles.button,
              ...(isLocked ? styles.buttonLocked : {}),
              ...(loading ? { opacity: 0.75, cursor: 'not-allowed' } : {}),
            }}
            type="submit"
            disabled={loading || isLocked}
          >
            {isLocked ? (
              <><Timer size={15} /> Locked ({formatTime(remainingSeconds)})</>
            ) : loading ? (
              'Logging in...'
            ) : (
              <>Log In <ArrowRight size={15} /></>
            )}
          </button>

          <p style={styles.forgotText}>
            <Link to="/forgot-password" state={{ email: form.email }} className="login-link" style={styles.link}>
              Forgot password?
            </Link>
          </p>
        </form>

        <p style={styles.footerText}>
          Don't have an account? <Link to="/signup" className="login-link" style={styles.link}>Sign up</Link>
        </p>

        <p style={styles.supportText}>
          For any help contact us at{' '}
          <a href="mailto:support@adnexus.co.in" className="login-link" style={styles.link}>support@adnexus.co.in</a>
        </p>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
    background: 'linear-gradient(135deg, #eef2ff 0%, #f0f4ff 45%, #eef6ff 100%)',
    fontFamily: "'Inter', system-ui, sans-serif", position: 'relative', overflow: 'hidden', padding: '24px', boxSizing: 'border-box',
  },
  bgBlob1: {
    position: 'absolute', top: '-120px', right: '-100px', width: '360px', height: '360px',
    borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,127,255,0.16) 0%, rgba(43,127,255,0) 70%)',
    pointerEvents: 'none',
  },
  bgBlob2: {
    position: 'absolute', bottom: '-140px', left: '-100px', width: '380px', height: '380px',
    borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0) 70%)',
    pointerEvents: 'none',
  },
  card: {
    background: '#fff', borderRadius: '22px', padding: '38px 36px', width: '380px', maxWidth: '100%',
    boxShadow: '0 20px 50px rgba(30,58,138,0.12), 0 4px 14px rgba(30,58,138,0.06)',
    position: 'relative', zIndex: 1, border: '1px solid rgba(226,232,240,0.6)', boxSizing: 'border-box',
  },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: '18px' },
  logoImg: { width: '46px', height: '46px', objectFit: 'contain' },
  title: { fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '5px', textAlign: 'center', letterSpacing: '-0.4px' },
  subtitle: { fontSize: '13px', color: '#64748b', marginBottom: '22px', textAlign: 'center', lineHeight: 1.5 },
  label: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', marginTop: '14px' },
  inputWrap: { position: 'relative', width: '100%' },
  inputIcon: { position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' },
  input: {
    width: '100%', padding: '11px 12px 11px 38px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#0f172a',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease', background: '#f8faff',
  },
  eyeBtn: {
    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
    background: 'none', border: 'none', padding: '4px', transition: 'color 0.15s ease',
  },
  button: {
    width: '100%', marginTop: '22px', padding: '12px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg,#2b7fff,#1d4ed8)', color: '#fff', fontWeight: '700', fontSize: '14px',
    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '7px', boxShadow: '0 4px 14px rgba(43,127,255,0.35)', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  buttonLocked: { background: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' },
  error: {
    background: '#fef2f2', color: '#dc2626', padding: '10px 12px', borderRadius: '10px', fontSize: '12.5px',
    marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fecaca', fontWeight: '500',
  },
  warning: {
    background: '#fffbeb', color: '#b45309', padding: '10px 12px', borderRadius: '10px', fontSize: '12.5px',
    marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fde68a', fontWeight: '500',
  },
  footerText: { textAlign: 'center', fontSize: '13px', color: '#64748b', marginTop: '20px' },
  supportText: { textAlign: 'center', fontSize: '11.5px', color: '#94a3b8', marginTop: '10px' },
  forgotText: { textAlign: 'center', fontSize: '12.5px', color: '#64748b', marginTop: '12px' },
  link: { color: '#2563eb', fontWeight: '600', textDecoration: 'none' },
  googleWrap: { display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '18px', minHeight: '44px' },
  divider: { display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0 18px' },
  dividerLine: { flex: 1, height: '1px', background: '#e4e9f5' },
  dividerText: { fontSize: '11.5px', color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: '500' },
}

export default Login