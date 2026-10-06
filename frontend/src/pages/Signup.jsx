import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signup, validateReferralCode } from '../services/api'
import logo from '../assets/logo.png'
import {
  User, Phone, Mail, Lock, Eye, EyeOff, Tag, Check, X,
  ArrowRight, AlertTriangle, Loader2,
} from 'lucide-react'

const Signup = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' })
  const [otpChannel, setOtpChannel] = useState('email') // 'email' ya 'phone'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [manualRefCode, setManualRefCode] = useState('')
  const [refCheckStatus, setRefCheckStatus] = useState('idle') // idle | checking | valid | invalid
  const [referrerName, setReferrerName] = useState('')
  const [focusedField, setFocusedField] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      try {
        localStorage.setItem('adnexus_referral_code', ref)
        setManualRefCode(ref)
      } catch (e) {
        // storage disabled (e.g. Safari private mode) — ignore, form still works
      }
    } else {
      try {
        const saved = localStorage.getItem('adnexus_referral_code')
        if (saved) setManualRefCode(saved)
      } catch (e) {
        // storage disabled — ignore
      }
    }
  }, [])

  // Referral code type karte hi (debounced) backend se check karo — kiske through refer hua
  useEffect(() => {
    const code = manualRefCode.trim()
    if (!code) {
      setRefCheckStatus('idle')
      setReferrerName('')
      return
    }
    setRefCheckStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await validateReferralCode(code)
        setReferrerName(res.data.name)
        setRefCheckStatus('valid')
      } catch (err) {
        setReferrerName('')
        setRefCheckStatus('invalid')
      }
    }, 500) // typing rukne ke 500ms baad hi call hoga, har keystroke pe nahi

    return () => clearTimeout(timer) // pichla pending check cancel, agar user abhi bhi type kar raha hai
  }, [manualRefCode])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handlePhoneChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
    setForm({ ...form, phone: digitsOnly })
  }

  // Password rules
  const passwordRules = [
    { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
    { label: 'At least 1 uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
    { label: 'At least 1 number', test: (pw) => /[0-9]/.test(pw) },
    { label: 'At least 1 special character', test: (pw) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\];'`~\\/]/.test(pw) },
  ]

  const isPasswordValid = passwordRules.every((rule) => rule.test(form.password))
  const isPhoneValid = /^[6-9]\d{9}$/.test(form.phone)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isPhoneValid) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }

    if (!isPasswordValid) {
      setError('Please meet all password requirements.')
      return
    }

    setLoading(true)
    try {
      const refCode = manualRefCode.trim() || null

      await signup({ ...form, otp_channel: otpChannel, referral_code: refCode })

      // Signup successful ho gaya — ab referral code ki zaroorat nahi,
      // clean up kar do taaki agla signup (agar koi test kare) affect na ho
      try {
        localStorage.removeItem('adnexus_referral_code')
      } catch (e) {
        // storage disabled — ignore
      }

      navigate('/verify-otp', {
        state: { email: form.email, phone: form.phone, otpChannel },
      })
    } catch (err) {
      const detail = err.response?.data?.detail || 'Something went wrong. Please try again.'
      setError(detail)

      // Signup ho chuka hai DB mein but OTP send fail hua (500 + "Resend OTP" wala message)
      // — user ko verify-otp page pe bhej do taaki wo Resend OTP use kar sake,
      // signup form pe stuck na rahe.
      const otpSendFailed =
        err.response?.status === 500 && /resend otp/i.test(detail)

      if (otpSendFailed) {
        navigate('/verify-otp', {
          state: { email: form.email, phone: form.phone, otpChannel },
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .signup-input-field:focus { border-color: #2563eb !important; box-shadow: 0 0 0 4px rgba(37,99,235,0.1) !important; }
        .signup-submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(37,99,235,0.4) !important; }
        .signup-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .signup-eye-btn:hover { color: #2563eb !important; }
        .signup-link:hover { text-decoration: underline !important; }
        .signup-channel-btn:hover { border-color: #93c5fd !important; }
        @keyframes signupSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={styles.bgBlob1} />
      <div style={styles.bgBlob2} />

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src={logo} alt="AdNexus" style={styles.logoImg} />
        </div>

        <h2 style={styles.title}>Create your account</h2>
        <p style={styles.subtitle}>Manage all your ad campaigns in one place</p>

        {error && (
          <div style={styles.error}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Full Name</label>
          <div style={styles.inputWrap}>
            <User size={16} style={styles.inputIcon} />
            <input
              className="signup-input-field"
              style={{ ...styles.input, borderColor: focusedField === 'name' ? '#2563eb' : '#e2e8f0' }}
              type="text"
              name="name"
              placeholder="Your full name"
              value={form.name}
              onChange={handleChange}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              required
            />
          </div>

          <label style={styles.label}>Phone Number</label>
          <div style={{
            ...styles.phoneWrap,
            borderColor: focusedField === 'phone' ? '#2563eb' : '#e2e8f0',
            boxShadow: focusedField === 'phone' ? '0 0 0 4px rgba(37,99,235,0.1)' : 'none',
          }}>
            <span style={styles.phonePrefix}>
              <Phone size={14} style={{ marginRight: '5px', color: '#94a3b8' }} /> +91
            </span>
            <input
              style={styles.phoneInput}
              type="tel"
              name="phone"
              placeholder="10-digit mobile number"
              value={form.phone}
              onChange={handlePhoneChange}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              maxLength={10}
              required
            />
          </div>

          <label style={styles.label}>Email</label>
          <div style={styles.inputWrap}>
            <Mail size={16} style={styles.inputIcon} />
            <input
              className="signup-input-field"
              style={{ ...styles.input, borderColor: focusedField === 'email' ? '#2563eb' : '#e2e8f0' }}
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
              className="signup-input-field"
              style={{
                ...styles.input,
                paddingRight: '42px',
                borderColor: focusedField === 'password' ? '#2563eb' : '#e2e8f0',
              }}
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Create a strong password"
              value={form.password}
              onChange={handleChange}
              onFocus={() => { setPasswordFocused(true); setFocusedField('password') }}
              onBlur={() => setFocusedField(null)}
              required
            />
            <button
              type="button"
              className="signup-eye-btn"
              style={styles.eyeBtn}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {(passwordFocused || form.password.length > 0) && (
            <div style={styles.rulesBox}>
              {passwordRules.map((rule, idx) => {
                const passed = rule.test(form.password)
                return (
                  <div key={idx} style={styles.ruleRow}>
                    <span style={{ ...styles.ruleIconWrap, background: passed ? '#dcfce7' : '#e2e8f0' }}>
                      {passed ? <Check size={11} color="#16a34a" strokeWidth={3} /> : <X size={11} color="#94a3b8" strokeWidth={3} />}
                    </span>
                    <span style={{ ...styles.ruleText, color: passed ? '#16a34a' : '#64748b' }}>
                      {rule.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <label style={styles.label}>Referral Code (optional)</label>
          <div style={styles.inputWrap}>
            <Tag size={16} style={styles.inputIcon} />
            <input
              className="signup-input-field"
              style={{ ...styles.input, borderColor: focusedField === 'ref' ? '#2563eb' : '#e2e8f0' }}
              type="text"
              name="referralCode"
              placeholder="Enter referral code if you have one"
              value={manualRefCode}
              onChange={(e) => setManualRefCode(e.target.value.toUpperCase())}
              onFocus={() => setFocusedField('ref')}
              onBlur={() => setFocusedField(null)}
            />
          </div>
          {refCheckStatus === 'checking' && (
            <p style={styles.refHint}><Loader2 size={12} style={{ animation: 'signupSpin 0.8s linear infinite' }} /> Checking code...</p>
          )}
          {refCheckStatus === 'valid' && (
            <p style={{ ...styles.refHint, color: '#16a34a' }}><Check size={13} strokeWidth={3} /> Referred by: {referrerName}</p>
          )}
          {refCheckStatus === 'invalid' && (
            <p style={{ ...styles.refHint, color: '#dc2626' }}><X size={13} strokeWidth={3} /> Invalid referral code</p>
          )}

          {/* OTP channel choice */}
          <label style={styles.label}>Send verification code via</label>
          <div style={styles.channelWrap}>
            <button
              type="button"
              className="signup-channel-btn"
              style={{ ...styles.channelBtn, ...(otpChannel === 'email' ? styles.channelBtnActive : {}) }}
              onClick={() => setOtpChannel('email')}
            >
              <Mail size={14} /> Email
            </button>
            <button
              type="button"
              className="signup-channel-btn"
              style={{ ...styles.channelBtn, ...(otpChannel === 'phone' ? styles.channelBtnActive : {}) }}
              onClick={() => setOtpChannel('phone')}
            >
              <Phone size={14} /> Phone
            </button>
          </div>

          <button className="signup-submit-btn" style={{ ...styles.button, ...(loading ? { opacity: 0.75, cursor: 'not-allowed' } : {}) }} type="submit" disabled={loading}>
            {loading ? (
              <><Loader2 size={15} style={{ animation: 'signupSpin 0.8s linear infinite' }} /> Creating account...</>
            ) : (
              <>Sign Up <ArrowRight size={15} /></>
            )}
          </button>
        </form>

        <p style={styles.footerText}>
          Already have an account? <Link to="/login" className="signup-link" style={styles.link}>Log in</Link>
        </p>

        <p style={styles.supportText}>
          For any help contact us at{' '}
          <a href="mailto:support@adnexus.co.in" className="signup-link" style={styles.link}>support@adnexus.co.in</a>
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
    background: '#fff', borderRadius: '22px', padding: '38px 36px', width: '400px', maxWidth: '100%',
    boxShadow: '0 20px 50px rgba(30,58,138,0.12), 0 4px 14px rgba(30,58,138,0.06)',
    position: 'relative', zIndex: 1, border: '1px solid rgba(226,232,240,0.6)', boxSizing: 'border-box',
  },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: '16px' },
  logoImg: { width: '44px', height: '44px', objectFit: 'contain' },
  title: { fontSize: '21px', fontWeight: '800', color: '#0f172a', marginBottom: '5px', textAlign: 'center', letterSpacing: '-0.4px' },
  subtitle: { fontSize: '13px', color: '#64748b', marginBottom: '20px', textAlign: 'center', lineHeight: 1.5 },
  label: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', marginTop: '14px' },
  inputWrap: { position: 'relative', width: '100%' },
  inputIcon: { position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' },
  input: {
    width: '100%', padding: '11px 12px 11px 38px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#0f172a',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease', background: '#f8faff',
  },
  phoneWrap: {
    display: 'flex', alignItems: 'center', border: '1.5px solid #e2e8f0', borderRadius: '10px',
    overflow: 'hidden', background: '#f8faff', transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  phonePrefix: {
    display: 'flex', alignItems: 'center', padding: '11px 12px', fontSize: '14px', color: '#334155',
    background: '#eef2f8', borderRight: '1.5px solid #e2e8f0', fontWeight: '600', whiteSpace: 'nowrap',
  },
  phoneInput: {
    flex: 1, padding: '11px 12px', border: 'none', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit', background: 'transparent', color: '#0f172a',
  },
  eyeBtn: {
    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
    background: 'none', border: 'none', padding: '4px', transition: 'color 0.15s ease',
  },
  rulesBox: { marginTop: '10px', padding: '11px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' },
  ruleRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0' },
  ruleIconWrap: { width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s ease' },
  ruleText: { fontSize: '12.5px', fontWeight: '500' },
  refHint: { fontSize: '12px', marginTop: '6px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' },
  channelWrap: { display: 'flex', gap: '8px' },
  channelBtn: {
    flex: 1, padding: '9px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8faff',
    color: '#64748b', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'border-color 0.15s ease',
  },
  channelBtnActive: { background: '#eff6ff', color: '#2563eb', border: '1.5px solid #2563eb' },
  button: {
    width: '100%', marginTop: '22px', padding: '12px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg,#2b7fff,#1d4ed8)', color: '#fff', fontWeight: '700', fontSize: '14px',
    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '7px', boxShadow: '0 4px 14px rgba(43,127,255,0.35)', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  error: {
    background: '#fef2f2', color: '#dc2626', padding: '10px 12px', borderRadius: '10px', fontSize: '12.5px',
    marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fecaca', fontWeight: '500',
  },
  footerText: { textAlign: 'center', fontSize: '13px', color: '#64748b', marginTop: '20px' },
  supportText: { textAlign: 'center', fontSize: '11.5px', color: '#94a3b8', marginTop: '10px' },
  link: { color: '#2563eb', fontWeight: '600', textDecoration: 'none' },
}

export default Signup