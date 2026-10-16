import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X, Check, Megaphone } from 'lucide-react'
import { SiGoogleads, SiMeta, SiInstagram } from 'react-icons/si'
import { FaLinkedin } from 'react-icons/fa'

/* ── Platform helpers ─────────────────────────────────────────────
   Agar tumhare campaign object me platforms kisi aur field me aate hain,
   to sirf getPlatforms() ko adjust karna hai — baaki component same rahega. */
const BRANDS = {
  google:    { Icon: SiGoogleads, bg: '#4285F4', label: 'Google Ads' },
  meta:      { Icon: SiMeta,      bg: '#0866FF', label: 'Meta' },
  instagram: { Icon: SiInstagram, bg: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)', label: 'Instagram' },
  linkedin:  { Icon: FaLinkedin,  bg: '#0A66C2', label: 'LinkedIn' },
}

const platformKey = (raw) => {
  const s = String(raw || '').toLowerCase()
  if (s.includes('google')) return 'google'
  if (s.includes('insta') || s === 'ig') return 'instagram'
  if (s.includes('meta') || s.includes('facebook') || s === 'fb') return 'meta'
  if (s.includes('linkedin')) return 'linkedin'
  return null
}

const getPlatforms = (c) => {
  const raw = c.platforms || c.platform_names || c.platform || []
  const list = Array.isArray(raw) ? raw : [raw]
  const keys = list
    .map(p => platformKey(p && typeof p === 'object' ? (p.platform_name || p.platform || p.name) : p))
    .filter(Boolean)
  return [...new Set(keys)]
}

const isActive = (c) => c.status === 'active'

const MOBILE_BP = 640

// Screen size track karne ke liye hook
const useIsMobile = (bp = MOBILE_BP) => {
  const get = () => typeof window !== 'undefined' && window.matchMedia(`(max-width:${bp}px)`).matches
  const [isMobile, setIsMobile] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`)
    const handler = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [bp])
  return isMobile
}

/* ── Styles (scrollbar, animations) ── */
const SelectStyles = () => (
  <style>{`
    @keyframes cs-pop {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes cs-slide-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    @keyframes cs-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .cs-panel { animation: cs-pop 0.14s ease-out; }
    .cs-sheet { animation: cs-slide-up 0.22s ease-out; }
    .cs-overlay { animation: cs-fade 0.2s ease-out; }
    .cs-list::-webkit-scrollbar { width: 6px; }
    .cs-list::-webkit-scrollbar-track { background: transparent; }
    .cs-list::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 9999px; }
    .cs-list::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.5); }
    .cs-list { scrollbar-width: thin; scrollbar-color: rgba(100,116,139,0.3) transparent; overscroll-behavior: contain; }
    .cs-trigger:focus-visible { outline: 2px solid #2b7fff; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .cs-panel, .cs-sheet, .cs-overlay { animation: none; }
    }
  `}</style>
)

const CampaignSelect = ({ campaigns = [], selectedCampaign, onChange, t, darkMode }) => {
  const isMobile = useIsMobile()
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi]       = useState(0)   // keyboard / hover highlighted index
  const wrapRef  = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  // Solid panel colors (cardBg dark mode me translucent hota hai, isliye alag)
  const panelBg   = darkMode ? '#0c1d38' : '#ffffff'
  const hoverBg   = darkMode ? 'rgba(59,139,255,0.16)' : '#f1f6ff'
  const dividerC  = darkMode ? 'rgba(255,255,255,0.08)' : '#eef1f8'

  // Filter + group (Active first, phir baaki) — flat list keyboard navigation ke liye
  const { groups, flat } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? campaigns.filter(c => (c.name || '').toLowerCase().includes(q)) : campaigns
    const g = [
      { key: 'active', label: 'Active',          items: list.filter(isActive) },
      { key: 'other',  label: 'Paused & others', items: list.filter(c => !isActive(c)) },
    ].filter(x => x.items.length)
    return { groups: g, flat: g.flatMap(x => x.items) }
  }, [campaigns, query])

  const openPanel = () => {
    const ordered = [...campaigns.filter(isActive), ...campaigns.filter(c => !isActive(c))]
    const idx = ordered.findIndex(c => c.id === selectedCampaign?.id)
    setQuery('')
    setHi(Math.max(0, idx))
    setOpen(true)
  }
  const closePanel = () => setOpen(false)

  const choose = (c) => {
    if (c) onChange(c)
    closePanel()
  }

  // Bahar click / touch pe band (desktop dropdown). Mobile pe overlay ye kaam karta hai.
  useEffect(() => {
    if (!open || isMobile) return
    const onDown = (e) => {
      const inside = (wrapRef.current && wrapRef.current.contains(e.target)) ||
                     (panelRef.current && panelRef.current.contains(e.target))
      if (!inside) closePanel()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open, isMobile])

  // Mobile sheet khula ho to peeche ka page scroll na ho
  useEffect(() => {
    if (!open || !isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, isMobile])

  // Screen resize hone pe (mobile <-> desktop) panel band
  useEffect(() => { setOpen(false) }, [isMobile])

  // Open hone pe search box focus (mobile pe keyboard na khule isliye skip)
  useEffect(() => {
    if (open && !isMobile) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open, isMobile])

  // Highlighted row hamesha visible rahe
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-idx="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi, open, flat])

  const onSearchKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => Math.min(flat.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[hi]) }
    else if (e.key === 'Escape') { e.preventDefault(); closePanel() }
    else if (e.key === 'Tab') closePanel()
  }

  const onTriggerKey = (e) => {
    if (e.key === 'ArrowDown' && !open) { e.preventDefault(); openPanel() }
  }

  const selectedActive = selectedCampaign ? isActive(selectedCampaign) : false

  const dot = (active) => (
    <span style={{
      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
      background: active ? '#22c55e' : '#94a3b8',
      boxShadow: active ? '0 0 0 3px rgba(34,197,94,0.18)' : 'none',
    }} />
  )

  const platformChips = (c) => {
    const keys = getPlatforms(c)
    if (keys.length === 0) return null
    return (
      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {keys.slice(0, 3).map((k, i) => {
          const { Icon, bg, label } = BRANDS[k]
          return (
            <span key={k} title={label} style={{
              width: '20px', height: '20px', borderRadius: '6px', background: bg, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: i === 0 ? 0 : '-5px', border: `2px solid ${panelBg}`, boxSizing: 'content-box',
            }}>
              <Icon size={11} />
            </span>
          )
        })}
      </span>
    )
  }

  /* ── Panel ka andar ka hissa: search + list + footer (desktop aur mobile dono me same) ── */
  const panelBody = (
    <>
      {/* Search */}
      <div style={{ padding: '10px', borderBottom: `1px solid ${dividerC}`, flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: t.inputBg, border: `1px solid ${t.borderColor}`,
          borderRadius: '12px', padding: '0 10px', height: isMobile ? '44px' : '36px',
        }}>
          <Search size={isMobile ? 16 : 14} color={t.textMuted} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setHi(0) }}
            onKeyDown={onSearchKey}
            placeholder="Search campaigns…"
            aria-label="Search campaigns"
            style={{
              flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
              color: t.textPrimary, fontFamily: 'inherit',
              fontSize: isMobile ? '16px' : '12px', // 16px = iOS zoom nahi karega
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => { setQuery(''); setHi(0); inputRef.current?.focus() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', color: t.textMuted }}
            >
              <X size={isMobile ? 16 : 14} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div
        ref={listRef}
        className="cs-list"
        role="listbox"
        style={{
          overflowY: 'auto', padding: '6px', flex: isMobile ? 1 : 'none',
          maxHeight: isMobile ? 'none' : '320px', minHeight: 0,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {flat.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '26px 12px', color: t.textMuted, fontSize: '12px' }}>
            Koi campaign nahi mila{query ? ` "${query}" ke liye` : ''}.
          </div>
        ) : (
          groups.map(g => (
            <div key={g.key} style={{ marginBottom: '4px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px 4px', fontSize: '11px', fontWeight: '600', color: t.textMuted,
              }}>
                <span>{g.label}</span>
                <span>{g.items.length}</span>
              </div>
              {g.items.map(c => {
                const idx = flat.indexOf(c)
                const isSel = c.id === selectedCampaign?.id
                const isHi = !isMobile && idx === hi
                return (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={isSel}
                    data-idx={idx}
                    onMouseEnter={() => setHi(idx)}
                    onClick={() => choose(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: isMobile ? '0 12px' : '9px 10px',
                      minHeight: isMobile ? '48px' : 'auto', // bada tap target
                      borderRadius: '10px', cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      background: isHi ? hoverBg : isSel ? t.accentLight : 'transparent',
                    }}
                  >
                    {dot(isActive(c))}
                    <span
                      title={c.name}
                      style={{
                        flex: 1, minWidth: 0, fontSize: isMobile ? '14px' : '12.5px', color: t.textPrimary,
                        fontWeight: isSel ? '700' : '500',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name}
                    </span>
                    {platformChips(c)}
                    {isSel
                      ? <Check size={16} color={t.accent} style={{ flexShrink: 0 }} />
                      : <span style={{ width: '16px', flexShrink: 0 }} />}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px', borderTop: `1px solid ${dividerC}`, fontSize: '11px', color: t.textMuted,
        display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
        paddingBottom: isMobile ? 'calc(10px + env(safe-area-inset-bottom, 0px))' : '8px',
      }}>
        <Megaphone size={12} />
        {flat.length} of {campaigns.length} campaigns
      </div>
    </>
  )

  /* ── Mobile: bottom sheet (portal se body me, taaki kisi parent ka overflow/blur isse na kaate) ── */
  const mobileSheet = open && isMobile && createPortal(
    <div style={{ fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      <div
        className="cs-overlay"
        onClick={closePanel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
      />
      <div
        ref={panelRef}
        className="cs-sheet"
        role="dialog"
        aria-label="Select campaign"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
          height: '75dvh', maxHeight: '85dvh',
          display: 'flex', flexDirection: 'column',
          background: panelBg, color: t.textPrimary,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Handle + title + close */}
        <div style={{ flexShrink: 0, padding: '8px 14px 4px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '4px', background: dividerC, margin: '0 auto 10px', filter: 'brightness(0.85)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '15px', fontWeight: '800', color: t.textPrimary }}>Select campaign</span>
            <button
              type="button"
              aria-label="Close"
              onClick={closePanel}
              style={{
                background: t.inputBg, border: `1px solid ${t.borderColor}`, borderRadius: '10px',
                width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: t.textSecondary, cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {panelBody}
      </div>
    </div>,
    document.body
  )

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <SelectStyles />

      {/* Trigger */}
      <button
        type="button"
        className="cs-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={onTriggerKey}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          width: isMobile ? '100%' : 'auto',
          justifyContent: isMobile ? 'space-between' : 'flex-start',
          boxSizing: 'border-box',
          background: t.inputBg, color: t.textPrimary,
          border: `1.5px solid ${open ? t.accent : t.borderColor}`,
          boxShadow: open ? '0 0 0 3px rgba(43,127,255,0.15)' : 'none',
          borderRadius: '20px', padding: isMobile ? '9px 12px 9px 14px' : '7px 12px 7px 14px',
          minHeight: isMobile ? '38px' : 'auto',
          fontSize: '12px', fontWeight: '700', fontFamily: 'inherit',
          cursor: 'pointer', maxWidth: isMobile ? '100%' : '240px', transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {selectedCampaign && dot(selectedActive)}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {selectedCampaign?.name || 'Select campaign'}
          </span>
        </span>
        <ChevronDown
          size={14}
          color={t.accent}
          style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {/* Desktop dropdown */}
      {open && !isMobile && (
        <div
          ref={panelRef}
          className="cs-panel"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 60,
            width: 'min(360px, calc(100vw - 28px))',
            background: panelBg, border: `1px solid ${t.borderColor}`, borderRadius: '16px',
            boxShadow: darkMode ? '0 16px 40px rgba(0,0,0,0.5)' : '0 16px 40px rgba(15,23,42,0.14)',
            overflow: 'hidden',
          }}
        >
          {panelBody}
        </div>
      )}

      {mobileSheet}
    </div>
  )
}

export default CampaignSelect