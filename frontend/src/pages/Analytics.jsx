 import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCampaigns, getCampaignStats, getLeads } from '../services/api'
import Sidebar, { LIGHT, DARK } from './Sidebar'
import CampaignSelect from './CampaignSelect'
import { Sparkles, Plus } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

const PLATFORM_NAME_MAP = {
  google: 'Google Ads', meta: 'Facebook', instagram: 'Instagram',
  fb: 'Facebook', ig: 'Instagram', linkedin: 'LinkedIn',
}

const fmt = n => {
  if (!n && n !== 0) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
const rupee = n => (n || n === 0 ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—')

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
      suggestions.push(`${r.name}: ${r.clicks} clicks aaye par 0 leads. Landing page ya lead form check karo.`)
    else if (r.impressions >= 1000 && r.ctr != null && r.ctr < 1)
      suggestions.push(`${r.name}: CTR sirf ${r.ctr.toFixed(2)}% hai. Ad creative ya headline badal ke dekho.`)
    else if (r.impressions === 0 && r.spend === 0)
      suggestions.push(`${r.name}: abhi koi impressions nahi. Connection aur ad status check karo.`)
  })
  const withLeads = rows.filter(r => r.leads > 0)
  if (withLeads.length > 0) {
    const best = [...withLeads].sort((a, b) => b.leads - a.leads)[0]
    suggestions.push(`${best.name} ke sabse zyada leads (${best.leads}) hain. Iska budget badhane par vichar karo.`)
  }
  if (withLeads.length >= 2) {
    const cheapest = [...withLeads].sort((a, b) => a.cpl - b.cpl)[0]
    suggestions.push(`${cheapest.name} ka CPL sabse kam hai (${rupee(cheapest.cpl)}). Yahan aur invest karo.`)
  }

  /* ── Styles (Dashboard ke theme tokens ke saath) ── */
  const wrap = { display: 'flex', height: '100vh', background: darkMode ? 'linear-gradient(135deg,#05101f 0%,#091830 50%,#05101f 100%)' : t.pageBg, fontFamily: "'Inter',system-ui,-apple-system,sans-serif", fontSize: '13px' }
  const card = { background: t.cardBg, border: t.border, borderRadius: '20px', padding: '22px 24px', ...(darkMode ? {} : { boxShadow: t.shadow }) }
  const cardTitle = { fontSize: '14px', fontWeight: 800, color: t.textPrimary }
  const cardSub = { fontSize: '11px', color: t.textSecondary, marginTop: '2px' }
  const th = { padding: '10px 14px', textAlign: 'left', color: t.textMuted, fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap', borderBottom: `1px solid ${t.borderColor}` }
  const td = { padding: '12px 14px', color: t.textPrimary, borderTop: `1px solid ${t.borderColor}`, whiteSpace: 'nowrap' }

  const kpis = [
    { label: 'Impressions', value: fmt(total.impressions) },
    { label: 'Clicks', value: total.clicks ? total.clicks.toLocaleString() : '—' },
    { label: 'CTR', value: totalCtr != null ? `${totalCtr.toFixed(2)}%` : '—' },
    { label: 'Spend', value: total.spend ? rupee(total.spend) : '—' },
    { label: 'Leads', value: totalLeads || '—' },
    { label: 'Cost per lead', value: totalCpl != null ? rupee(totalCpl) : '—' },
  ]

  return (
    <div style={wrap}>
      <Sidebar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <header style={{ background: t.topbarBg, borderBottom: t.border, padding: '0 24px', minHeight: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '21px', fontWeight: 800, color: t.textPrimary, letterSpacing: '-0.4px' }}>Analytics</div>
            <div style={{ color: t.textSecondary, fontSize: '12px', marginTop: '2px' }}>Platform-wise performance of your campaign.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CampaignSelect campaigns={campaigns} selectedCampaign={selectedCampaign} onChange={selectCampaign} t={t} darkMode={darkMode} />
            <button
              onClick={() => navigate('/dashboard/create-campaign')}
              style={{ background: 'linear-gradient(135deg,#2b7fff,#1668f5)', color: '#fff', border: 'none', borderRadius: '12px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Plus size={14} /> New campaign
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {loading ? (
            <div style={{ ...card, textAlign: 'center', color: t.textSecondary }}>Loading…</div>
          ) : campaigns.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', color: t.textSecondary }}>Abhi koi campaign nahi hai. Pehle ek campaign banao.</div>
          ) : (
            <>
              {/* Summary numbers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
                {kpis.map(k => (
                  <div key={k.label} style={card}>
                    <div style={{ fontSize: '12px', color: t.textSecondary, fontWeight: 600 }}>{k.label}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: t.textPrimary, marginTop: '8px', letterSpacing: '-0.4px' }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Suggestions */}
              <div style={{ ...card, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', color: '#eff6ff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Sparkles size={16} color="#eff6ff" />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>What to do next</span>
                </div>
                {suggestions.length === 0 ? (
                  <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.6 }}>Suggestions tab aayengi jab platform data available hoga. Platform Performance mein "Refresh Stats" dabao.</p>
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
                  <div style={{ textAlign: 'center', color: t.textSecondary, padding: '20px' }}>Is campaign ka platform data abhi nahi hai.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '640px' }}>
                      <thead>
                        <tr>{['Platform', 'Impressions', 'Clicks', 'CTR', 'CPC', 'Spend', 'Leads', 'CPL'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td style={{ ...td, fontWeight: 700 }}>{r.name}</td>
                            <td style={td}>{fmt(r.impressions)}</td>
                            <td style={td}>{r.clicks || '—'}</td>
                            <td style={td}>{r.ctr != null ? `${r.ctr.toFixed(2)}%` : '—'}</td>
                            <td style={td}>{r.cpc != null ? rupee(r.cpc) : '—'}</td>
                            <td style={{ ...td, fontWeight: 700 }}>{r.spend ? rupee(r.spend) : '—'}</td>
                            <td style={td}>{r.leads || '—'}</td>
                            <td style={td}>{r.cpl != null ? rupee(r.cpl) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Spend split */}
              {rows.length > 0 && maxSpend > 0 && (
                <div style={card}>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={cardTitle}>Spend by platform</div>
                    <div style={cardSub}>Kis platform par kitna kharch hua</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {rows.map((r, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: t.textPrimary, marginBottom: '5px' }}>
                          <span style={{ fontWeight: 600 }}>{r.name}</span>
                          <span>{rupee(r.spend)}</span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '20px', background: darkMode ? 'rgba(255,255,255,0.08)' : '#e8f0fe', overflow: 'hidden' }}>
                          <div style={{ width: `${(r.spend / maxSpend) * 100}%`, height: '100%', background: '#2b7fff', borderRadius: '20px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Analytics