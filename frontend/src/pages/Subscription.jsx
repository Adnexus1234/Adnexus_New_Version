import React, { useState, useEffect } from 'react'
import { Check, X, Star, Rocket, Sparkles, ArrowRight, Calendar, Tag, X as CloseIcon } from 'lucide-react'
import { FaMedal, FaCrown, FaGem } from 'react-icons/fa'
import Sidebar, { LIGHT, DARK } from '../pages/Sidebar' // adjust path to match your project structure

/* ─────────────────────────────────────────────────────────
   PER-TIER COLOR THEME
   - borderGradient: used for the gradient "ring" border on cards & modal
   - modalBg: the popup's own background, tinted to match the plan
───────────────────────────────────────────────────────── */
const TIER_THEME = {
  silver: {
    accent: '#64748b',
    accentSoft: 'rgba(100,116,139,0.12)',
    accentBorder: 'rgba(100,116,139,0.25)',
    iconBg: 'linear-gradient(135deg,#94a3b8,#475569)',
    topBar: 'linear-gradient(90deg,#cbd5e1,#64748b)',
    borderGradient: 'linear-gradient(135deg,#e2e8f0,#94a3b8,#cbd5e1)',
    modalBg: 'linear-gradient(165deg,#0d1b3d 0%,#08122a 100%)',
    modalIsDark: true,
  },
  gold: {
    accent: '#d97706',
    accentSoft: 'rgba(245,180,50,0.18)',
    accentBorder: 'rgba(245,180,50,0.5)',
    iconBg: 'linear-gradient(135deg,#fbbf24,#d97706)',
    topBar: 'linear-gradient(90deg,#fde68a,#f59e0b)',
    borderGradient: 'linear-gradient(135deg,#fde68a,#f59e0b,#fbbf24)',
    modalBg: 'linear-gradient(165deg,#0d1b3d 0%,#08122a 100%)',
    modalIsDark: true,
  },
  diamond: {
    accent: '#6d5bd0',
    accentSoft: 'rgba(109,91,208,0.12)',
    accentBorder: 'rgba(109,91,208,0.3)',
    iconBg: 'linear-gradient(135deg,#60a5fa,#7c3aed)',
    topBar: 'linear-gradient(90deg,#93c5fd,#7c3aed)',
    borderGradient: 'linear-gradient(135deg,#bfdbfe,#a78bfa,#93c5fd)',
    modalBg: 'linear-gradient(165deg,#0d1b3d 0%,#08122a 100%)',
    modalIsDark: true,
  },
}

const SUCCESS_GREEN = '#16a34a'

const PLANS = [
  {
    id: 'silver',
    name: 'Silver',
    tagline: 'Perfect for small businesses and startups.',
    Icon: FaMedal,
    price: '3,500',
    duration: '3 Months',
    tag: 'Best for Startups',
    ribbon: null,
    variant: 'light',
    features: [
      { included: true }, { included: false }, { included: false },
    ],
    cta: 'Get Started',
  },
  {
    id: 'gold',
    name: 'Gold',
    tagline: 'Ideal for growing businesses looking for more support.',
    Icon: FaCrown,
    price: '6,000',
    duration: '6 Months',
    tag: null,
    ribbon: 'Most Popular',
    variant: 'light',
    features: [
      { included: true }, { included: true }, { included: false },
    ],
    cta: 'Choose Gold',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    tagline: 'The complete package for maximum growth and rewards.',
    Icon: FaGem,
    price: '10,000',
    duration: '12 Months',
    tag: null,
    ribbon: 'Best Value',
    variant: 'light',
    features: [
      { included: true }, { included: true }, { included: true },
    ],
    cta: 'Choose Diamond',
  },
]

const COMING_SOON_NOTE = 'Coming soon'
const FEATURE_LABELS = ['Campaign Creation', 'Expert Support', 'Refer & Earn']

/* Small decorative watermark graphics — kept low-opacity so they never
   fight with the actual text. Purely visual, hidden on mobile. */
const GoldGraphic = () => (
  <div className="tier-graphic" style={{
    position: 'absolute', right: '-10px', bottom: '-6px', width: '110px', height: '110px',
    pointerEvents: 'none', opacity: 0.5,
  }}>
    <svg viewBox="0 0 120 120" width="110" height="110">
      <ellipse cx="60" cy="95" rx="34" ry="8" fill="#fbbf24" opacity="0.25" />
      <ellipse cx="60" cy="82" rx="26" ry="7" fill="#fbbf24" opacity="0.35" />
      <ellipse cx="60" cy="70" rx="18" ry="6" fill="#fcd34d" opacity="0.55" />
      <path d="M46 60 L54 40 L60 52 L66 40 L74 60 Z" fill="#fde68a" opacity="0.7" />
    </svg>
    <Sparkles size={14} color="#fde68a" style={{ position: 'absolute', top: '6px', right: '18px', opacity: 0.9 }} />
    <Sparkles size={10} color="#fde68a" style={{ position: 'absolute', top: '30px', right: '0px', opacity: 0.6 }} />
  </div>
)

const DiamondGraphic = () => (
  <div className="tier-graphic" style={{
    position: 'absolute', right: '-8px', bottom: '-4px', width: '110px', height: '110px',
    pointerEvents: 'none', opacity: 0.55,
  }}>
    <svg viewBox="0 0 120 120" width="110" height="110">
      <circle cx="62" cy="62" r="36" fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.6" />
      <path d="M62 34 L84 54 L62 92 L40 54 Z" fill="url(#dgrad)" opacity="0.85" />
      <path d="M62 34 L84 54 L62 60 Z" fill="#c4b5fd" opacity="0.5" />
      <defs>
        <linearGradient id="dgrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
    <Sparkles size={12} color="#a78bfa" style={{ position: 'absolute', top: '4px', right: '20px', opacity: 0.8 }} />
    <Sparkles size={9} color="#93c5fd" style={{ position: 'absolute', bottom: '18px', right: '2px', opacity: 0.6 }} />
  </div>
)

/* ─────────────────────────────────────────────────────────
   PLAN DETAILS MODAL — opens when a card is clicked.
   Background + border ring are tinted per-plan (theme.modalBg /
   theme.borderGradient) so the popup visually matches the card
   that was clicked, using the site's own accent colors.
───────────────────────────────────────────────────────── */
const PlanModal = ({ plan, onClose, t }) => {
  if (!plan) return null
  const theme = TIER_THEME[plan.id]
  const { Icon } = plan
  const isDark = theme.modalIsDark

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8,12,26,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', animation: 'modalFade 0.18s ease',
      }}
    >
      {/* gradient-ring border wrapper */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '424px', borderRadius: '24px',
          padding: '2px', background: theme.borderGradient,
          boxShadow: '0 30px 70px rgba(4,10,30,0.45)',
          animation: 'modalPop 0.22s ease',
        }}
      >
        <div style={{
          borderRadius: '22px', overflow: 'hidden', position: 'relative',
          background: theme.modalBg,
        }}>
          <div style={{ height: '5px', width: '100%', background: theme.topBar }} />

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: '16px', right: '16px', width: '30px', height: '30px',
              borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
            }}
          >
            <CloseIcon size={15} color={isDark ? '#fff' : '#475569'} />
          </button>

          <div style={{ padding: '30px 28px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{
                width: '54px', height: '54px', borderRadius: '16px', background: theme.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: `0 8px 18px ${theme.accentSoft}, inset 0 1.5px 2px rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.25)`,
              }}>
                <Icon size={24} color="#fff" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }} />
              </div>
              <div>
                <div style={{ fontSize: '21px', fontWeight: '800', color: isDark ? '#fff' : t.textPrimary }}>
                  {plan.name} Plan
                </div>
                <div style={{ fontSize: '12.5px', color: isDark ? '#ffffff' : t.textSecondary }}>
                  {plan.tagline}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '34px', fontWeight: '800', color: isDark ? '#fff' : t.textPrimary }}>
                ₹{plan.price}
              </span>
              <span style={{ fontSize: '12.5px', color: isDark ? '#ffffff' : t.textMuted }}>
                + 18% GST
              </span>
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: theme.accentSoft, color: theme.accent,
              fontSize: '12.5px', fontWeight: '700', padding: '6px 14px', borderRadius: '999px',
              marginBottom: '22px', width: 'fit-content',
            }}>
              <Calendar size={13} /> {plan.duration}
            </div>

            <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, marginBottom: '18px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '26px' }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: f.included ? (isDark ? theme.accent : SUCCESS_GREEN) : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                  }}>
                    {f.included
                      ? <Check size={13} color="#fff" strokeWidth={3} />
                      : <X size={13} color={isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8'} strokeWidth={3} />}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#ffffff' : t.textPrimary }}>
                    {FEATURE_LABELS[i]}
                  </div>
                  <div style={{ fontSize: '12px', fontStyle: 'italic', color: isDark ? '#ffffff' : t.textMuted, marginLeft: 'auto' }}>
                    {COMING_SOON_NOTE}
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled
              style={{
                width: '100%', padding: '14px', borderRadius: '13px', border: 'none',
                background: theme.iconBg, color: '#fff', fontSize: '14px', fontWeight: '700',
                cursor: 'not-allowed', opacity: 0.92,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              }}
            >
              {plan.cta} — {COMING_SOON_NOTE} <ArrowRight size={14} />
            </button>
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
  const [activePlan, setActivePlan] = useState(null)
  const [mobileSlide, setMobileSlide] = useState(0)
  const gridRef = React.useRef(null)
  const t = darkMode ? DARK : LIGHT

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarCollapsed(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Tracks which card is centered while swiping the mobile carousel,
  // so the dot indicator + the "pop" focus effect stay in sync.
  const handleGridScroll = () => {
    const el = gridRef.current
    if (!el || el.children.length === 0) return
    const cardWidth = el.scrollWidth / PLANS.length
    const idx = Math.round(el.scrollLeft / cardWidth)
    setMobileSlide(Math.max(0, Math.min(PLANS.length - 1, idx)))
  }

  const scrollToSlide = (idx) => {
    const el = gridRef.current
    if (!el) return
    const cardWidth = el.scrollWidth / PLANS.length
    el.scrollTo({ left: cardWidth * idx, behavior: 'smooth' })
  }

  const page = { display: 'flex', height: '100vh', background: t.pageBg, fontFamily: 'inherit', overflow: 'hidden' }
  const main = { flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: '48px 32px 60px', position: 'relative' }

  const headerWrap = { textAlign: 'center', maxWidth: '640px', margin: '0 auto 44px', position: 'relative' }
  const eyebrowRow = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '18px' }
  const eyebrowLine = { height: '1px', width: '70px', background: `linear-gradient(90deg, transparent, ${t.borderColor})` }
  const eyebrowLineRev = { height: '1px', width: '70px', background: `linear-gradient(90deg, ${t.borderColor}, transparent)` }
  const eyebrow = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: t.cardBg, color: t.textPrimary, border: t.border,
    borderRadius: '999px', padding: '7px 16px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap',
  }
  const heading = { fontSize: '36px', fontWeight: '800', color: t.textPrimary, lineHeight: 1.2, margin: 0 }
  const headingAccent = {
    background: 'linear-gradient(90deg,#f97316,#fb923c)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  }
  const subtext = { fontSize: '14px', color: t.textSecondary, marginTop: '14px', lineHeight: 1.6 }

  const grid = {
    display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '22px',
    maxWidth: '1080px', margin: '0 auto', alignItems: 'stretch', position: 'relative', zIndex: 1,
  }

  const comparisonWrap = {
    maxWidth: '1080px', margin: '44px auto 0', background: t.cardBg,
    border: t.border, borderRadius: '18px', padding: '22px 26px', boxShadow: t.shadow,
    position: 'relative', zIndex: 1,
  }

  return (
    <div style={page}>
      <style>{`
        @keyframes modalFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalPop { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .plan-card-outer {
          transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease;
          cursor: pointer;
        }
        .plan-card-outer:hover {
          transform: translateY(-8px) scale(1.015);
          filter: brightness(1.03);
        }
        .plan-card-outer.gold:hover { box-shadow: 0 26px 55px rgba(217,119,6,0.4) !important; }
        .plan-card-outer.silver:hover { box-shadow: 0 20px 45px rgba(100,116,139,0.32) !important; }
        .plan-card-outer.diamond:hover { box-shadow: 0 24px 50px rgba(109,91,208,0.35) !important; }

        .mobile-dots { display: none; }

        @media (max-width: 900px) {
          .subscription-main { padding-top: 28px !important; }
          .subscription-grid {
            display: flex !important;
            grid-template-columns: none !important;
            overflow-x: auto !important;
            scroll-snap-type: x mandatory !important;
            -webkit-overflow-scrolling: touch;
            gap: 16px !important;
            max-width: 100% !important;
            padding: 4px 8% 14px !important;
            scrollbar-width: none;
          }
          .subscription-grid::-webkit-scrollbar { display: none; }
          .plan-card-outer {
            flex: 0 0 84% !important;
            scroll-snap-align: center !important;
            opacity: 0.5;
            transform: scale(0.94);
          }
          .plan-card-outer.active-slide {
            opacity: 1 !important;
            transform: scale(1) !important;
          }
          .mobile-dots { display: flex !important; }
        }
        @media (max-width: 640px) {
          .subscription-main { padding: 24px 14px 40px !important; }
          .subscription-heading { font-size: 24px !important; line-height: 1.3 !important; }
          .subscription-subtext { font-size: 13px !important; }
          .subscription-comparison { padding: 16px !important; }
          .subscription-comparison table { font-size: 12px !important; }
          .tier-graphic, .header-doodle, .header-dotgrid { display: none !important; }
          .plan-card-outer { flex-basis: 86% !important; }
        }
        @media (max-width: 420px) {
          .plan-card-outer { flex-basis: 92% !important; }
        }
      `}</style>

      <Sidebar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />

      <main style={main} className="subscription-main">

        {/* decorative top-left doodle */}
        <svg className="header-doodle" width="60" height="50" viewBox="0 0 60 50"
          style={{ position: 'absolute', top: '38px', left: '28px', opacity: 0.5 }}>
          <path d="M5 40 L40 10" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 6" fill="none" />
          <path d="M28 10 L40 10 L40 22" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>

        {/* decorative top-right dot grid */}
        <div className="header-dotgrid" style={{
          position: 'absolute', top: '44px', right: '32px', width: '64px', height: '48px',
          backgroundImage: `radial-gradient(${t.textMuted} 1px, transparent 1px)`,
          backgroundSize: '10px 10px', opacity: 0.35,
        }} />

        <div style={headerWrap}>
          <div style={eyebrowRow}>
            <span style={eyebrowLine} />
            <div style={eyebrow}><Tag size={12} /> Choose Your Plan</div>
            <span style={eyebrowLineRev} />
          </div>
          <h1 style={heading} className="subscription-heading">
            Simple Pricing. <span style={headingAccent}>Powerful Features.</span>
          </h1>
          <p style={subtext} className="subscription-subtext">
            Choose the plan that fits your goals and start growing today.
          </p>
        </div>

        <div style={grid} className="subscription-grid" ref={gridRef} onScroll={handleGridScroll}>
          {PLANS.map((plan, planIdx) => {
            const isDark = plan.variant === 'dark'
            const theme = TIER_THEME[plan.id]
            const { Icon } = plan
            const checkColor = isDark ? theme.accent : SUCCESS_GREEN

            /* Outer wrapper paints the gradient "ring" border; inner div
               holds the actual card background + content on top of it. */
            const outerBorderStyle = {
              borderRadius: '24px',
              padding: '2px',
              background: theme.borderGradient,
              boxShadow: isDark
                ? '0 24px 55px rgba(4,10,30,0.5)'
                : `0 10px 28px ${theme.accentSoft}`,
              height: '100%',
            }

            const innerCardStyle = {
              borderRadius: '22px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              background: isDark ? 'linear-gradient(165deg,#0d1b3d 0%,#08122a 100%)' : t.cardBg,
              height: '100%',
            }

            const nameColor = isDark ? '#ffffff' : t.textPrimary
            const taglineColor = isDark ? '#ffffff' : t.textSecondary
            const priceColor = isDark ? '#ffffff' : t.textPrimary
            const gstColor = isDark ? '#ffffff' : t.textMuted
            const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : t.borderColor
            const descColor = isDark ? '#ffffff' : t.textMuted

            return (
              <div
                key={plan.id}
                style={outerBorderStyle}
                className={`plan-card-outer ${plan.id} ${mobileSlide === planIdx ? 'active-slide' : ''}`}
                onClick={() => setActivePlan(plan)}
              >
                <div style={innerCardStyle}>
                  <div style={{ height: '5px', width: '100%', background: theme.topBar }} />

                  {plan.ribbon && (
                    <div style={{
                      position: 'absolute', top: '18px', right: '-1px',
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: theme.accent, color: '#fff',
                      fontSize: '11px', fontWeight: '700', padding: '6px 14px 6px 16px',
                      borderRadius: '999px 0 0 999px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.18)', whiteSpace: 'nowrap', zIndex: 2,
                    }}>
                      <Star size={11} fill="#fff" /> {plan.ribbon}
                    </div>
                  )}

                  {plan.tag && (
                    <div style={{
                      position: 'absolute', top: '18px', right: '18px',
                      background: t.tableHeadBg || '#f1f5f9', color: t.textSecondary,
                      fontSize: '10.5px', fontWeight: '700', padding: '5px 11px', borderRadius: '999px',
                      border: `1px solid ${t.borderColor}`, whiteSpace: 'nowrap', zIndex: 2,
                    }}>
                      {plan.tag}
                    </div>
                  )}

                  {plan.id === 'gold' && <GoldGraphic />}
                  {plan.id === 'diamond' && <DiamondGraphic />}

                  <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '13px', marginBottom: '20px' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '14px', background: theme.iconBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        boxShadow: `0 6px 16px ${theme.accentSoft}, inset 0 1.5px 2px rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.25)`,
                      }}>
                        <Icon size={20} color="#fff" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '19px', fontWeight: '800', color: nameColor }}>{plan.name}</div>
                        <div style={{ fontSize: '12.5px', color: taglineColor, marginTop: '2px', lineHeight: 1.4 }}>
                          {plan.tagline}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '30px', fontWeight: '800', color: priceColor }}>₹{plan.price}</span>
                      <span style={{ fontSize: '12px', color: gstColor }}>+ 18% GST</span>
                    </div>

                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: theme.accentSoft, color: theme.accent,
                      fontSize: '12px', fontWeight: '700', padding: '5px 12px', borderRadius: '999px',
                      marginBottom: '18px', width: 'fit-content',
                    }}>
                      <Calendar size={12} /> {plan.duration}
                    </div>

                    <div style={{ borderTop: `1px solid ${dividerColor}`, marginBottom: '18px' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                      {plan.features.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                          <div style={{
                            width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: f.included ? checkColor : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                          }}>
                            {f.included
                              ? <Check size={13} color="#fff" strokeWidth={3} />
                              : <X size={13} color={isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8'} strokeWidth={3} />}
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '600', fontStyle: 'italic', color: descColor }}>
                            {COMING_SOON_NOTE}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      disabled
                      title="Coming soon"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        marginTop: '24px', width: '100%', padding: '13px', borderRadius: '13px',
                        border: isDark ? 'none' : (plan.id === 'silver' ? `1.5px solid ${t.borderColor}` : 'none'),
                        background: isDark || plan.id !== 'silver' ? theme.iconBg : t.cardBg,
                        color: isDark || plan.id !== 'silver' ? '#fff' : t.textPrimary,
                        fontSize: '13.5px', fontWeight: '700', cursor: 'not-allowed', opacity: 0.92,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                      }}
                    >
                      {plan.cta} — {COMING_SOON_NOTE} <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mobile-dots" style={{ justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
          {PLANS.map((plan, i) => (
            <button
              key={plan.id}
              onClick={() => scrollToSlide(i)}
              aria-label={`Go to ${plan.name} plan`}
              style={{
                width: mobileSlide === i ? '22px' : '8px', height: '8px', borderRadius: '999px',
                border: 'none', padding: 0, cursor: 'pointer',
                background: mobileSlide === i ? TIER_THEME[plan.id].accent : (darkMode ? 'rgba(255,255,255,0.25)' : '#cbd5e1'),
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>

        <div style={comparisonWrap} className="subscription-comparison">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px', background: t.accentLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Rocket size={18} color={t.accent} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: t.textPrimary }}>Quick Comparison</div>
              <div style={{ fontSize: '12px', color: t.textSecondary }}>See how each plan stacks up.</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: t.tableHeadBg }}>
                  {['Plan', 'Price (+ 18% GST)', 'Campaign Creation (Duration)', 'Expert Support', 'Refer & Earn'].map((h) => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 14px', color: t.textSecondary,
                      fontWeight: '600', fontSize: '12px', borderBottom: `1px solid ${t.borderColor}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLANS.map((plan) => (
                  <tr key={plan.id} style={{ borderBottom: `1px solid ${t.borderColor}` }}>
                    <td style={{ padding: '12px 14px', fontWeight: '600', color: t.textPrimary }}>{plan.name}</td>
                    <td style={{ padding: '12px 14px', color: t.textSecondary }}>₹{plan.price}</td>
                    <td style={{ padding: '12px 14px', color: t.textSecondary }}>Unlimited ({plan.duration})</td>
                    <td style={{ padding: '12px 14px' }}>
                      {plan.features[1].included
                        ? <Check size={16} color={SUCCESS_GREEN} />
                        : <X size={16} color={t.textMuted} />}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {plan.features[2].included
                        ? <Check size={16} color={SUCCESS_GREEN} />
                        : <X size={16} color={t.textMuted} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <PlanModal plan={activePlan} onClose={() => setActivePlan(null)} t={t} />
    </div>
  )
}

export default Subscription 