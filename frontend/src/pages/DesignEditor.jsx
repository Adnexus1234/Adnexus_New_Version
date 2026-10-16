import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Stage, Layer, Rect, Text, Image as KImage, Group } from 'react-konva'
import useImage from 'use-image'
import { ArrowLeft, Eye, EyeOff, Download } from 'lucide-react'
import Sidebar, { LIGHT, DARK } from './Sidebar'
import { getDesignTemplate } from '../services/api'

const SIZE = 1080       // final export size (px)
const MAX_PREVIEW = 540 // desktop pe preview ka max size

const FIELDS = [
  { key: 'heading',      label: 'Heading' },
  { key: 'subheading',   label: 'Subheading' },
  { key: 'businessName', label: 'Business name' },
  { key: 'cta',          label: 'Button text' },
]

// Screen size track karne ke liye hook
const useMediaQuery = (query) => {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}

const DesignEditor = () => {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const stageRef = useRef(null)
  const canvasWrapRef = useRef(null)

  const isMobile = useMediaQuery('(max-width:768px)')
  const stacked  = useMediaQuery('(max-width:1100px)') // canvas upar, controls neeche

  const [darkMode, setDarkMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const t = darkMode ? DARK : LIGHT

  const [template, setTemplate] = useState(null)
  const [tab, setTab] = useState('text')
  const [values, setValues] = useState({})
  const [hidden, setHidden] = useState({})
  const [logoSrc, setLogoSrc] = useState(null)
  const [bgColor, setBgColor] = useState('#f0ead6')
  const [textColor, setTextColor] = useState('#1a1a2e')
  const [preview, setPreview] = useState(MAX_PREVIEW) // screen pe dikhne wala canvas size

  useEffect(() => {
    getDesignTemplate(templateId)
      .then(res => {
        const d = res.data
        setTemplate(d)
        setValues({
          heading: d.heading_default,
          subheading: d.subheading_default,
          businessName: 'Your Business Name',
          cta: d.cta_default,
        })
        setBgColor(d.theme_bg_color)
        setTextColor(d.theme_text_color)
      })
      .catch(err => console.error('Template load nahi hua!', err))
  }, [templateId])

  // Canvas ko available width ke hisaab se chhota/bada karo (square rehta hai)
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const update = () => {
      const w = Math.floor(el.clientWidth - 2) // 2px = border
      if (w > 0) setPreview(Math.min(MAX_PREVIEW, w))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [template, stacked])

  // 'anonymous' is needed so the canvas can be exported (Cloudinary allows CORS)
  const [bgImg] = useImage(template?.background_image_url, 'anonymous')
  const [logoImg] = useImage(logoSrc)

  // "cover" crop so a non-square background still fills the 1080x1080 canvas
  let bgCrop
  if (bgImg) {
    const r = Math.max(SIZE / bgImg.width, SIZE / bgImg.height)
    const w = SIZE / r
    const h = SIZE / r
    bgCrop = { x: (bgImg.width - w) / 2, y: (bgImg.height - h) / 2, width: w, height: h }
  }
  const logoScale = logoImg ? Math.min(100 / logoImg.width, 100 / logoImg.height) : 1

  const onLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoSrc(reader.result)
    reader.readAsDataURL(file)
  }

  const download = () => {
    // preview chhota ho ya bada, export hamesha 1080x1080 hi hoga
    const uri = stageRef.current.toDataURL({ pixelRatio: SIZE / preview })
    const a = document.createElement('a')
    a.href = uri
    a.download = `${template.name.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  const wrap     = { display:'flex', height:'100dvh', background: t.pageBg, fontFamily:"'Inter',system-ui,-apple-system,sans-serif", fontSize:'13px' }
  const content  = { flex:1, overflow:'auto', padding: isMobile ? '14px' : '24px', display:'flex', flexDirection:'column', gap: isMobile ? '14px' : '18px', minWidth:0 }
  const backBtn  = { display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', color: t.accent, fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', padding: isMobile ? '6px 0' : 0, alignSelf:'flex-start' }
  const layout   = { display:'flex', flexDirection: stacked ? 'column' : 'row', gap: isMobile ? '16px' : '24px', alignItems: stacked ? 'stretch' : 'flex-start' }
  const canvasWrap = { width:'100%', maxWidth:`${MAX_PREVIEW + 2}px`, flexShrink:0 }
  const canvasBox  = { borderRadius:'12px', overflow:'hidden', border: t.border, lineHeight:0, width:'fit-content' }
  const panel    = { width: stacked ? '100%' : '340px', maxWidth: stacked && !isMobile ? `${MAX_PREVIEW + 2}px` : '100%', boxSizing:'border-box', background: t.cardBg, border: t.border, borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '14px' : '18px', alignSelf: stacked ? 'stretch' : 'flex-start' }
  const tabBtn   = (active) => ({ flex:1, padding: isMobile ? '12px 8px' : '8px', border:'none', borderBottom:`2px solid ${active ? t.accent : 'transparent'}`, background:'none', color: active ? t.accent : t.textSecondary, fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' })
  const input    = { flex:1, padding:'10px 12px', borderRadius:'10px', border:`1.5px solid ${t.borderColor}`, background: t.inputBg, color: t.textPrimary, fontSize: isMobile ? '16px' : '13px', /* 16px = iOS zoom nahi karega */ fontFamily:'inherit', outline:'none', minWidth:0 }
  const iconBtn  = { background:'none', border:'none', cursor:'pointer', color: t.textSecondary, display:'flex', padding: isMobile ? '8px' : '4px' }
  const label    = { fontSize:'12px', fontWeight:'600', color: t.textSecondary, marginBottom:'6px' }
  const primary  = { width:'100%', marginTop:'18px', padding: isMobile ? '14px' : '12px', border:'none', borderRadius:'12px', background:'linear-gradient(135deg,#2b7fff,#1668f5)', color:'#fff', fontWeight:'700', fontSize:'13px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }

  return (
    <div style={wrap}>
      <Sidebar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />
      <div style={content}>
        <button style={backBtn} onClick={() => navigate('/dashboard/designs')}>
          <ArrowLeft size={14} /> Back to designs
        </button>

        {!template ? (
          <div style={{ color: t.textMuted }}>Loading template...</div>
        ) : (
          <div style={layout}>

            {/* Canvas preview */}
            <div ref={canvasWrapRef} style={canvasWrap}>
              <div style={canvasBox}>
                <Stage ref={stageRef} width={preview} height={preview} scaleX={preview / SIZE} scaleY={preview / SIZE}>
                  <Layer>
                    {bgImg && <KImage image={bgImg} width={SIZE} height={SIZE} crop={bgCrop} />}
                    <Rect width={SIZE} height={460} fill={bgColor} />

                    {logoImg && (
                      <KImage image={logoImg} x={60} y={40}
                        width={logoImg.width * logoScale} height={logoImg.height * logoScale} />
                    )}
                    {!hidden.heading && (
                      <Text text={values.heading} x={60} y={170} width={960}
                        fontSize={96} fontStyle="bold" fontFamily="Arial" fill={textColor} />
                    )}
                    {!hidden.subheading && (
                      <Text text={values.subheading} x={60} y={290} width={960}
                        fontSize={44} fontFamily="Arial" fill={textColor} />
                    )}
                    {!hidden.businessName && (
                      <Text text={values.businessName} x={60} y={372} width={560}
                        fontSize={56} fontStyle="bold" fontFamily="Arial" fill={textColor}
                        wrap="none" ellipsis />
                    )}
                    {!hidden.cta && (
                      <Group x={660} y={355}>
                        <Rect width={360} height={90} cornerRadius={8} fill={textColor} />
                        <Text text={values.cta} width={360} height={90} align="center" verticalAlign="middle"
                          fontSize={42} fontStyle="bold" fontFamily="Arial" fill="#ffffff"
                          wrap="none" ellipsis />
                      </Group>
                    )}
                  </Layer>
                </Stage>
              </div>
            </div>

            {/* Controls */}
            <div style={panel}>
              <div style={{ display:'flex', borderBottom: t.border, marginBottom:'16px' }}>
                {['text', 'image', 'theme'].map(k => (
                  <button key={k} style={tabBtn(tab === k)} onClick={() => setTab(k)}>
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>

              {tab === 'text' && FIELDS.map(f => (
                <div key={f.key} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
                  <button style={iconBtn} title={hidden[f.key] ? 'Show' : 'Hide'}
                    onClick={() => setHidden(h => ({ ...h, [f.key]: !h[f.key] }))}>
                    {hidden[f.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <input style={input} placeholder={f.label} value={values[f.key] || ''}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />
                </div>
              ))}

              {tab === 'image' && (
                <div>
                  <div style={label}>Logo</div>
                  <input type="file" accept="image/*" onChange={onLogo}
                    style={{ fontSize:'12px', color: t.textPrimary, maxWidth:'100%' }} />
                  {logoSrc && (
                    <button style={{ ...backBtn, marginTop:'10px' }} onClick={() => setLogoSrc(null)}>Remove logo</button>
                  )}
                </div>
              )}

              {tab === 'theme' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  <div>
                    <div style={label}>Band color</div>
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                      style={isMobile ? { width:'56px', height:'40px' } : undefined} />
                  </div>
                  <div>
                    <div style={label}>Text and button color</div>
                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
                      style={isMobile ? { width:'56px', height:'40px' } : undefined} />
                  </div>
                </div>
              )}

              <button style={primary} onClick={download}>
                <Download size={16} /> Download
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

export default DesignEditor