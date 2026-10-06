import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Lock, ArrowLeft, ClipboardList, Wallet, MapPin, Palette, CircleCheck } from 'lucide-react'
import { SiGoogleads, SiMeta, SiInstagram } from 'react-icons/si'
import { getCampaignDetail, updateCampaign, updateAdContent, placesAutocomplete, placesDetails } from '../services/api'

const GOAL_OPTIONS = ['LEAD_GEN', 'BRAND_AWARENESS', 'WEBSITE_TRAFFIC', 'DIRECT_CONTACT']
const STATUS_OPTIONS = ['active', 'paused']

// ── Consistent lock note text — same one line everywhere on this page ──
const LOCK_TEXT = "Can't be changed after launch"

// ── Same platform-brand tokens as Dashboard.jsx, so campaign chips
//    look identical wherever they appear across the app ──
const PLATFORM_BRAND = {
  google: { Icon: SiGoogleads, bg: '#4285F4', label: 'Google Ads' },
  meta:   { Icon: SiMeta,      bg: '#0866FF', label: 'Facebook' },
  instagram: { Icon: SiInstagram, bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', label: 'Instagram' },
}

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *::-webkit-scrollbar{display:none}
    *{scrollbar-width:none;-ms-overflow-style:none}
    .ec-input:focus, .ec-select:focus {
      border-color: #2b7fff !important;
      box-shadow: 0 0 0 3px rgba(43,127,255,0.12) !important;
    }
    .ec-save-btn:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); }
    .ec-save-btn:active:not(:disabled) { transform: translateY(0); }
    .ec-card { transition: box-shadow 0.2s ease; }
    .ec-city-remove:hover { background: rgba(43,127,255,0.28) !important; }
  `}</style>
)

const styles = {
  page: {
    maxWidth: '900px', margin: '0 auto', padding: '32px 24px 100px',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    background: '#f0f4ff', minHeight: '100vh',
  },
  headerRow: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', background: '#fff',
    border: '1px solid #e4e9f5', borderRadius: '10px', padding: '9px 16px',
    cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#0f172a',
    fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  title: { fontSize: '25px', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.4px' },

  hero: {
    background: 'linear-gradient(135deg,#182347 0%,#2b5fd9 100%)',
    borderRadius: '20px', padding: '22px 26px', marginBottom: '22px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '14px',
    boxShadow: '0 10px 30px rgba(43,95,217,0.28)',
  },
  heroName: { fontSize: '17px', fontWeight: 800, color: '#fff', marginBottom: '6px' },
  heroSub: { fontSize: '12px', color: 'rgba(255,255,255,0.65)' },
  heroChips: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  platformChip: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px 6px 8px',
    borderRadius: '20px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)',
  },
  platformChipIcon: { width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 },
  platformChipText: { fontSize: '11.5px', fontWeight: 700, color: '#fff' },
  statusPill: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
    borderRadius: '20px', background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(74,222,128,0.4)',
    fontSize: '11.5px', fontWeight: 800, color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.04em',
  },

  card: {
    background: '#fff', border: '1px solid #e4e9f5', borderRadius: '20px',
    padding: '26px 28px', marginBottom: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
  cardIconWrap: {
    width: '40px', height: '40px', borderRadius: '13px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardTitleWrap: { display: 'flex', flexDirection: 'column' },
  cardTitle: { fontSize: '15.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' },
  cardDesc: { fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' },

  row: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  field: { flex: '1 1 220px', marginBottom: '18px' },
  label: {
    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
    fontWeight: 700, color: '#334155', marginBottom: '8px',
  },

  input: {
    width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #e4e9f5',
    fontSize: '13px', color: '#0f172a', boxSizing: 'border-box', fontFamily: 'inherit',
    outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s', background: '#fff',
  },
  select: {
    width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #e4e9f5',
    fontSize: '13px', boxSizing: 'border-box', background: '#fff', color: '#0f172a',
    fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
  },
  inputLocked: { background: '#f8faff', color: '#94a3b8', cursor: 'not-allowed', borderColor: '#eef1f8' },

  lockBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#94a3b8',
    background: '#f1f5f9', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
  },
  lockNote: {
    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px',
    color: '#94a3b8', marginTop: '7px', fontWeight: 500,
  },

  cityChip: {
    display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700,
    color: '#2b7fff', background: '#eaf2ff', border: '1px solid #bfdbfe',
    padding: '6px 8px 6px 12px', borderRadius: '20px',
  },
  cityChipRemove: {
    cursor: 'pointer', width: '17px', height: '17px', borderRadius: '50%',
    background: 'rgba(43,127,255,0.15)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '10px', transition: 'background 0.15s',
  },

  cityDropdown: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
    background: '#fff', border: '1px solid #e4e9f5', borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 10,
    maxHeight: '220px', overflowY: 'auto',
  },
  cityDropdownItem: {
    padding: '10px 14px', fontSize: '13px', color: '#0f172a',
    cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
  },
  cityDropdownSecondary: { color: '#94a3b8', fontWeight: 400 },

  adCard: {
    border: '1px solid #eceef4', borderRadius: '14px', padding: '18px',
    marginBottom: '14px', background: 'linear-gradient(180deg,#fafbff 0%,#f7f9ff 100%)',
  },
  adCardHeader: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: '#7c3aed', marginBottom: '14px' },
  adCardIcon: { width: '22px', height: '22px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 },

  infoNote: {
    display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: '12px',
    color: '#6d28d9', background: 'linear-gradient(135deg,#faf5ff,#f3e8ff)', border: '1px solid #ddd6fe',
    borderRadius: '12px', padding: '12px 16px', marginBottom: '18px', fontWeight: 500,
    lineHeight: '1.55',
  },

  saveBar: {
    position: 'sticky', bottom: '18px', background: '#fff', border: '1px solid #e4e9f5',
    borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end',
    alignItems: 'center', gap: '12px', boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
  },
  saveHint: { fontSize: '11.5px', color: '#94a3b8', marginRight: 'auto', fontWeight: 500 },
  btnPrimary: {
    background: 'linear-gradient(135deg,#2b7fff,#1668f5)', color: '#fff', border: 'none',
    borderRadius: '11px', padding: '12px 26px', fontSize: '13.5px', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(43,127,255,0.4)',
    transition: 'filter 0.15s, transform 0.15s',
  },
  btnSecondary: {
    background: '#fff', color: '#64748b', border: '1.5px solid #e4e9f5', borderRadius: '11px',
    padding: '12px 26px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },

  banner: { display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', borderRadius: '12px', fontSize: '13px', marginBottom: '18px', fontWeight: 600 },
  errorBanner: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  successBanner: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
}

const CARD_THEMES = {
  basic:     { bg: 'linear-gradient(135deg,#dbeafe,#eff6ff)', color: '#2563eb' },
  budget:    { bg: 'linear-gradient(135deg,#bbf7d0,#f0fdf4)', color: '#16a34a' },
  targeting: { bg: 'linear-gradient(135deg,#fecdd3,#fff1f2)', color: '#e11d48' },
  ad:        { bg: 'linear-gradient(135deg,#e9d5ff,#faf5ff)', color: '#7c3aed' },
}

const CardHeader = ({ icon, theme, title, desc }) => (
  <div style={styles.cardHeader}>
    <div style={{ ...styles.cardIconWrap, background: CARD_THEMES[theme].bg }}>
      {React.cloneElement(icon, { size: 19, color: CARD_THEMES[theme].color })}
    </div>
    <div style={styles.cardTitleWrap}>
      <div style={styles.cardTitle}>{title}</div>
      {desc && <div style={styles.cardDesc}>{desc}</div>}
    </div>
  </div>
)

const FieldLabel = ({ text, locked }) => (
  <label style={styles.label}>
    {text}
    {locked && <span style={styles.lockBadge}><Lock size={9} />Locked</span>}
  </label>
)

const LockNote = ({ show, text }) => (
  show ? <div style={styles.lockNote}><Lock size={10} />{text || LOCK_TEXT}</div> : null
)

export default function EditCampaign() {
  const { campaignId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [hasGoogle, setHasGoogle] = useState(false)
  const [hasMeta, setHasMeta] = useState(false)
  const [hasInstagram, setHasInstagram] = useState(false)

  const [form, setForm] = useState({
    name: '', goal: 'LEAD_GEN', industry: '', sub_category: '', business_niche: '',
    budget: 0, start_date: '', end_date: '', status: 'active',
  })

  const [targeting, setTargeting] = useState({
    location_details: [], age_min: 25, age_max: 55, radius_km: 25, audience_mode: 'broad',
  })

  const [cityInput, setCityInput] = useState('')
  const [citySuggestions, setCitySuggestions] = useState([])
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [citySearching, setCitySearching] = useState(false)
  const cityDebounceRef = useRef(null)
  const citySessionTokenRef = useRef(null)   // ← ek search-session ke liye same token

  const getSessionToken = () => {
    if (!citySessionTokenRef.current) {
      citySessionTokenRef.current = crypto.randomUUID()
    }
    return citySessionTokenRef.current
  }

  const [adContents, setAdContents] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await getCampaignDetail(campaignId)
        if (cancelled) return
        const c = res.data

        setForm({
          name: c.name || '', goal: c.goal || 'LEAD_GEN', industry: c.industry || '',
          sub_category: c.sub_category || '', business_niche: c.business_niche || '',
          budget: c.budget || 0, start_date: c.start_date || '', end_date: c.end_date || '',
          status: c.status || 'active',
        })

        setTargeting({
          location_details: c.targeting?.location_details || [],
          age_min:   c.targeting?.age_min   || 25,
          age_max:   c.targeting?.age_max   || 55,
          radius_km: c.targeting?.radius_km || 25,
          audience_mode: c.targeting?.audience_mode || 'broad',
        })

        setAdContents((c.ad_contents || []).map(a => ({ ...a })))

        setHasGoogle(!!c.has_google)
        setHasMeta(!!c.has_meta)
        setHasInstagram(!!c.has_meta && (c.ad_contents || []).some(a => (a.platform_name || '').toLowerCase() === 'instagram'))
      } catch (e) {
        if (!cancelled) setError('Campaign load nahi ho paya.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [campaignId])

  const businessNicheEditable = hasGoogle
  const audienceModeEditable = hasMeta

  const updateAdField = (idx, field, value) => {
    setAdContents(prev => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)))
  }

  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current)
    if (cityInput.trim().length < 2) {
      setCitySuggestions([])
      setShowCityDropdown(false)
      return
    }
    cityDebounceRef.current = setTimeout(async () => {
      try {
        setCitySearching(true)
        const token = getSessionToken()
        const res = await placesAutocomplete(cityInput.trim(), token)
        setCitySuggestions(res.data?.results || [])
        setShowCityDropdown(true)
      } catch (e) {
        setCitySuggestions([])
      } finally {
        setCitySearching(false)
      }
    }, 350)
    return () => clearTimeout(cityDebounceRef.current)
  }, [cityInput])

  const handleSelectCity = async (suggestion) => {
    setShowCityDropdown(false)
    try {
      const token = getSessionToken()
      const res = await placesDetails(suggestion.place_id, token)
      const d = res.data
      const cityName = d.name || suggestion.name

      setTargeting(prev => {
        if (prev.location_details.some(l => l.name.toLowerCase() === cityName.toLowerCase())) {
          return prev
        }
        const isFirstCity = prev.location_details.length === 0
        const suggestedRadius = isFirstCity
          ? Math.min(80, Math.max(5, Math.round(d.area_diagonal_km / 2)))
          : prev.radius_km

        return {
          ...prev,
          radius_km: suggestedRadius,
          location_details: [
            ...prev.location_details,
            { name: cityName, lat: d.lat, lng: d.lng, state: d.state || '' },
          ],
        }
      })
    } catch (e) {
      setError('City add nahi ho paayi, dobara try karo.')
    } finally {
      setCityInput('')
      setCitySuggestions([])
      citySessionTokenRef.current = null
    }
  }

  const removeCity = (name) => {
    setTargeting(prev => ({ ...prev, location_details: prev.location_details.filter(l => l.name !== name) }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        name: form.name,
        goal: form.goal,
        industry: form.industry,
        sub_category: form.sub_category,
        status: form.status,
        end_date: form.end_date,
        budget: Number(form.budget),
      }
      if (businessNicheEditable) payload.business_niche = form.business_niche

      payload.targeting = {
        locations: targeting.location_details.map(l => l.name),
        location_details: targeting.location_details,
        radius_km: targeting.radius_km,
        age_min: targeting.age_min,
        age_max: targeting.age_max,
        audience_mode: targeting.audience_mode,
      }

      const res = await updateCampaign(campaignId, payload)

      for (const ad of adContents) {
        await updateAdContent(campaignId, ad.platform_id, {
          headline:    ad.headline,
          description: ad.description,
          image_url:   ad.image_url,
          cta_button:  ad.cta_button,
        })
      }

      if (res.data?.platform_sync_errors && Object.keys(res.data.platform_sync_errors).length > 0) {
        setError('Saved, but platform sync mein issue: ' + JSON.stringify(res.data.platform_sync_errors))
      } else {
        setSuccess('Campaign update ho gaya — platform pe bhi sync ho gaya!')
        setTimeout(() => navigate(`/dashboard/campaign/${campaignId}`), 1200)
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Update fail ho gaya, dobara try karo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
          <div style={{ width: '30px', height: '30px', border: '3px solid #e4e9f5', borderTopColor: '#2b7fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading campaign…
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <GlobalStyles />

      <div style={styles.headerRow}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> Back
        </button>
        <h1 style={styles.title}>Manage Campaign</h1>
      </div>

      {/* ══ Premium hero strip ══ */}
      <div style={styles.hero}>
        <div>
          <div style={styles.heroName}>{form.name || 'Untitled Campaign'}</div>
          <div style={styles.heroSub}>Editing a live campaign — changes sync to the platforms below</div>
        </div>
        <div style={styles.heroChips}>
          {hasGoogle && (
            <span style={styles.platformChip}>
              <span style={{ ...styles.platformChipIcon, background: PLATFORM_BRAND.google.bg }}><SiGoogleads size={11} /></span>
              <span style={styles.platformChipText}>Google Ads</span>
            </span>
          )}
          {hasMeta && (
            <span style={styles.platformChip}>
              <span style={{ ...styles.platformChipIcon, background: PLATFORM_BRAND.meta.bg }}><SiMeta size={11} /></span>
              <span style={styles.platformChipText}>Facebook</span>
            </span>
          )}
          {hasInstagram && (
            <span style={styles.platformChip}>
              <span style={{ ...styles.platformChipIcon, background: PLATFORM_BRAND.instagram.bg }}><SiInstagram size={11} /></span>
              <span style={styles.platformChipText}>Instagram</span>
            </span>
          )}
          <span style={styles.statusPill}>
            <CircleCheck size={12} />
            {form.status}
          </span>
        </div>
      </div>

      {error && <div style={{ ...styles.banner, ...styles.errorBanner }}>⚠️ {error}</div>}
      {success && <div style={{ ...styles.banner, ...styles.successBanner }}>✅ {success}</div>}

      {/* ══ CARD 1: Basic Info ══ */}
      <div style={styles.card} className="ec-card">
        <CardHeader icon={<ClipboardList />} theme="basic" title="Basic Info" desc="Campaign identity and category" />

        <div style={styles.row}>
          <div style={styles.field}>
            <FieldLabel text="Campaign Name" />
            <input
              className="ec-input"
              style={styles.input}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div style={styles.field}>
            <FieldLabel text="Goal" locked />
            <select className="ec-select" style={{ ...styles.select, ...styles.inputLocked }} value={form.goal} disabled>
              {GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <LockNote show />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <FieldLabel text="Industry" locked />
            <input className="ec-input" style={{ ...styles.input, ...styles.inputLocked }} value={form.industry} disabled />
            <LockNote show />
          </div>
          <div style={styles.field}>
            <FieldLabel text="Sub Category" locked />
            <input className="ec-input" style={{ ...styles.input, ...styles.inputLocked }} value={form.sub_category} disabled />
            <LockNote show />
          </div>
        </div>

        <div style={styles.field}>
          <FieldLabel text="Business Niche / Keywords" locked={!businessNicheEditable} />
          <input
            className="ec-input"
            style={{ ...styles.input, ...(businessNicheEditable ? {} : styles.inputLocked) }}
            value={form.business_niche}
            disabled={!businessNicheEditable}
            onChange={e => setForm({ ...form, business_niche: e.target.value })}
            placeholder="e.g. Working Capital, Machinery Loan"
          />
          <LockNote show={!businessNicheEditable} text="This campaign isn't running on Google Ads" />
        </div>
      </div>

      {/* ══ CARD 2: Budget & Schedule ══ */}
      <div style={styles.card} className="ec-card">
        <CardHeader icon={<Wallet />} theme="budget" title="Budget & Schedule" desc="Spend, timing and campaign status" />

        <div style={styles.row}>
          <div style={styles.field}>
            <FieldLabel text="Daily Budget (₹)" />
            <input
              type="number"
              className="ec-input"
              style={styles.input}
              value={form.budget}
              onChange={e => setForm({ ...form, budget: e.target.value })}
            />
          </div>
          <div style={styles.field}>
            <FieldLabel text="Status" />
            <select
              className="ec-select"
              style={styles.select}
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <FieldLabel text="Start Date" locked />
            <input type="date" className="ec-input" style={{ ...styles.input, ...styles.inputLocked }} value={form.start_date} disabled />
            <LockNote show />
          </div>
          <div style={styles.field}>
            <FieldLabel text="End Date" />
            <input
              type="date"
              className="ec-input"
              style={styles.input}
              value={form.end_date}
              min={form.start_date || undefined}
              onChange={e => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* ══ CARD 3: Targeting ══ */}
      <div style={styles.card} className="ec-card">
        <CardHeader icon={<MapPin />} theme="targeting" title="Targeting" desc="Where and who your ads reach" />

        <div style={styles.field}>
          <FieldLabel text="Target Cities" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {targeting.location_details.map(loc => (
              <span key={loc.name} style={styles.cityChip}>
                📍 {loc.name}
                <span className="ec-city-remove" style={styles.cityChipRemove} onClick={() => removeCity(loc.name)}>✕</span>
              </span>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              className="ec-input"
              style={styles.input}
              placeholder="Search a city to add..."
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              onFocus={() => citySuggestions.length > 0 && setShowCityDropdown(true)}
              onBlur={() => setTimeout(() => setShowCityDropdown(false), 150)}
            />
            {showCityDropdown && (
              <div style={styles.cityDropdown}>
                {citySearching && <div style={styles.cityDropdownItem}>Searching…</div>}
                {!citySearching && citySuggestions.length === 0 && (
                  <div style={styles.cityDropdownItem}>No results</div>
                )}
                {!citySearching && citySuggestions.map(s => (
                  <div
                    key={s.place_id}
                    style={styles.cityDropdownItem}
                    onMouseDown={() => handleSelectCity(s)}
                  >
                    📍 {s.name}
                    {s.secondary_text && <span style={styles.cityDropdownSecondary}>, {s.secondary_text}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <FieldLabel text="Radius (km)" />
            <input
              type="number"
              className="ec-input"
              style={styles.input}
              value={targeting.radius_km}
              onChange={e => setTargeting({ ...targeting, radius_km: Number(e.target.value) })}
            />
          </div>
          <div style={styles.field}>
            <FieldLabel text="Min Age" />
            <input
              type="number"
              className="ec-input"
              style={styles.input}
              value={targeting.age_min}
              onChange={e => setTargeting({ ...targeting, age_min: Number(e.target.value) })}
            />
          </div>
          <div style={styles.field}>
            <FieldLabel text="Max Age" />
            <input
              type="number"
              className="ec-input"
              style={styles.input}
              value={targeting.age_max}
              onChange={e => setTargeting({ ...targeting, age_max: Number(e.target.value) })}
            />
          </div>
        </div>

        <div style={styles.field}>
          <FieldLabel text="Targeting Style" locked={!audienceModeEditable} />
          <select
            className="ec-select"
            style={{ ...styles.select, ...(audienceModeEditable ? {} : styles.inputLocked) }}
            value={targeting.audience_mode}
            disabled={!audienceModeEditable}
            onChange={e => setTargeting({ ...targeting, audience_mode: e.target.value })}
          >
            <option value="broad">Maximum Delivery</option>
            <option value="precise">Precise Targeting</option>
          </select>
          <LockNote show={!audienceModeEditable} text="Only applies to Meta (Facebook/Instagram) campaigns" />
        </div>
      </div>

      {/* ══ CARD 4: Ad Content ══ */}
      {adContents.length > 0 && (
        <div style={styles.card} className="ec-card">
          <CardHeader icon={<Palette />} theme="ad" title="Ad Content" desc="Creative shown to your audience" />

          <div style={styles.infoNote}>
            ℹ️ Saving here publishes a new ad version on the platform — the old ad is paused (Google) or its creative is swapped (Meta), and the new one goes live with these changes.
          </div>

          {adContents.map((ad, idx) => {
            const pName = (ad.platform_name || '').toLowerCase()
            const brand = pName.includes('google') ? PLATFORM_BRAND.google
              : pName.includes('instagram') ? PLATFORM_BRAND.instagram
              : PLATFORM_BRAND.meta
            return (
              <div key={ad.platform_id} style={styles.adCard}>
                <div style={styles.adCardHeader}>
                  <span style={{ ...styles.adCardIcon, background: brand.bg }}><brand.Icon size={12} /></span>
                  {ad.platform_name || 'Ad'}
                </div>

                <div style={styles.field}>
                  <FieldLabel text="Headline" />
                  <input
                    className="ec-input"
                    style={styles.input}
                    value={ad.headline || ''}
                    onChange={e => updateAdField(idx, 'headline', e.target.value)}
                  />
                </div>

                <div style={styles.field}>
                  <FieldLabel text="Description" />
                  <textarea
                    className="ec-input"
                    style={{ ...styles.input, minHeight: '72px', resize: 'vertical' }}
                    value={ad.description || ''}
                    onChange={e => updateAdField(idx, 'description', e.target.value)}
                  />
                </div>

                <div style={styles.row}>
                  <div style={styles.field}>
                    <FieldLabel text="Image URL" />
                    <input
                      className="ec-input"
                      style={styles.input}
                      value={ad.image_url || ''}
                      onChange={e => updateAdField(idx, 'image_url', e.target.value)}
                    />
                  </div>
                  <div style={styles.field}>
                    <FieldLabel text="CTA Button" />
                    <input
                      className="ec-input"
                      style={styles.input}
                      value={ad.cta_button || ''}
                      onChange={e => updateAdField(idx, 'cta_button', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={styles.saveBar}>
        <span style={styles.saveHint}>Changes are pushed live to Google Ads / Meta on save</span>
        <button style={styles.btnSecondary} onClick={() => navigate(-1)} disabled={saving}>Cancel</button>
        <button className="ec-save-btn" style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}