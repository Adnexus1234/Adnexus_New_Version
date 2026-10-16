import React, { useState, useEffect } from 'react'
import Sidebar, { LIGHT, DARK } from './Sidebar'
import { getDesignTemplates } from '../services/api'
import {
  Search, Landmark, Building2, Factory, ShoppingCart, Laptop,
  Stethoscope, GraduationCap, Store, UtensilsCrossed, Truck, Lock,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const INDUSTRIES = [
  { id: 'financial_services',   label: 'Financial Services',         icon: Landmark,        available: true },
  { id: 'real_estate',          label: 'Real Estate & Construction', icon: Building2,       available: true },
  { id: 'manufacturing',        label: 'Manufacturing',              icon: Factory,         available: true },
  { id: 'trading_distribution', label: 'Trading & Distribution',     icon: ShoppingCart,    available: true },
  { id: 'it_technology',        label: 'IT & Technology',            icon: Laptop,          available: true },
  { id: 'healthcare_pharma',    label: 'Healthcare & Pharma',        icon: Stethoscope,     available: true },
  { id: 'education_edtech',     label: 'Education & Edtech',         icon: GraduationCap,   available: true },
  { id: 'retail',               label: 'Retail',                     icon: Store,           available: true },
  { id: 'food_beverage',        label: 'Food & Beverage',            icon: UtensilsCrossed, available: true },
  { id: 'logistics_transport',  label: 'Logistics & Transport',      icon: Truck,           available: true },
]

// Screen size track karne ke liye hook
const useIsMobile = (breakpoint = 768) => {
  const get = () => typeof window !== 'undefined' && window.matchMedia(`(max-width:${breakpoint}px)`).matches
  const [isMobile, setIsMobile] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`)
    const handler = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

const DesignsStyles = () => (
  <style>{`
    .tpl-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    @media (hover: hover) {
      .tpl-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(43,127,255,0.16); }
    }
    .tpl-card:active { transform: scale(0.98); }
    .tpl-strip::-webkit-scrollbar { height: 6px; }
    .tpl-strip::-webkit-scrollbar-track { background: transparent; }
    .tpl-strip::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 9999px; }
  `}</style>
)

const Designs = () => {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [darkMode, setDarkMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [templatesByIndustry, setTemplatesByIndustry] = useState({})
  const [loadingMap, setLoadingMap] = useState({})   // har industry ka apna loading state
  const t = darkMode ? DARK : LIGHT

  const filteredIndustries = INDUSTRIES.filter(ind =>
    ind.label.toLowerCase().includes(search.toLowerCase())
  )

  // Available industries ke templates load karo, page load hote hi — expand karne ke liye click ki zaroorat nahi
  useEffect(() => {
    INDUSTRIES.filter(ind => ind.available).forEach(ind => {
      setLoadingMap(prev => ({ ...prev, [ind.id]: true }))
      getDesignTemplates(ind.id)
        .then(res => setTemplatesByIndustry(prev => ({ ...prev, [ind.id]: res.data || [] })))
        .catch(err => {
          console.error('Templates load nahi hue!', err)
          setTemplatesByIndustry(prev => ({ ...prev, [ind.id]: [] }))
        })
        .finally(() => setLoadingMap(prev => ({ ...prev, [ind.id]: false })))
    })
  }, [])

  const handleTemplateClick = (template) => navigate(`/dashboard/designs/${template.id}`)

  const pad = isMobile ? 14 : 18

  const wrap      = { display:'flex', height:'100dvh', background: t.pageBg, fontFamily:"'Inter',system-ui,-apple-system,sans-serif", fontSize:'13px' }
  const mainCol   = { flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }
  const content   = { flex:1, overflow:'auto', padding: isMobile ? '14px' : '24px', display:'flex', flexDirection:'column', gap: isMobile ? '14px' : '18px' }
  const pageTitle = { fontSize: isMobile ? '19px' : '21px', fontWeight:'800', color: t.textPrimary, letterSpacing:'-0.3px' }
  const pageSub   = { fontSize:'12px', color: t.textSecondary, marginTop:'4px' }

  const searchBox = {
    display:'flex', alignItems:'center', gap:'8px',
    background: t.inputBg, border:`1.5px solid ${t.borderColor}`, borderRadius:'12px',
    padding:'10px 14px', width:'100%', maxWidth: isMobile ? '100%' : '360px', boxSizing:'border-box',
  }
  const searchInput = {
    border:'none', outline:'none', background:'transparent',
    fontSize: isMobile ? '16px' : '13px', // 16px = iOS zoom nahi karega
    color: t.textPrimary, fontFamily:'inherit', width:'100%', minWidth:0,
  }

  const listCard = { background: t.cardBg, border: t.border, borderRadius: isMobile ? '12px' : '16px', overflow:'hidden', width:'100%', flexShrink:0 }
  const itemBase = {
    display:'flex', alignItems:'center', gap:'12px', padding: isMobile ? '12px 14px' : '14px 18px',
    borderBottom:`1px solid ${t.borderColor}`,
  }
  const iconBox = {
    width:'36px', height:'36px', borderRadius:'10px', background: t.chipBg, color: t.chipColor,
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
  }
  const labelStyle = { fontSize:'13px', fontWeight:'600', color: t.textPrimary, flex:1, minWidth:0 }
  const comingSoonBadge = {
    fontSize:'10px', fontWeight:'700', color: t.textMuted, background: t.tableHeadBg,
    border:`1px solid ${t.borderColor}`, borderRadius:'20px', padding:'3px 10px',
    display:'flex', alignItems:'center', gap:'4px', flexShrink:0,
  }

  /* ── Template cards: sab ek hi size ke, image poori dikhegi (cut nahi hogi) ── */
  const templateStrip = {
    display:'flex', alignItems:'flex-start', gap: isMobile ? '12px' : '16px', overflowX:'auto',
    padding:`0 ${pad}px ${pad}px`,
    scrollbarWidth:'thin', scrollbarColor:`${t.borderColor} transparent`,
    scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch',
    scrollPaddingLeft:`${pad}px`, scrollPaddingRight:`${pad}px`,
  }
  const templateCard = {
    background: t.cardBg, border: t.border, borderRadius:'12px', overflow:'hidden', cursor:'pointer',
    flex: isMobile ? '0 0 72%' : '0 0 260px',   // fixed width: koi card stretch ya shrink nahi hoga
    maxWidth: isMobile ? '280px' : '260px',
    scrollSnapAlign:'start',
  }
  const templateImgBox = {
    position:'relative', overflow:'hidden',
    width:'100%', aspectRatio:'3 / 2',            // sab images ka frame same
    background: t.inputBg,
  }
  // Peeche wahi image blur karke fill — khali patti nahi dikhti
  const templateImgBlur = {
    position:'absolute', inset:0, width:'100%', height:'100%',
    objectFit:'cover', filter:'blur(16px) saturate(1.1)', transform:'scale(1.2)', opacity:0.65,
  }
  // Aage poori image, bina cut kiye
  const templateImg = {
    position:'relative', width:'100%', height:'100%',
    objectFit:'contain', objectPosition:'center', display:'block',
  }
  const templateName = {
    padding:'10px 12px', fontSize:'13px', fontWeight:'600', color: t.textPrimary,
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
    borderTop:`1px solid ${t.borderColor}`,
  }
  const statusText = { padding:`0 ${pad}px 16px`, fontSize:'12px', color: t.textMuted }

  return (
    <div style={wrap}>
      <DesignsStyles />
      <Sidebar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />
      <div style={mainCol}>
        <div style={content}>
          <div>
            <div style={pageTitle}>Designs</div>
            <div style={pageSub}>Browse ready-made social media templates by industry.</div>
          </div>

          <div style={searchBox}>
            <Search size={16} color={t.textMuted} style={{ flexShrink:0 }} />
            <input
              style={searchInput}
              placeholder="Search industry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={listCard}>
            {filteredIndustries.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', fontSize:'12px', color: t.textMuted }}>
                No industry found.
              </div>
            ) : (
              filteredIndustries.map((industry, i) => {
                const Icon = industry.icon
                const templates = templatesByIndustry[industry.id] || []
                const isLoading = loadingMap[industry.id]
                const isLast = i === filteredIndustries.length - 1
                return (
                  <div key={industry.id} style={{ borderBottom: isLast ? 'none' : `1px solid ${t.borderColor}` }}>
                    <div style={{ ...itemBase, borderBottom: 'none', opacity: industry.available ? 1 : 0.6 }}>
                      <div style={iconBox}><Icon size={17} /></div>
                      <span style={labelStyle}>{industry.label}</span>
                      {!industry.available && (
                        <span style={comingSoonBadge}><Lock size={10} /> Coming soon</span>
                      )}
                    </div>

                    {industry.available && (
                      isLoading ? (
                        <div style={statusText}>Loading templates...</div>
                      ) : templates.length === 0 ? (
                        <div style={statusText}>No templates yet.</div>
                      ) : (
                        <div className="tpl-strip" style={templateStrip}>
                          {templates.map(template => (
                            <div
                              key={template.id}
                              className="tpl-card"
                              style={templateCard}
                              onClick={() => handleTemplateClick(template)}
                            >
                              <div style={templateImgBox}>
                                <img src={template.background_image_url} alt="" aria-hidden="true" style={templateImgBlur} loading="lazy" decoding="async" />
                                <img
                                  src={template.background_image_url}
                                  alt={template.name}
                                  style={templateImg}
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                              <div style={templateName} title={template.name}>{template.name}</div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Designs