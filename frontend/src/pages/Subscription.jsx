import React, { useState, useEffect, useRef } from 'react'
import { Check, X, Star, Sparkles, Calendar, Tag, BellRing, Bell } from 'lucide-react'
import { FaMedal, FaCrown, FaGem } from 'react-icons/fa'
import Sidebar, { LIGHT, DARK } from '../pages/Sidebar' // adjust path to match your project structure

/* ─────────────────────────────────────────────────────────
   PER-TIER COLOR THEME
───────────────────────────────────────────────────────── */
const TIER_THEME = {
  silver: {
    accent: '#64748b',
    accentSoft: 'rgba(100,116,139,0.12)',
    spot: 'rgba(148,163,184,0.22)',
    iconBg: 'linear-gradient(135deg,#94a3b8,#475569)',
    topBar: 'linear-gradient(90deg,#cbd5e1,#64748b)',
    borderGradient: 'linear-gradient(135deg,#e2e8f0,#94a3b8,#cbd5e1,#e2e8f0)',
    glow: 'rgba(100,116,139,0.32)',
  },
  gold: {
    accent: '#d97706',
    accentSoft: 'rgba(245,180,50,0.18)',
    spot: 'rgba(251,191,36,0.24)',
    iconBg: 'linear-gradient(135deg,#fbbf24,#d97706)',
    topBar: 'linear-gradient(90deg,#fde68a,#f59e0b)',
    borderGradient: 'linear-gradient(135deg,#fde68a,#f59e0b,#fbbf24,#fde68a)',
    glow: 'rgba(217,119,6,0.4)',
  },
  diamond: {
    accent: '#6d5bd0',
    accentSoft: 'rgba(109,91,208,0.12)',
    spot: 'rgba(124,92,236,0.20)',
    iconBg: 'linear-gradient(135deg,#60a5fa,#7c3aed)',
    topBar: 'linear-gradient(90deg,#93c5fd,#7c3aed)',
    borderGradient: 'linear-gradient(135deg,#bfdbfe,#a78bfa,#93c5fd,#bfdbfe)',
    glow: 'rgba(109,91,208,0.35)',
  },
}

const SUCCESS_GREEN = '#16a34a'
const AUTO_SLIDE_MS = 3000 // har kitne ms mein agli slide
const SCROLL_LOCK_MS = 800 // programmatic scroll ke dauran pill ko beech mein na kudne do

/* `live: false` shows a "Coming soon" badge. Set live: true when the feature ships. */
const FEATURES = [
  { key: 'campaigns', label: 'Campaign Creation', live: false },
  { key: 'support', label: 'Expert Support', live: false },
  { key: 'referral', label: 'Refer & Earn', live: false },
]

const PLANS = [
  {
    id: 'silver', name: 'Silver', Icon: FaMedal,
    tagline: 'Perfect for small businesses and startups.',
    price: 3500, months: 3, tag: 'Best for Startups', ribbon: null,
    included: { campaigns: true, support: false, referral: false },
    cta: 'Get Started',
  },
  {
    id: 'gold', name: 'Gold', Icon: FaCrown,
    tagline: 'Ideal for growing businesses looking for more support.',
    price: 6000, months: 6, tag: null, ribbon: 'Most Popular', featured: true,
    included: { campaigns: true, support: true, referral: false },
    cta: 'Choose Gold',
  },
  {
    id: 'diamond', name: 'Diamond', Icon: FaGem,
    tagline: 'The complete package for maximum growth and rewards.',
    price: 10000, months: 12, tag: null, ribbon: 'Best Value',
    included: { campaigns: true, support: true, referral: true },
    cta: 'Choose Diamond',
  },
]

const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const canTilt = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !prefersReducedMotion()

/* Counts a number up from 0 once, after `delay` ms */
const useCountUp = (target, delay = 0, duration = 1000) => {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0)
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(target); return }
    let raf, start
    const timeout = setTimeout(() => {
      const tick = (now) => {
        if (!start) start = now
        const p = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
        setValue(target * eased)
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf) }
  }, [target, delay, duration])
  return value
}

/* Decorative watermarks: slow float + twinkling sparkles */
const GoldGraphic = () => (
  <div className="tier-graphic" style={{
    position: 'absolute', right: '-10px', bottom: '-6px', width: '110px', height: '110px',
    pointerEvents: 'none', opacity: 0.5, zIndex: 0,
  }}>
    <div className="float-slow">
      <svg viewBox="0 0 120 120" width="110" height="110">
        <ellipse cx="60" cy="95" rx="34" ry="8" fill="#fbbf24" opacity="0.25" />
        <ellipse cx="60" cy="82" rx="26" ry="7" fill="#fbbf24" opacity="0.35" />
        <ellipse cx="60" cy="70" rx="18" ry="6" fill="#fcd34d" opacity="0.55" />
        <path d="M46 60 L54 40 L60 52 L66 40 L74 60 Z" fill="#fde68a" opacity="0.7" />
      </svg>
    </div>
    <Sparkles className="twinkle" size={14} color="#fbbf24" style={{ position: 'absolute', top: '6px', right: '18px' }} />
    <Sparkles className="twinkle d2" size={10} color="#fbbf24" style={{ position: 'absolute', top: '30px', right: '0px' }} />
  </div>
)

const DiamondGraphic = () => (
  <div className="tier-graphic" style={{
    position: 'absolute', right: '-8px', bottom: '-4px', width: '110px', height: '110px',
    pointerEvents: 'none', opacity: 0.55, zIndex: 0,
  }}>
    <div className="float-slow">
      <svg viewBox="0 0 120 120" width="110" height="110">
        <circle className="spin-slow" cx="62" cy="62" r="36" fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.6" />
        <path d="M62 34 L84 54 L62 92 L40 54 Z" fill="url(#dgrad)" opacity="0.85" />
        <path d="M62 34 L84 54 L62 60 Z" fill="#c4b5fd" opacity="0.5" />
        <defs>
          <linearGradient id="dgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <Sparkles className="twinkle" size={12} color="#a78bfa" style={{ position: 'absolute', top: '4px', right: '20px' }} />
    <Sparkles className="twinkle d2" size={9} color="#93c5fd" style={{ position: 'absolute', bottom: '18px', right: '2px' }} />
  </div>
)

/* ─────────────────────────────────────────────────────────
   PLAN CARD
   - staggered entrance (once)
   - 3D tilt + coloured spotlight that follows the cursor
   - gradient ring that slowly shifts on hover
   - icon pop, CTA shine, ribbon shine, price count-up
───────────────────────────────────────────────────────── */
const PlanCard = ({ plan, index, t, isNotified, onNotify, isActive }) => {
  const theme = TIER_THEME[plan.id]
  const { Icon } = plan
  const isSilver = plan.id === 'silver'
  const monthly = plan.price / plan.months
  const cardRef = useRef(null)

  const enterDelay = index * 130
  const price = useCountUp(plan.price, enterDelay + 150, 1000)

  const handleMove = (e) => {
    if (!canTilt()) return
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${(px - 0.5) * 10}deg`)
    el.style.setProperty('--rx', `${(0.5 - py) * 8}deg`)
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
  }

  const handleLeave = () => {
    const el = cardRef.current
    if (!el) return
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
  }

  return (
    <div
      className={`plan-enter ${isActive ? 'active-slide' : ''}`}
      style={{ animationDelay: `${enterDelay}ms`, height: '100%' }}
    >
      <div
        ref={cardRef}
        className={`plan-card-outer ${plan.id} ${plan.featured ? 'featured' : ''}`}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{
          borderRadius: '24px', padding: '2px', background: theme.borderGradient,
          backgroundSize: '200% 200%',
          boxShadow: plan.featured ? `0 22px 50px ${theme.glow}` : `0 10px 28px ${theme.accentSoft}`,
          height: '100%',
        }}
      >
        <div style={{
          borderRadius: '22px', display: 'flex', flexDirection: 'column', position: 'relative',
          overflow: 'hidden', background: t.cardBg, height: '100%',
        }}>
          <div style={{ height: '5px', width: '100%', background: theme.topBar }} />

          {/* cursor-following spotlight */}
          <div className="plan-spot" style={{
            background: `radial-gradient(280px circle at var(--mx, 50%) var(--my, 30%), ${theme.spot}, transparent 70%)`,
          }} />

          {plan.ribbon && (
            <div style={{
              position: 'absolute', top: '18px', right: '-1px', display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: theme.accent, color: '#fff', fontSize: '11px', fontWeight: 700,
              padding: '6px 14px 6px 16px', borderRadius: '999px 0 0 999px', overflow: 'hidden',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)', whiteSpace: 'nowrap', zIndex: 2,
            }}>
              <span className="ribbon-shine" />
              <Star size={11} fill="#fff" style={{ position: 'relative' }} />
              <span style={{ position: 'relative' }}>{plan.ribbon}</span>
            </div>
          )}
          {plan.tag && (
            <div style={{
              position: 'absolute', top: '18px', right: '18px',
              background: t.tableHeadBg || '#f1f5f9', color: t.textSecondary, fontSize: '10.5px', fontWeight: 700,
              padding: '5px 11px', borderRadius: '999px', border: `1px solid ${t.borderColor}`, whiteSpace: 'nowrap', zIndex: 2,
            }}>
              {plan.tag}
            </div>
          )}

          {plan.id === 'gold' && <GoldGraphic />}
          {plan.id === 'diamond' && <DiamondGraphic />}

          <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1 }}>
            {/* icon + name */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '13px', marginBottom: '22px' }}>
              <div className="plan-icon" style={{
                width: '48px', height: '48px', borderRadius: '14px', background: theme.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: `0 6px 16px ${theme.accentSoft}, inset 0 1.5px 2px rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.25)`,
              }}>
                <Icon size={20} color="#fff" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }} />
              </div>
              <div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: t.textPrimary }}>{plan.name}</div>
                <div style={{ fontSize: '12.5px', color: t.textSecondary, marginTop: '2px', lineHeight: 1.4 }}>{plan.tagline}</div>
              </div>
            </div>

            {/* price (counts up) */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
              <span style={{
                fontSize: '32px', fontWeight: 800, color: t.textPrimary, letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {inr(price)}
              </span>
              <span style={{ fontSize: '12px', color: t.textMuted }}>+ 18% GST</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', background: theme.accentSoft, color: theme.accent,
                fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px',
              }}>
                <Calendar size={12} /> {plan.months} Months
              </div>
              <span style={{ fontSize: '12.5px', color: t.textSecondary }}>
                about <strong style={{ color: t.textPrimary }}>{inr(monthly)}</strong> / month
              </span>
            </div>

            {/* CTA */}
            <button
              className="plan-cta"
              onClick={() => onNotify(plan.id)}
              disabled={isNotified}
              style={{
                position: 'relative', overflow: 'hidden',
                width: '100%', padding: '13px', borderRadius: '13px',
                border: isNotified ? 'none' : isSilver ? `1.5px solid ${t.borderColor}` : 'none',
                background: isNotified ? 'rgba(22,163,74,0.12)' : isSilver ? t.cardBg : theme.iconBg,
                color: isNotified ? '#15803d' : isSilver ? t.textPrimary : '#fff',
                fontSize: '13.5px', fontWeight: 700, cursor: isNotified ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {!isNotified && !isSilver && <span className="cta-shine" />}
              {isNotified
                ? <><Check size={15} strokeWidth={3} className="sub-pop" /> You're on the list</>
                : <><BellRing size={14} className="bell-ring" /> {plan.cta}: Notify me</>}
            </button>

            <div style={{ borderTop: `1px solid ${t.borderColor}`, margin: '24px 0 16px' }} />

            {/* features */}
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: t.textPrimary, marginBottom: '14px' }}>What's included</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              {FEATURES.map((f, i) => {
                const has = plan.included[f.key]
                return (
                  <li
                    key={f.key}
                    className="feat-in"
                    style={{ display: 'flex', alignItems: 'center', gap: '11px', animationDelay: `${enterDelay + 350 + i * 90}ms` }}
                  >
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: has ? SUCCESS_GREEN : '#e2e8f0',
                    }}>
                      {has
                        ? <Check size={13} color="#fff" strokeWidth={3} />
                        : <X size={13} color="#94a3b8" strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: has ? t.textPrimary : t.textMuted }}>
                      {f.label}
                    </span>
                    {has && !f.live && (
                      <span style={{
                        marginLeft: 'auto', fontSize: '11px', fontWeight: 700, fontStyle: 'italic',
                        color: theme.accent, background: theme.accentSoft,
                        padding: '2px 10px', borderRadius: '999px', whiteSpace: 'nowrap',
                      }}>
                        Coming soon
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

const Subscription = () => {
  const [darkMode, setDarkMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    typeof window !== 'undefined' && window.innerWidth <= 768
  )
  const [notified, setNotified] = useState({})
  const [mobileSlide, setMobileSlide] = useState(1) // start on Gold
  const gridRef = useRef(null)
  const slideRef = useRef(1)          // current slide (interval ke andar stale value na mile)
  const pausedRef = useRef(false)     // user touch kar raha ho to auto-slide ruka rahe
  const resumeTimerRef = useRef(null)
  const lockRef = useRef(false)       // programmatic scroll chal raha hai to scroll-listener ignore
  const lockTimerRef = useRef(null)
  const t = darkMode ? DARK : LIGHT

  // Left offset that centres slide `idx` inside the carousel
  const slideLeft = (idx) => {
    const el = gridRef.current
    const child = el && el.children[idx]
    if (!child) return 0
    return child.offsetLeft - (el.clientWidth - child.clientWidth) / 2
  }

  // Which card is centred while swiping
  const handleGridScroll = () => {
    if (lockRef.current) return // pill seedha target par jaaye, beech ke cards par na ruke
    const el = gridRef.current
    if (!el || window.innerWidth > 900) return
    const center = el.scrollLeft + el.clientWidth / 2
    let best = 0, bestDist = Infinity
    Array.from(el.children).forEach((child, i) => {
      const d = Math.abs(child.offsetLeft + child.clientWidth / 2 - center)
      if (d < bestDist) { bestDist = d; best = i }
    })
    slideRef.current = best
    setMobileSlide(best)
  }

  const scrollToSlide = (idx) => {
    const el = gridRef.current
    if (!el) return
    slideRef.current = idx
    setMobileSlide(idx)

    // scroll khatam hone tak scroll-listener ko band rakho
    lockRef.current = true
    clearTimeout(lockTimerRef.current)
    lockTimerRef.current = setTimeout(() => { lockRef.current = false }, SCROLL_LOCK_MS)

    el.scrollTo({ left: slideLeft(idx), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  /* ── AUTO SLIDE ──────────────────────────────────────── */
  // Auto-slide ko `ms` milliseconds ke liye roko, fir dobara chalu karo
  const pauseAuto = (ms = AUTO_SLIDE_MS) => {
    pausedRef.current = true
    clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => { pausedRef.current = false }, ms)
  }

  // User ungli rakhe to ruk jao, chhode to thodi der baad resume
  const handleTouchStart = () => {
    lockRef.current = false // user khud swipe kar raha hai, scroll tracking wapas chalu
    pausedRef.current = true
    clearTimeout(resumeTimerRef.current)
  }
  const handleTouchEnd = () => pauseAuto(AUTO_SLIDE_MS)

  // Tab / dot click par bhi pause
  const handleManualSlide = (idx) => {
    pauseAuto(AUTO_SLIDE_MS)
    scrollToSlide(idx)
  }

  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = setInterval(() => {
      if (window.innerWidth > 900) return          // sirf mobile/tablet carousel
      if (pausedRef.current) return                // user interact kar raha hai
      if (document.hidden) return                  // tab background mein hai
      const next = (slideRef.current + 1) % PLANS.length // last ke baad wapas pehli
      scrollToSlide(next)
    }, AUTO_SLIDE_MS)
    return () => {
      clearInterval(id)
      clearTimeout(resumeTimerRef.current)
      clearTimeout(lockTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On mobile, open with Gold (the recommended plan) centred
  useEffect(() => {
    if (window.innerWidth > 900) return
    const raf = requestAnimationFrame(() => {
      const el = gridRef.current
      if (el) el.scrollTo({ left: slideLeft(1), behavior: 'auto' })
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarCollapsed(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleNotify = (planId) => {
    // TODO: save to your waitlist endpoint here, e.g. api.post('/subscription/waitlist', { plan: planId })
    setNotified((prev) => ({ ...prev, [planId]: true }))
  }

  const page = { display: 'flex', height: '100vh', background: t.pageBg, fontFamily: 'inherit', overflow: 'hidden' }
  const main = { flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: '48px 32px 64px', position: 'relative' }

  return (
    <div style={page}>
      <style>{`
        /* ── entrance: cards rise in one after another, once ── */
        .plan-enter { opacity: 0; animation: planIn 0.7s cubic-bezier(.2,.8,.2,1) forwards; }
        @keyframes planIn {
          from { opacity: 0; transform: translateY(34px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .feat-in { opacity: 0; animation: featIn 0.5s ease forwards; }
        @keyframes featIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* ── card: tilt + lift, driven by --rx / --ry / --lift ── */
        .plan-card-outer {
          --lift: 0px; --rx: 0deg; --ry: 0deg;
          transform: perspective(1000px) translateY(var(--lift)) rotateX(var(--rx)) rotateY(var(--ry));
          transition: transform 0.25s cubic-bezier(.2,.8,.2,1), box-shadow 0.3s ease;
          will-change: transform;
        }
        .plan-card-outer.featured { --lift: -10px; }
        .plan-card-outer:hover { --lift: -8px; }
        .plan-card-outer.featured:hover { --lift: -16px; }
        .plan-card-outer.gold:hover { box-shadow: 0 28px 60px rgba(217,119,6,0.42) !important; }
        .plan-card-outer.silver:hover { box-shadow: 0 22px 48px rgba(100,116,139,0.34) !important; }
        .plan-card-outer.diamond:hover { box-shadow: 0 26px 55px rgba(109,91,208,0.38) !important; }

        /* gradient ring slowly drifts on hover */
        .plan-card-outer:hover { animation: ringShift 3s ease-in-out infinite alternate; }
        @keyframes ringShift { from { background-position: 0% 0%; } to { background-position: 100% 100%; } }

        /* spotlight follows the cursor */
        .plan-spot { position: absolute; inset: 0; opacity: 0; transition: opacity 0.3s ease; pointer-events: none; z-index: 0; }
        .plan-card-outer:hover .plan-spot { opacity: 1; }

        /* icon pops on hover */
        .plan-icon { transition: transform 0.35s cubic-bezier(.3,1.6,.5,1); }
        .plan-card-outer:hover .plan-icon { transform: scale(1.1) rotate(-6deg); }

        /* CTA: light sweep + bell wiggle on hover */
        .plan-cta { transition: filter 0.15s ease, transform 0.15s ease; }
        .plan-cta:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
        .plan-cta:active:not(:disabled) { transform: translateY(0) scale(0.99); }
        .plan-cta:focus-visible { outline: 2px solid #f97316; outline-offset: 2px; }
        .cta-shine {
          position: absolute; top: 0; bottom: 0; left: -60%; width: 40%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent);
          transform: skewX(-20deg); pointer-events: none;
        }
        .plan-cta:hover .cta-shine { animation: ctaShine 0.8s ease; }
        @keyframes ctaShine { to { left: 130%; } }
        .plan-cta:hover .bell-ring { animation: bellRing 0.6s ease; transform-origin: 50% 10%; }
        @keyframes bellRing {
          0%,100% { transform: rotate(0); } 20% { transform: rotate(16deg); }
          40% { transform: rotate(-14deg); } 60% { transform: rotate(8deg); } 80% { transform: rotate(-4deg); }
        }

        /* ribbon shine, a gentle pass every few seconds */
        .ribbon-shine {
          position: absolute; top: 0; bottom: 0; left: -50%; width: 40%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent);
          transform: skewX(-20deg); animation: ribbonShine 4.5s ease-in-out 1.5s infinite;
        }
        @keyframes ribbonShine { 0% { left: -50%; } 35%,100% { left: 140%; } }

        /* decorative graphics */
        .float-slow { animation: floatY 5s ease-in-out infinite; }
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .twinkle { animation: twinkle 2.6s ease-in-out infinite; }
        .twinkle.d2 { animation-delay: 1.2s; }
        @keyframes twinkle { 0%,100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }
        .spin-slow { transform-origin: 62px 62px; animation: spin 24s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* notified tick */
        .sub-pop { animation: subPop 0.3s cubic-bezier(.3,1.6,.5,1); }
        @keyframes subPop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        /* switcher + dots only exist on mobile */
        .plan-switcher, .plan-dots { display: none; }

        /* ── tablet + mobile: plans become a side-swipe carousel ── */
        @media (max-width: 900px) {
          .subscription-grid {
            display: flex !important;
            grid-template-columns: none !important;
            overflow-x: auto; overflow-y: hidden;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-x: contain;
            gap: 14px !important;
            max-width: 100% !important;
            padding: 26px 9% 28px !important;
            margin: -10px -4px 0 !important;
            scrollbar-width: none;
          }
          .subscription-grid::-webkit-scrollbar { display: none; }
          .plan-enter { flex: 0 0 82%; max-width: 420px; scroll-snap-align: center; scroll-snap-stop: always; }

          /* neighbours sit back, the centred card comes forward */
          .plan-enter .plan-card-outer {
            opacity: 0.55; scale: 0.94;
            transition: transform 0.25s cubic-bezier(.2,.8,.2,1), box-shadow 0.3s ease, opacity 0.35s ease, scale 0.35s ease;
          }
          .plan-enter.active-slide .plan-card-outer { opacity: 1; scale: 1; }
          .plan-card-outer.featured { --lift: 0px; }
          .plan-card-outer:hover, .plan-card-outer.featured:hover { --lift: 0px; }

          /* switcher: ek sliding pill + 3 transparent buttons */
          .plan-switcher {
            display: flex; gap: 4px; padding: 4px; border-radius: 14px;
            max-width: 380px; margin: 0 auto 6px; position: relative;
          }
          .plan-switch-pill {
            position: absolute; top: 4px; bottom: 4px; left: 4px;
            width: calc((100% - 16px) / 3);
            border-radius: 10px; pointer-events: none; z-index: 0;
            transition: transform 0.45s cubic-bezier(.4,0,.2,1), box-shadow 0.45s ease;
            will-change: transform;
          }
          .plan-switch-fill {
            position: absolute; inset: 0; border-radius: inherit;
            transition: opacity 0.45s ease;
          }
          .plan-switch-btn {
            flex: 1; border: none; cursor: pointer; padding: 10px 8px; border-radius: 10px;
            font-size: 13.5px; font-weight: 700; font-family: inherit;
            background: transparent; position: relative; z-index: 1;
            transition: color 0.3s ease;
            -webkit-tap-highlight-color: transparent;
          }
          .plan-dots { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 2px; }
        }

        @media (max-width: 640px) {
          .subscription-main { padding: 24px 12px 40px !important; }
          .subscription-heading { font-size: 26px !important; line-height: 1.3 !important; }
          .eyebrow-line { display: none !important; }
          .plan-enter { flex-basis: 86%; }
          .tier-graphic { display: none !important; }

          /* compare table fits the screen, no sideways scroll */
          .subscription-comparison { padding: 18px 12px !important; margin-top: 36px !important; }
          .subscription-comparison table { min-width: 0 !important; font-size: 12px !important; }
          .subscription-comparison th, .subscription-comparison td { padding: 10px 6px !important; }
        }
        @media (max-width: 400px) {
          .plan-enter { flex-basis: 90%; }
        }
        @media (hover: none) {
          .plan-card-outer { transform: translateY(var(--lift)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .plan-enter, .feat-in { animation: none !important; opacity: 1 !important; }
          .plan-card-outer, .plan-icon, .plan-cta, .plan-switch-btn, .plan-switch-pill, .plan-switch-fill { transition: none !important; }
          .plan-card-outer:hover { animation: none !important; }
          .ribbon-shine, .float-slow, .twinkle, .spin-slow, .cta-shine, .bell-ring, .sub-pop { animation: none !important; }
        }
      `}</style>

      <Sidebar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />

      <main style={main} className="subscription-main">
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>

          {/* ───────── Header ───────── */}
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '18px' }}>
              <span className="eyebrow-line" style={{ height: '1px', width: '70px', background: `linear-gradient(90deg, transparent, ${t.borderColor})` }} />
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', background: t.cardBg, color: t.textPrimary,
                border: t.border, borderRadius: '999px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                <Tag size={12} /> Choose Your Plan
              </div>
              <span className="eyebrow-line" style={{ height: '1px', width: '70px', background: `linear-gradient(90deg, ${t.borderColor}, transparent)` }} />
            </div>
            <h1 className="subscription-heading" style={{ fontSize: '38px', fontWeight: 800, color: t.textPrimary, lineHeight: 1.2, margin: 0, letterSpacing: '-0.02em' }}>
              Simple Pricing.{' '}
              <span style={{
                background: 'linear-gradient(90deg,#f97316,#fb923c)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                Powerful Features.
              </span>
            </h1>
            <p style={{ fontSize: '14.5px', color: t.textSecondary, marginTop: '14px', lineHeight: 1.6 }}>
              Choose the plan that fits your goals and start growing today.
            </p>
          </div>

          {/* ───────── Launch notice ───────── */}
          <div role="status" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: 'rgba(249,115,22,0.10)', color: t.textPrimary, borderRadius: '12px',
            padding: '11px 18px', fontSize: '13.5px', lineHeight: 1.5,
            maxWidth: '620px', margin: '0 auto 52px', textAlign: 'center',
          }}>
            <Bell size={16} color="#f97316" style={{ flexShrink: 0 }} />
            <span>Payments open soon. Tap <strong>Notify me</strong> on a plan and we'll tell you when it goes live.</span>
          </div>

          {/* ───────── Mobile plan switcher (hidden on desktop) ───────── */}
          <div className="plan-switcher" role="tablist" aria-label="Plans" style={{
            background: t.tableHeadBg || '#f1f5f9', border: t.border,
          }}>
            {/* sliding pill: position transform se, rang opacity crossfade se */}
            <span
              className="plan-switch-pill"
              aria-hidden="true"
              style={{
                transform: `translateX(calc(${mobileSlide} * (100% + 4px)))`,
                boxShadow: `0 6px 14px ${TIER_THEME[PLANS[mobileSlide].id].accentSoft}`,
              }}
            >
              {PLANS.map((p, i) => (
                <span
                  key={p.id}
                  className="plan-switch-fill"
                  style={{ background: TIER_THEME[p.id].iconBg, opacity: mobileSlide === i ? 1 : 0 }}
                />
              ))}
            </span>

            {PLANS.map((p, i) => {
              const active = mobileSlide === i
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleManualSlide(i)}
                  className="plan-switch-btn"
                  style={{ color: active ? '#fff' : t.textSecondary }}
                >
                  {p.name}
                </button>
              )
            })}
          </div>

          {/* ───────── Cards ───────── */}
          <div
            className="subscription-grid"
            ref={gridRef}
            onScroll={handleGridScroll}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onWheel={() => { lockRef.current = false; pauseAuto(AUTO_SLIDE_MS) }}
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '22px',
              margin: '0 auto', alignItems: 'stretch',
            }}
          >
            {PLANS.map((plan, i) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                index={i}
                t={t}
                isNotified={!!notified[plan.id]}
                onNotify={handleNotify}
                isActive={mobileSlide === i}
              />
            ))}
          </div>

          {/* dots (mobile only) */}
          <div className="plan-dots">
            {PLANS.map((p, i) => (
              <button
                key={p.id}
                onClick={() => handleManualSlide(i)}
                aria-label={`Show ${p.name} plan`}
                style={{
                  width: mobileSlide === i ? '24px' : '8px', height: '8px', borderRadius: '999px',
                  border: 'none', padding: 0, cursor: 'pointer',
                  background: mobileSlide === i ? TIER_THEME[p.id].accent : (darkMode ? 'rgba(255,255,255,0.25)' : '#cbd5e1'),
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* ───────── Comparison matrix ───────── */}
          <div className="subscription-comparison" style={{
            marginTop: '56px', background: t.cardBg, border: t.border, borderRadius: '18px',
            padding: '24px 28px', boxShadow: t.shadow,
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: t.textPrimary }}>Compare plans</div>
            <div style={{ fontSize: '13px', color: t.textSecondary, margin: '4px 0 18px' }}>
              Every plan includes campaign creation. Higher plans add support and rewards.
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ background: t.tableHeadBg }}>
                    <th style={th(t, 'left')} />
                    {PLANS.map((p) => (
                      <th key={p.id} style={{ ...th(t, 'center'), color: TIER_THEME[p.id].accent, fontSize: '13.5px' }}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Price (+ 18% GST)', (p) => inr(p.price)],
                    ['Access period', (p) => `${p.months} months`],
                    ['Effective cost per month', (p) => inr(p.price / p.months)],
                  ].map(([label, fn]) => (
                    <tr key={label}>
                      <td style={tdLabel(t)}>{label}</td>
                      {PLANS.map((p) => <td key={p.id} style={tdCell(t)}>{fn(p)}</td>)}
                    </tr>
                  ))}
                  {FEATURES.map((f, i) => {
                    const last = i === FEATURES.length - 1
                    return (
                      <tr key={f.key}>
                        <td style={{ ...tdLabel(t), borderBottom: last ? 'none' : tdLabel(t).borderBottom }}>{f.label}</td>
                        {PLANS.map((p) => (
                          <td key={p.id} style={{ ...tdCell(t), borderBottom: last ? 'none' : tdCell(t).borderBottom }}>
                            {p.included[f.key]
                              ? <Check size={17} color={SUCCESS_GREEN} strokeWidth={2.5} aria-label="Included" />
                              : <X size={16} color={t.textMuted} aria-label="Not included" />}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

const th = (t, align) => ({
  textAlign: align, padding: '12px 14px', fontWeight: 700, fontSize: '12.5px',
  color: t.textSecondary, borderBottom: `1px solid ${t.borderColor}`,
})
const tdLabel = (t) => ({ padding: '14px', color: t.textSecondary, borderBottom: `1px solid ${t.borderColor}` })
const tdCell = (t) => ({
  padding: '14px', textAlign: 'center', color: t.textPrimary, fontWeight: 600, borderBottom: `1px solid ${t.borderColor}`,
})

export default Subscription