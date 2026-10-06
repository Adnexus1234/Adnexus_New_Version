import React, { useState } from 'react'
import { Users } from 'lucide-react'

// Age group -> color (same order as reference design)
const AGE_COLORS = {
  '18-24':        '#8b5cf6',
  '25-34':        '#2b7fff',
  '35-44':        '#06b6d4',
  '45-54':        '#22c55e',
  '55-64':        '#f59e0b',
  '65+':          '#ec4899',
  'Undetermined': '#94a3b8',
}

const SIZE = 190
const CENTER = SIZE / 2
const RADIUS = 72
const STROKE = 28
const CIRC = 2 * Math.PI * RADIUS

const METRICS = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks',      label: 'Clicks' },
]

const AgeDistributionCard = ({ ageStats, t, darkMode }) => {
  console.log('ageStats received:', ageStats)
  const [metric, setMetric] = useState('impressions')

  const cardStyle = {
    background: t.cardBg,
    border: t.border,
    borderRadius: '20px',
    padding: '22px',
    ...(darkMode ? { backdropFilter: 'blur(16px)' } : { boxShadow: t.shadow }),
  }
  const titleStyle = {
    fontSize: '11px', fontWeight: '700', color: t.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    display: 'flex', alignItems: 'center', gap: '6px',
  }

  const buckets = ageStats?.buckets || []
  const total = buckets.reduce((s, b) => s + (b[metric] || 0), 0)

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
      <div style={titleStyle}><Users size={13} /> Age Distribution</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {METRICS.map(m => {
          const active = metric === m.key
          return (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                cursor: 'pointer', fontFamily: 'inherit',
                background: active ? t.accentLight : 'transparent',
                color: active ? t.accent : t.textSecondary,
                border: `1px solid ${active ? t.accentBorder : t.borderColor}`,
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  if (total === 0) {
    return (
      <div style={cardStyle}>
        {header}
        <div style={{ textAlign: 'center', padding: '24px 10px', color: t.emptyColor, fontSize: '13px' }}>
          No age-wise data yet. It appears once your ads start getting {metric}.
        </div>
      </div>
    )
  }

  const rows = buckets.map(b => {
    const value = b[metric] || 0
    return { age_group: b.age_group, value, pct: (value / total) * 100 }
  })

  // Donut segments (only non-zero)
  let acc = 0
  const segments = rows.filter(r => r.value > 0).map(r => {
    const len = (r.value / total) * CIRC
    const seg = { ...r, len, offset: acc }
    acc += len
    return seg
  })

  const ranked = [...rows].filter(r => r.value > 0).sort((a, b) => b.value - a.value)
  const top = ranked[0]
  const second = ranked[1]
  const topTwoPct = ranked.slice(0, 2).reduce((s, r) => s + r.pct, 0)

  const summary = [
    top    && { label: 'Largest segment', big: `${top.pct.toFixed(1)}%`,    small: top.age_group },
    second && { label: 'Next largest',    big: `${second.pct.toFixed(1)}%`, small: second.age_group },
    ranked.length > 1 && { label: 'Top two groups', big: `${topTwoPct.toFixed(1)}%`, small: `${top.age_group} + ${second.age_group}` },
  ].filter(Boolean)

  return (
    <div style={cardStyle}>
      {header}

      <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        {/* Donut */}
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }} role="img" aria-label="Age distribution pie chart">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={t.borderColor} strokeWidth={STROKE} />
          {segments.map(s => (
            <circle
              key={s.age_group}
              cx={CENTER} cy={CENTER} r={RADIUS}
              fill="none"
              stroke={AGE_COLORS[s.age_group] || '#94a3b8'}
              strokeWidth={STROKE}
              strokeDasharray={`${s.len} ${CIRC - s.len}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          ))}
          <text x={CENTER} y={CENTER - 2} textAnchor="middle" fontSize="20" fontWeight="800" fill={t.textPrimary}>
            {total.toLocaleString()}
          </text>
          <text x={CENTER} y={CENTER + 16} textAnchor="middle" fontSize="10" fill={t.textSecondary}>
            Total {metric}
          </text>
        </svg>

        {/* Bars */}
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          {rows.map(r => (
            <div key={r.age_group} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: AGE_COLORS[r.age_group], flexShrink: 0 }} />
              <span style={{ width: '82px', fontSize: '12px', fontWeight: '600', color: t.textPrimary, flexShrink: 0 }}>{r.age_group}</span>
              <div style={{ flex: 1, height: '8px', borderRadius: '8px', background: t.inputBg, overflow: 'hidden', minWidth: '40px' }}>
                <div style={{ width: `${r.pct}%`, height: '100%', borderRadius: '8px', background: AGE_COLORS[r.age_group] }} />
              </div>
              <span style={{ width: '58px', textAlign: 'right', fontSize: '12px', color: t.textPrimary, fontWeight: '600', flexShrink: 0 }}>
                {r.value.toLocaleString()}
              </span>
              <span style={{ width: '46px', textAlign: 'right', fontSize: '11px', color: t.textSecondary, flexShrink: 0 }}>
                {r.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Highlights */}
      {summary.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${summary.length}, 1fr)`, gap: '10px', marginTop: '18px' }}>
          {summary.map((s, i) => (
            <div key={i} style={{ background: t.inputBg, border: t.border, borderRadius: '12px', padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: t.textPrimary }}>{s.big}</div>
              <div style={{ fontSize: '11px', color: t.textSecondary, marginTop: '2px' }}>{s.label}</div>
              <div style={{ fontSize: '10px', color: t.textMuted }}>{s.small}</div>
            </div>
          ))}
        </div>
      )}

      {ageStats?.sources?.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '10px', color: t.textMuted, textAlign: 'right' }}>
          Data from {ageStats.sources.join(' + ')}
        </div>
      )}
    </div>
  )
}

export default AgeDistributionCard