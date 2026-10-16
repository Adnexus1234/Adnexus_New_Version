import React, { useState, useEffect } from 'react'
import { Users } from 'lucide-react'

const BUCKETS = [
  { key: '18-24',        color: '#8b5cf6' },
  { key: '25-34',        color: '#2b7fff' },
  { key: '35-44',        color: '#06b6d4' },
  { key: '45-54',        color: '#22c55e' },
  { key: '55-64',        color: '#f59e0b' },
  { key: '65+',          color: '#ec4899' },
  { key: 'Undetermined', color: '#94a3b8' },
]

const METRICS = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks',      label: 'Clicks' },
]

// "AGE_RANGE_25_34" / "25-34" / "65+" / "AGE_RANGE_65_UP" / "UNKNOWN" -> one of the bucket keys
const bucketOf = (raw) => {
  if (raw == null) return null
  const s = String(raw).toLowerCase().replace(/age[_\s-]*range[_\s-]*/, '').replace(/[_\s]+/g, '-').trim()
  if (/undetermined|unknown/.test(s)) return 'Undetermined'
  if (/^65/.test(s)) return '65+'
  const m = s.match(/^(\d{2})-+(\d{2})$/)
  if (m) {
    const k = `${m[1]}-${m[2]}`
    return BUCKETS.some(b => b.key === k) ? k : null
  }
  return null
}

const num = (v, metric) =>
  typeof v === 'number' ? (metric === 'impressions' ? v : 0) : Number(v?.[metric]) || 0

// Walks age_stats (flat, platform-nested, or array) and sums every platform into one set of buckets
const parseAgeStats = (ageStats) => {
  const acc = {}
  BUCKETS.forEach(b => { acc[b.key] = { impressions: 0, clicks: 0 } })
  const sources = new Set()

  const add = (bucket, v) => {
    acc[bucket].impressions += num(v, 'impressions')
    acc[bucket].clicks += num(v, 'clicks')
  }

  const walk = (node, depth = 0) => {
    if (!node || depth > 3) return
    if (Array.isArray(node)) {
      node.forEach(item => {
        const b = bucketOf(item?.age_range ?? item?.age ?? item?.range ?? item?.label ?? item?.bucket ?? item?.age_group)
        if (b) add(b, item)
        else walk(item, depth + 1)
      })
      return
    }
    if (typeof node !== 'object') return
    Object.entries(node).forEach(([k, v]) => {
      const b = bucketOf(k)
      if (b) {
        add(b, v)
      } else {
        if (/meta|facebook|instagram/i.test(k)) sources.add('Meta')
        else if (/google/i.test(k)) sources.add('Google')
        walk(v, depth + 1)
      }
    })
  }

  walk(ageStats)
  return { acc, sources: [...sources] }
}

const AgeDistributionCard = ({ ageStats, t, darkMode }) => {
  const [metricKey, setMetricKey] = useState('impressions')
  const [hover, setHover] = useState(null)
  const [grown, setGrown] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const { acc, sources } = parseAgeStats(ageStats)
  const segments = BUCKETS.map(b => ({ ...b, value: acc[b.key][metricKey] }))
  const total = segments.reduce((s, g) => s + g.value, 0)
  const withPct = segments.map(g => ({ ...g, frac: total > 0 ? g.value / total : 0 }))
  const metricLabel = METRICS.find(m => m.key === metricKey).label

  // Donut geometry
  const R = 78
  const C = 2 * Math.PI * R
  const GAP = withPct.filter(g => g.value > 0).length > 1 ? 2 : 0
  let acc2 = 0
  const arcs = withPct.map(g => {
    const len = Math.max(0, g.frac * C - GAP)
    const start = acc2
    acc2 += g.frac * C
    return { len, start }
  })

  // Summary tiles
  const ranked = withPct.filter(g => g.value > 0).sort((a, b) => b.value - a.value)
  const first = ranked[0]
  const second = ranked[1]
  const pctText = (f) => `${(f * 100).toFixed(1)}%`
  const tiles = [
    { big: first ? pctText(first.frac) : '—', label: 'Largest segment', sub: first ? first.key : '—' },
    { big: second ? pctText(second.frac) : '—', label: 'Next largest', sub: second ? second.key : '—' },
    {
      big: first ? pctText(first.frac + (second ? second.frac : 0)) : '—',
      label: 'Top two groups',
      sub: first ? (second ? `${first.key} + ${second.key}` : first.key) : '—',
    },
  ]

  const sourceLabel = sources.length ? `Data from ${sources.join(' + ')}` : 'Data from Meta'
  const hovered = hover != null ? withPct[hover] : null

  const card = {
    background: t.cardBg, border: t.border, borderRadius: '20px', padding: '22px',
    ...(darkMode ? { backdropFilter: 'blur(16px)' } : { boxShadow: t.shadow }),
  }

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Users size={14} /> Age Distribution
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {METRICS.map(m => {
          const active = m.key === metricKey
          return (
            <button key={m.key} onClick={() => { setMetricKey(m.key); setHover(null) }}
              style={{
                fontSize: '11px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${active ? t.accentBorder : t.borderColor}`,
                background: active ? t.accentLight : 'transparent',
                color: active ? t.accent : t.textSecondary,
              }}>
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  if (total === 0) {
    return (
      <div style={card}>
        {header}
        <div style={{ textAlign: 'center', padding: '30px', color: t.emptyColor, fontSize: '13px' }}>
          No age-wise data yet.
        </div>
      </div>
    )
  }

  return (
    <div style={card}>
      {header}

      <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap' }}>
        {/* Donut */}
        <svg width="232" height="232" viewBox="0 0 200 200" style={{ flexShrink: 0, margin: '0 auto' }}>
          <g transform="rotate(-90 100 100)">
            <circle cx="100" cy="100" r={R} fill="none" stroke={darkMode ? 'rgba(255,255,255,0.08)' : '#e8f0fe'} strokeWidth="34" />
            {withPct.map((g, i) => g.value > 0 && (
              <circle key={g.key} cx="100" cy="100" r={R} fill="none"
                stroke={g.color}
                strokeDasharray={`${arcs[i].len} ${C - arcs[i].len}`}
                strokeDashoffset={-(arcs[i].start + GAP / 2)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  strokeWidth: hover === i ? 40 : 34,
                  opacity: hover == null || hover === i ? 1 : 0.35,
                  transition: 'stroke-width 0.15s ease, opacity 0.15s ease',
                  cursor: 'pointer',
                }} />
            ))}
          </g>
          {hovered ? (
            <>
              <text x="100" y="92" textAnchor="middle" fontSize="12" fill={t.textSecondary}>{hovered.key}</text>
              <text x="100" y="112" textAnchor="middle" fontSize="20" fontWeight="800" fill={t.textPrimary}>{hovered.value.toLocaleString()}</text>
              <text x="100" y="128" textAnchor="middle" fontSize="11" fill={t.textMuted}>{pctText(hovered.frac)}</text>
            </>
          ) : (
            <>
              <text x="100" y="102" textAnchor="middle" fontSize="22" fontWeight="800" fill={t.textPrimary}>{total.toLocaleString()}</text>
              <text x="100" y="118" textAnchor="middle" fontSize="10" fill={t.textSecondary}>Total {metricKey}</text>
            </>
          )}
        </svg>

        {/* Age rows */}
        <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {withPct.map((g, i) => (
            <div key={g.key}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: t.textPrimary,
                padding: '7px 8px', borderRadius: '10px', cursor: 'default',
                opacity: hover == null || hover === i ? 1 : 0.45,
                background: hover === i ? (darkMode ? 'rgba(255,255,255,0.06)' : '#f3f7ff') : 'transparent',
                transition: 'opacity 0.15s ease, background 0.15s ease',
              }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: g.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, width: '104px', flexShrink: 0 }}>{g.key}</span>
              <div style={{ flex: 1, height: '8px', borderRadius: '20px', background: darkMode ? 'rgba(255,255,255,0.08)' : '#eef3ff', overflow: 'hidden' }}>
                <div style={{
                  width: grown ? `${g.frac * 100}%` : '0%', height: '100%', borderRadius: '20px', background: g.color,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{ fontWeight: 700, width: '56px', textAlign: 'right' }}>{g.value.toLocaleString()}</span>
              <span style={{ color: t.textMuted, width: '46px', textAlign: 'right', fontSize: '12px' }}>{pctText(g.frac)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginTop: '22px' }}>
        {tiles.map(tile => (
          <div key={tile.label} style={{ textAlign: 'center', padding: '14px 8px', borderRadius: '14px', background: t.inputBg, border: t.border, minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: '800', color: t.textPrimary }}>{tile.big}</div>
            <div style={{ fontSize: '12px', color: t.textSecondary, marginTop: '2px' }}>{tile.label}</div>
            <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>{tile.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'right', fontSize: '11px', color: t.textMuted, marginTop: '14px' }}>{sourceLabel}</div>
    </div>
  )
}

export default AgeDistributionCard