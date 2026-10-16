import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCampaigns, getCampaignStats, getLeads } from '../services/api'
import Sidebar, { LIGHT, DARK } from './Sidebar'
import CampaignSelect from './CampaignSelect'
import { Sparkles, Plus, Eye, MousePointerClick, Percent, IndianRupee, UsersRound, BadgeIndianRupee } from 'lucide-react'
import { SiGoogleads, SiMeta, SiInstagram } from 'react-icons/si'
import { FaLinkedin } from 'react-icons/fa'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

const PLATFORM_NAME_MAP = {
  google: 'Google Ads', meta: 'Facebook', instagram: 'Instagram',
  fb: 'Facebook', ig: 'Instagram', linkedin: 'LinkedIn',
}
const PLATFORM_BRAND = {
  'Google Ads': { Icon: SiGoogleads, bg: '#4285F4' },
  'Facebook':   { Icon: SiMeta,      bg: '#0866FF' },
  'Instagram':  { Icon: SiInstagram, bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' },
  'LinkedIn':   { Icon: FaLinkedin,  bg: '#0A66C2' },
}

const fmt = n => {
  if (!n && n !== 0) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
const rupee = n => (n || n === 0 ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—')

const AnalyticsStyles = () => (
  <style>{`
    .a-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; }
    @media (max-width: 1280px) { .a-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 760px)  { .a-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
    .a-row { transition: background 0.12s ease; }
    .a-row:hover { background: var(--a-row-hover); }
    .a-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    @media (max-width: 900px) { .a-two { grid-template-columns: minmax(0, 1fr); } }
    @keyframes a-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    .a-bar { transform-box: fill-box; transform-origin: bottom; animation: a-grow 0.5s ease-out; }

    /* ───── Header: campaign select + New campaign button kabhi screen se bahar na jaye ───── */
    .a-header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
    .a-new { white-space: nowrap; flex-shrink: 0; }

    @media (max-width: 760px) {
      .a-header {
        flex-direction: column;
        align-items: stretch !important;
        padding: 12px 14px !important;
        gap: 12px !important;
      }
      .a-header-actions {
        width: 100%;
        flex-direction: column;
        align-items: stretch !important;
        gap: 10px !important;
      }
      .a-new {
        width: 100%;
        justify-content: center;
        padding: 11px 18px !important;
        font-size: 13px !important;
      }
      .a-content { padding: 14px !important; gap: 14px !important; }
      .a-content > div:not(.a-kpis),
      .a-two > div { padding: 16px !important; border-radius: 16px !important; }

      /* KPI cards thode compact */
      .a-kpi { padding: 14px 14px 12px !important; border-radius: 16px !important; }
      .a-kpi-icon { width: 34px !important; height: 34px !important; margin-bottom: 10px !important; }
      .a-kpi-label { font-size: 9.5px !important; margin-bottom: 6px !important; }
      .a-kpi-value { font-size: 20px !important; }
    }
  `}</style>
)

const platformColor = (name, idx) => {
  const n = String(name || '').toLowerCase()
  if (n === 'meta' || n === 'facebook' || n === 'fb') return '#0866FF'
  if (n === 'instagram' || n === 'ig') return '#E1306C'
  if (n === 'google' || n === 'google ads') return '#10b981'
  if (n === 'linkedin') return '#f59e0b'
  return ['#a855f7', '#ef4444', '#06b6d4', '#84cc16'][idx % 4]
}

const BAR_METRICS = [
  { key: 'impressions', label: 'Impressions', fmt: fmt },
  { key: 'clicks',      label: 'Clicks',      fmt: v => Number(v).toLocaleString('en-IN') },
  { key: 'leads',       label: 'Leads',       fmt: v => String(v) },
  { key: 'spend',       label: 'Spend',       fmt: rupee },
]

const PlatformCharts = ({ rows, totalSpend, t, darkMode, card, cardTitle, cardSub }) => {
  const [hoverSlice, setHoverSlice] = useState(null)
  const [metricKey, setMetricKey] = useState('clicks')
  const [hoverBar, setHoverBar] = useState(null)

  const colors = rows.map((r, i) => platformColor(r.name, i))

  /* ── Donut ── */
  const R = 70
  const C = 2 * Math.PI * R
  const GAP = rows.filter(r => r.spend > 0).length > 1 ? 3 : 0
  let acc = 0
  const slices = rows.map((r, i) => {
    const frac = totalSpend > 0 ? r.spend / totalSpend : 0
    const len = Math.max(0, frac * C - GAP)
    const start = acc
    acc += frac * C
    return { i, frac, len, start }
  })
  const hovered = hoverSlice != null ? rows[hoverSlice] : null

  /* ── Bars ── */
  const metric = BAR_METRICS.find(m => m.key === metricKey)
  const W = 400, H = 250, padX = 24, top = 44, base = 200
  const plotH = base - top
  const maxV = Math.max(1, ...rows.map(r => r[metric.key] || 0))
  const slot = (W - 2 * padX) / rows.length
  const barW = Math.min(64, slot - 24)

  // Touch pe tap karke select/deselect (mobile pe hover nahi hota)
  const toggleSlice = (i) => setHoverSlice(h => (h === i ? null : i))
  const toggleBar = (i) => setHoverBar(h => (h === i ? null : i))

  return (
    <div className="a-two">
      {/* Left: donut */}
      <div style={card}>
        <div style={{ marginBottom: '14px' }}>
          <div style={cardTitle}>Spend by platform</div>
          <div style={cardSub}>How much was spent on each platform</div>
        </div>
        {totalSpend > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
            <svg width="210" height="210" viewBox="0 0 200 200" style={{ maxWidth: '100%' }}>
              <g transform="rotate(-90 100 100)">
                <circle cx="100" cy="100" r={R} fill="none" stroke={darkMode ? 'rgba(255,255,255,0.08)' : '#e8f0fe'} strokeWidth="32" />
                {slices.map(s => rows[s.i].spend > 0 && (
                  <circle key={s.i} cx="100" cy="100" r={R} fill="none"
                    stroke={colors[s.i]}
                    strokeDasharray={`${s.len} ${C - s.len}`}
                    strokeDashoffset={-(s.start + GAP / 2)}
                    onMouseEnter={() => setHoverSlice(s.i)}
                    onMouseLeave={() => setHoverSlice(null)}
                    onClick={() => toggleSlice(s.i)}
                    style={{
                      strokeWidth: hoverSlice === s.i ? 38 : 32,
                      opacity: hoverSlice == null || hoverSlice === s.i ? 1 : 0.35,
                      transition: 'stroke-width 0.15s ease, opacity 0.15s ease',
                      cursor: 'pointer',
                    }} />
                ))}
              </g>
              {hovered ? (
                <>
                  <text x="100" y="88" textAnchor="middle" fontSize="11" fill={t.textSecondary}>{hovered.name}</text>
                  <text x="100" y="108" textAnchor="middle" fontSize="16" fontWeight="800" fill={t.textPrimary}>{rupee(hovered.spend)}</text>
                  <text x="100" y="124" textAnchor="middle" fontSize="11" fill={t.textMuted}>{(slices[hoverSlice].frac * 100).toFixed(1)}%</text>
                </>
              ) : (
                <>
                  <text x="100" y="96" textAnchor="middle" fontSize="11" fill={t.textSecondary}>Total spend</text>
                  <text x="100" y="116" textAnchor="middle" fontSize="16" fontWeight="800" fill={t.textPrimary}>{rupee(totalSpend)}</text>
                </>
              )}
            </svg>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', maxWidth: '300px' }}>
              {rows.map((r, i) => (
                <div key={i}
                  onMouseEnter={() => setHoverSlice(i)}
                  onMouseLeave={() => setHoverSlice(null)}
                  onClick={() => toggleSlice(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: t.textPrimary, padding: '5px 6px', borderRadius: '8px', cursor: 'pointer', opacity: hoverSlice == null || hoverSlice === i ? 1 : 0.45, background: hoverSlice === i ? (darkMode ? 'rgba(255,255,255,0.06)' : '#f3f7ff') : 'transparent', transition: 'opacity 0.15s ease, background 0.15s ease' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: colors[i], flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ fontWeight: 700 }}>{rupee(r.spend)}</span>
                  <span style={{ color: t.textMuted, width: '46px', textAlign: 'right' }}>{(slices[i].frac * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: t.textSecondary, padding: '40px 0' }}>No spend recorded yet.</div>
        )}
      </div>

      {/* Right: bar chart with metric tabs */}
      <div style={card}>
        <div style={{ marginBottom: '14px' }}>
          <div style={cardTitle}>Platform comparison</div>
          <div style={cardSub}>Pick a metric to compare platforms</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {BAR_METRICS.map(m => {
            const active = m.key === metricKey
            return (
              <button key={m.key} onClick={() => { setMetricKey(m.key); setHoverBar(null) }}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${active ? t.accentBorder : t.borderColor}`,
                  background: active ? t.accentLight : 'transparent',
                  color: active ? t.accent : t.textSecondary,
                }}>
                {m.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: '440px' }}>
            {[0.25, 0.5, 0.75, 1].map(g => (
              <line key={g} x1={padX} x2={W - padX} y1={base - g * plotH} y2={base - g * plotH} stroke={t.borderColor} strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
            ))}
            <line x1={padX} x2={W - padX} y1={base} y2={base} stroke={t.borderColor} strokeWidth="1" />

            {rows.map((r, i) => {
              const v = r[metric.key] || 0
              const h = Math.max(v > 0 ? 3 : 0, (v / maxV) * plotH)
              const cx = padX + slot * i + slot / 2
              const x = cx - barW / 2
              const y = base - h
              return (
                <g key={`${metricKey}-${i}`}
                  onMouseEnter={() => setHoverBar(i)}
                  onMouseLeave={() => setHoverBar(null)}
                  onClick={() => toggleBar(i)}
                  style={{ cursor: 'pointer' }}>
                  <rect x={padX + slot * i} y={top} width={slot} height={plotH} fill="transparent" />
                  {h > 0 && (
                    <rect className="a-bar" x={x} y={y} width={barW} height={h} rx="6" fill={colors[i]}
                      opacity={hoverBar == null || hoverBar === i ? 1 : 0.4} />
                  )}
                  {hoverBar !== i && (
                    <text x={cx} y={y - 7} textAnchor="middle" fontSize="12" fontWeight="700" fill={t.textPrimary}>{metric.fmt(v)}</text>
                  )}
                  <text x={cx} y={base + 22} textAnchor="middle" fontSize="12" fill={t.textSecondary}>{r.name}</text>
                </g>
              )
            })}

            {hoverBar != null && (() => {
              const r = rows[hoverBar]
              const v = r[metric.key] || 0
              const h = Math.max(v > 0 ? 3 : 0, (v / maxV) * plotH)
              const cx = padX + slot * hoverBar + slot / 2
              const tw = 130, th = 40
              const tx = Math.min(Math.max(cx - tw / 2, 4), W - tw - 4)
              const ty = Math.max(2, base - h - th - 8)
              return (
                <g pointerEvents="none">
                  <rect x={tx} y={ty} width={tw} height={th} rx="8" fill={t.cardBg} stroke={t.borderColor} />
                  <text x={tx + tw / 2} y={ty + 16} textAnchor="middle" fontSize="11" fill={t.textSecondary}>{r.name} · {metric.label}</text>
                  <text x={tx + tw / 2} y={ty + 32} textAnchor="middle" fontSize="13" fontWeight="800" fill={t.textPrimary}>{metric.fmt(v)}</text>
                </g>
              )
            })()}
          </svg>
        </div>
      </div>
    </div>
  )
}

const Analytics = () => {
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [platformStats, setPlatformStats] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)

  const t = darkMode ? DARK : LIGHT

  useEffect(() => {
    const init = async () => {
      try {
        const [campRes, leadsRes] = await Promise.all([getCampaigns(), getLeads()])
        const list = campRes.data.campaigns || campRes.data || []
        setCampaigns(list)
        setLeads(leadsRes.data.leads || leadsRes.data || [])
        if (list.length > 0) selectCampaign(list[0])
      } catch (e) {
        console.error('Analytics load failed', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const selectCampaign = async (c) => {
    setSelectedCampaign(c)
    setStatsLoading(true)
    try {
      const res = await getCampaignStats(c.id)
      setPlatformStats(res.data.stats || res.data || [])
    } catch {
      setPlatformStats([])
    }
    // form submissions bhi leads mein jodo (Dashboard jaisa)
    try {
      const r = await fetch(`${API_BASE}/public/submissions/${c.id}`)
      const d = await r.json()
      const forms = (d.submissions || []).map(s => ({ ...s, name: s.full_name, campaign_id: c.id }))
      setLeads(prev => [...prev.filter(l => !(l.__form && String(l.campaign_id) === String(c.id))), ...forms.map(f => ({ ...f, __form: true }))])
    } catch {}
    setStatsLoading(false)
  }

  /* ── Numbers ── */
  const campaignLeads = leads.filter(l => String(l.campaign_id) === String(selectedCampaign?.id))
  const leadsByPlatform = {}
  campaignLeads.forEach(l => {
    const raw = (l.platform_name || l.platform || '').toLowerCase()
    const key = PLATFORM_NAME_MAP[raw] || l.platform_name || l.platform || 'Direct'
    leadsByPlatform[key] = (leadsByPlatform[key] || 0) + 1
  })
  const keyOf = p => {
    const raw = (p.platform_name || p.platform || '').toLowerCase()
    return PLATFORM_NAME_MAP[raw] || p.platform_name || p.platform || 'Direct'
  }

  const rows = platformStats.map(p => {
    const impressions = p.impressions || 0
    const clicks = p.clicks || 0
    const spend = p.spend || 0
    const leadsCount = leadsByPlatform[keyOf(p)] || 0
    return {
      name: p.platform_name || p.platform || 'Platform',
      brandKey: keyOf(p),
      impressions, clicks, spend, leads: leadsCount,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      cpc: clicks > 0 ? spend / clicks : null,
      cpl: leadsCount > 0 ? spend / leadsCount : null,
    }
  })

  const total = rows.reduce((a, r) => ({
    impressions: a.impressions + r.impressions,
    clicks: a.clicks + r.clicks,
    spend: a.spend + r.spend,
  }), { impressions: 0, clicks: 0, spend: 0 })
  const totalLeads = campaignLeads.length
  const totalCtr = total.impressions > 0 ? (total.clicks / total.impressions) * 100 : null
  const totalCpl = totalLeads > 0 ? total.spend / totalLeads : null
  const maxSpend = Math.max(...rows.map(r => r.spend), 0)

  /* ── Suggestions ── */
  const suggestions = []
  rows.forEach(r => {
    if (r.clicks >= 20 && r.leads === 0)
      suggestions.push(`${r.name}: ${r.clicks} clicks but 0 leads. Check your landing page or lead form.`)
    else if (r.impressions >= 1000 && r.ctr != null && r.ctr < 1)
      suggestions.push(`${r.name}: CTR is only ${r.ctr.toFixed(2)}%. Try changing the ad creative or headline.`)
    else if (r.impressions === 0 && r.spend === 0)
      suggestions.push(`${r.name}: no impressions yet. Check the connection and ad status.`)
  })
  const withLeads = rows.filter(r => r.leads > 0)
  if (withLeads.length > 0) {
    const best = [...withLeads].sort((a, b) => b.leads - a.leads)[0]
    suggestions.push(`${best.name} has the most leads (${best.leads}). Consider increasing its budget.`)
  }
  if (withLeads.length >= 2) {
    const cheapest = [...withLeads].sort((a, b) => a.cpl - b.cpl)[0]
    suggestions.push(`${cheapest.name} has the lowest CPL (${rupee(cheapest.cpl)}). Consider investing more here.`)
  }

  /* ── Styles (Dashboard ke theme tokens ke saath) ── */
  const wrap = { display: 'flex', height: '100dvh', background: darkMode ? 'linear-gradient(135deg,#05101f 0%,#091830 50%,#05101f 100%)' : t.pageBg, fontFamily: "'Inter',system-ui,-apple-system,sans-serif", fontSize: '13px' }
  const card = { background: t.cardBg, border: t.border, borderRadius: '20px', padding: '22px 24px', ...(darkMode ? {} : { boxShadow: t.shadow }) }
  const cardTitle = { fontSize: '14px', fontWeight: 800, color: t.textPrimary }
  const cardSub = { fontSize: '11px', color: t.textSecondary, marginTop: '2px' }
  const th = { padding: '10px 14px', textAlign: 'left', color: t.textMuted, fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap', borderBottom: `1px solid ${t.borderColor}` }
  const td = { padding: '12px 14px', color: t.textPrimary, borderTop: `1px solid ${t.borderColor}`, whiteSpace: 'nowrap' }
  const badge = (variant, text) => (
    <span style={{ background: t[variant].bg, color: t[variant].color, border: `1px solid ${t[variant].border}`, padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 600 }}>{text}</span>
  )
  const chipBase = { width: '26px', height: '26px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }
  const accents = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7']
  const tones = [
    { bg: t.kpiSpendBg,  iconBg: t.kpiIconSpend,  color: t.kpiTextSpend,  accent: '#3b82f6' },
    { bg: t.kpiLeadsBg,  iconBg: t.kpiIconLeads,  color: t.kpiTextLeads,  accent: '#10b981' },
    { bg: t.kpiCplBg,    iconBg: t.kpiIconCpl,    color: t.kpiTextCpl,    accent: '#f59e0b' },
    { bg: t.kpiActiveBg, iconBg: t.kpiIconActive, color: t.kpiTextActive, accent: '#a855f7' },
  ]

  const kpis = [
    { label: 'Impressions', value: fmt(total.impressions), Icon: Eye, tone: 3,
      sub: rows.length > 0 ? `across ${rows.length} platform${rows.length > 1 ? 's' : ''}` : null },
    { label: 'Clicks', value: total.clicks ? total.clicks.toLocaleString() : '—', Icon: MousePointerClick, tone: 0,
      sub: total.clicks > 0 ? `CPC ${rupee(total.spend / total.clicks)}` : null },
    { label: 'CTR', value: totalCtr != null ? `${totalCtr.toFixed(2)}%` : '—', Icon: Percent, tone: 2, sub: null },
    { label: 'Spend', value: total.spend ? rupee(total.spend) : '—', Icon: IndianRupee, tone: 0, sub: null },
    { label: 'Leads', value: totalLeads || '—', Icon: UsersRound, tone: 1, sub: null },
    { label: 'Cost per lead', value: totalCpl != null ? rupee(totalCpl) : '—', Icon: BadgeIndianRupee, tone: 2, sub: null },
  ]

  return (
    <div style={wrap}>
      <AnalyticsStyles />
      <Sidebar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <header className="a-header" style={{ background: t.topbarBg, borderBottom: t.border, padding: '0 24px', minHeight: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '21px', fontWeight: 800, color: t.textPrimary, letterSpacing: '-0.4px' }}>Analytics</div>
            <div style={{ color: t.textSecondary, fontSize: '12px', marginTop: '2px' }}>Platform-wise performance of your campaign.</div>
          </div>
          <div className="a-header-actions">
            <CampaignSelect campaigns={campaigns} selectedCampaign={selectedCampaign} onChange={selectCampaign} t={t} darkMode={darkMode} />
            <button
              className="a-new"
              onClick={() => navigate('/dashboard/create-campaign')}
              style={{ background: 'linear-gradient(135deg,#2b7fff,#1668f5)', color: '#fff', border: 'none', borderRadius: '12px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 4px 14px rgba(43,127,255,0.4)' }}
            >
              <Plus size={14} /> New campaign
            </button>
          </div>
        </header>

        <div className="a-content" style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {loading ? (
            <div style={{ ...card, textAlign: 'center', color: t.textSecondary }}>Loading…</div>
          ) : campaigns.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', color: t.textSecondary }}>No campaigns yet. Create a campaign to get started.</div>
          ) : (
            <>
              {/* Summary numbers */}
              <div className="a-kpis">
                {kpis.map(k => {
                  const tone = tones[k.tone]
                  return (
                    <div key={k.label} className="a-kpi" style={{
                      background: tone.bg,
                      border: darkMode ? `1px solid ${tone.accent}22` : `1px solid ${tone.accent}18`,
                      borderRadius: '22px', padding: '22px 22px 20px',
                      boxShadow: darkMode ? 'none' : `0 4px 14px ${tone.accent}12`,
                    }}>
                      <div className="a-kpi-icon" style={{ width: '44px', height: '44px', borderRadius: '14px', background: tone.iconBg, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                        <k.Icon size={20} />
                      </div>
                      <div className="a-kpi-label" style={{ fontSize: '10px', fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px' }}>{k.label}</div>
                      <div className="a-kpi-value" style={{ fontSize: '24px', fontWeight: 800, color: t.textPrimary, lineHeight: 1, letterSpacing: '-0.4px' }}>{k.value}</div>
                      {k.sub && <div style={{ fontSize: '11px', color: t.textSecondary, marginTop: '8px' }}>{k.sub}</div>}
                    </div>
                  )
                })}
              </div>

              {/* Suggestions */}
              <div style={{ ...card, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', color: '#eff6ff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Sparkles size={16} color="#eff6ff" />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>What to do next</span>
                </div>
                {suggestions.length === 0 ? (
                  <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.6 }}>Suggestions will appear once platform data is available. Click "Refresh Stats" under Platform Performance on the dashboard.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
                    {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>

              {/* Platform table */}
              <div style={card}>
                <div style={{ marginBottom: '14px' }}>
                  <div style={cardTitle}>Platform breakdown</div>
                  <div style={cardSub}>{selectedCampaign?.name}</div>
                </div>
                {statsLoading ? (
                  <div style={{ textAlign: 'center', color: t.textSecondary, padding: '20px' }}>Loading stats…</div>
                ) : rows.length === 0 ? (
                  <div style={{ textAlign: 'center', color: t.textSecondary, padding: '20px' }}>No platform data for this campaign yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: '14px', border: `1.5px solid ${t.borderColor}`, boxShadow: darkMode ? 'none' : '0 4px 16px rgba(43,127,255,0.08)', '--a-row-hover': darkMode ? 'rgba(59,139,255,0.14)' : '#eaf2ff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '640px' }}>
                      <thead>
                        <tr>{['Platform', 'Impressions', 'Clicks', 'CTR', 'CPC', 'Spend', 'Leads', 'CPL'].map(h => (
                          <th key={h} style={{ ...th, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: 'none', background: darkMode ? 'rgba(59,139,255,0.1)' : '#eaf2ff', color: darkMode ? '#7bb8ff' : '#1660e8' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const brand = PLATFORM_BRAND[r.brandKey]
                          const accent = accents[i % accents.length]
                          const bt = i === 0 ? 'none' : td.borderTop
                          return (
                            <tr key={i} className="a-row">
                              <td style={{ ...td, borderTop: bt, fontWeight: 700 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                  {brand ? (
                                    <div style={{ ...chipBase, background: brand.bg, color: '#fff', boxShadow: '0 3px 8px rgba(0,0,0,0.15)' }}><brand.Icon size={14} /></div>
                                  ) : (
                                    <div style={{ ...chipBase, background: `linear-gradient(135deg,${accent},${accent}cc)`, color: '#fff', boxShadow: `0 3px 8px ${accent}55` }}>{r.name.charAt(0).toUpperCase()}</div>
                                  )}
                                  <span>{r.name}</span>
                                </div>
                              </td>
                              <td style={{ ...td, borderTop: bt, color: t.textSecondary }}>{fmt(r.impressions)}</td>
                              <td style={{ ...td, borderTop: bt, color: t.textSecondary }}>{r.clicks ? r.clicks.toLocaleString() : '—'}</td>
                              <td style={{ ...td, borderTop: bt, color: t.textSecondary }}>{r.ctr != null ? `${r.ctr.toFixed(2)}%` : '—'}</td>
                              <td style={{ ...td, borderTop: bt, color: t.textSecondary }}>{r.cpc != null ? rupee(r.cpc) : '—'}</td>
                              <td style={{ ...td, borderTop: bt, fontWeight: 700 }}>{r.spend ? rupee(r.spend) : '—'}</td>
                              <td style={{ ...td, borderTop: bt }}>{badge('badgeBlue', r.leads || '—')}</td>
                              <td style={{ ...td, borderTop: bt }}>{badge('badgePurple', r.cpl != null ? rupee(r.cpl) : '—')}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Spend split + platform comparison */}
              {rows.length > 0 && (
                <PlatformCharts
                  rows={rows}
                  totalSpend={total.spend}
                  t={t}
                  darkMode={darkMode}
                  card={card}
                  cardTitle={cardTitle}
                  cardSub={cardSub}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Analytics