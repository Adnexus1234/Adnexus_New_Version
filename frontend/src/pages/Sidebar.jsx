import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'
import {
  LayoutGrid, TrendingUp, Users, BarChart3, Share2, CreditCard, Settings,
  ChevronsUpDown, ChevronLeft, Sun, Moon,
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────
   SHARED THEME TOKENS
   Har page isi LIGHT/DARK ko import karega, taaki colors/
   spacing sab jagah same rahein. Naya token add karna ho
   to sirf yahan add karo — sab pages ko mil jayega.
───────────────────────────────────────────────────────── */
export const LIGHT = {
  pageBg:       '#f0f4ff',
  sidebarBg:    '#ffffff',
  topbarBg:     '#ffffff',
  filterbarBg:  '#ffffff',
  cardBg:       '#ffffff',
  kpiBg:        '#ffffff',
  tableHeadBg:  '#f8faff',
  rowHover:     '#f0f4ff',
  inputBg:      '#f0f4ff',
  border:       '1px solid #e4e9f5',
  borderColor:  '#e4e9f5',
  textPrimary:  '#0f172a',
  textSecondary:'#64748b',
  textMuted:    '#94a3b8',
  accent:       '#2b7fff',
  accentHover:  '#1668f5',
  accentLight:  '#eaf2ff',
  accentBorder: '#bfdbfe',
  navActiveBg:  '#eaf2ff',
  navActiveColor:'#2b7fff',
  navColor:     '#64748b',
  badgeBlue:    { bg:'#eaf2ff',   color:'#1668f5', border:'#bfdbfe' },
  badgeGreen:   { bg:'#f0fdf4',   color:'#15803d', border:'#bbf7d0' },
  badgeAmber:   { bg:'#fffbeb',   color:'#b45309', border:'#fde68a' },
  badgePurple:  { bg:'#faf5ff',   color:'#7c3aed', border:'#ddd6fe' },
  badgeRed:     { bg:'#fef2f2',   color:'#dc2626', border:'#fecaca' },
  chipBg:       '#eaf2ff',
  chipColor:    '#2b7fff',
  avatarBg:     'linear-gradient(135deg,#2b7fff,#7c3aed)',
  scoreTrack:   '#e2e8f0',
  geoBg:        'linear-gradient(135deg,#eaf2ff,#f0f9ff)',
  geoBlob:      'rgba(43,127,255,0.14)',
  geoBlobDeep:  'rgba(43,127,255,0.32)',
  geoText:      '#1e40af',
  aiBoxBg:      '#eaf2ff',
  aiBoxBorder:  '#bfdbfe',
  aiBoxColor:   '#1e40af',
  aiDot:        '#2b7fff',
  actionHoverBg:'#f8faff',
  manageBg:     '#f8faff',
  manageColor:  '#64748b',
  manageBorder: '#e4e9f5',
  kpiSpendBg:   'linear-gradient(135deg,#cbe0fd 0%,#e5f0ff 100%)',
  kpiLeadsBg:   'linear-gradient(135deg,#b3efd0 0%,#dcf7e9 100%)',
  kpiCplBg:     'linear-gradient(135deg,#fdecc0 0%,#fff8e5 100%)',
  kpiActiveBg:  'linear-gradient(135deg,#ecd9ff 0%,#f6ecff 100%)',
  kpiIconSpend: 'rgba(59,130,246,0.2)',
  kpiIconLeads: 'rgba(16,185,129,0.2)',
  kpiIconCpl:   'rgba(217,119,6,0.16)',
  kpiIconActive:'rgba(168,85,247,0.16)',
  kpiTextSpend: '#2563eb',
  kpiTextLeads: '#059669',
  kpiTextCpl:   '#c2760a',
  kpiTextActive:'#9333ea',
  deleteBg:     '#fef2f2',
  deleteColor:  '#dc2626',
  deleteBorder: '#fecaca',
  emptyColor:   '#94a3b8',
  shadow:       '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  kpiShadow:    '0 1px 3px rgba(0,0,0,0.06)',
  progressTrack:'#eef2fb',
}

export const DARK = {
  pageBg:       '#05101f',
  sidebarBg:    'rgba(8,20,45,0.85)',
  topbarBg:     'rgba(8,20,45,0.75)',
  filterbarBg:  'rgba(8,20,45,0.6)',
  cardBg:       'rgba(255,255,255,0.055)',
  kpiBg:        'rgba(255,255,255,0.055)',
  tableHeadBg:  'transparent',
  rowHover:     'rgba(255,255,255,0.04)',
  inputBg:      'rgba(255,255,255,0.08)',
  border:       '1px solid rgba(255,255,255,0.09)',
  borderColor:  'rgba(255,255,255,0.09)',
  textPrimary:  '#ffffff',
  textSecondary:'rgba(255,255,255,0.55)',
  textMuted:    'rgba(255,255,255,0.3)',
  accent:       '#3b8bff',
  accentHover:  '#2563eb',
  accentLight:  'rgba(59,139,255,0.15)',
  accentBorder: 'rgba(59,139,255,0.3)',
  navActiveBg:  'rgba(59,139,255,0.18)',
  navActiveColor:'#7bb8ff',
  navColor:     'rgba(255,255,255,0.45)',
  badgeBlue:    { bg:'rgba(59,139,255,0.18)',  color:'#93c5fd', border:'rgba(59,139,255,0.3)' },
  badgeGreen:   { bg:'rgba(52,211,153,0.15)',  color:'#6ee7b7', border:'rgba(52,211,153,0.25)' },
  badgeAmber:   { bg:'rgba(251,191,36,0.15)',  color:'#fde68a', border:'rgba(251,191,36,0.25)' },
  badgePurple:  { bg:'rgba(167,139,250,0.15)', color:'#c4b5fd', border:'rgba(167,139,250,0.25)' },
  badgeRed:     { bg:'rgba(248,113,113,0.15)', color:'#fca5a5', border:'rgba(248,113,113,0.25)' },
  chipBg:       'rgba(59,139,255,0.2)',
  chipColor:    '#7bb8ff',
  avatarBg:     'linear-gradient(135deg,#3b8bff,#7b5af0)',
  scoreTrack:   'rgba(255,255,255,0.1)',
  geoBg:        'rgba(59,139,255,0.06)',
  geoBlob:      'rgba(59,139,255,0.15)',
  geoBlobDeep:  'rgba(59,139,255,0.35)',
  geoText:      'rgba(180,210,255,0.8)',
  aiBoxBg:      'rgba(59,139,255,0.08)',
  aiBoxBorder:  'rgba(59,139,255,0.22)',
  aiBoxColor:   'rgba(180,210,255,0.9)',
  aiDot:        '#3b8bff',
  actionHoverBg:'rgba(255,255,255,0.09)',
  manageBg:     'rgba(255,255,255,0.07)',
  manageColor:  'rgba(255,255,255,0.4)',
  manageBorder: 'rgba(255,255,255,0.1)',
  deleteBg:     'rgba(248,113,113,0.12)',
  deleteColor:  '#fca5a5',
  deleteBorder: 'rgba(248,113,113,0.25)',
  emptyColor:   'rgba(255,255,255,0.25)',
  shadow:       'none',
  kpiShadow:    'none',
  progressTrack:'rgba(255,255,255,0.08)',
  kpiSpendBg:   'linear-gradient(135deg,rgba(59,139,255,0.3) 0%,rgba(59,139,255,0.12) 100%)',
  kpiLeadsBg:   'linear-gradient(135deg,rgba(52,211,153,0.3) 0%,rgba(52,211,153,0.12) 100%)',
  kpiCplBg:     'linear-gradient(135deg,rgba(251,191,36,0.22) 0%,rgba(251,191,36,0.09) 100%)',
  kpiActiveBg:  'linear-gradient(135deg,rgba(167,139,250,0.22) 0%,rgba(167,139,250,0.09) 100%)',
  kpiIconSpend: 'rgba(59,139,255,0.28)',
  kpiIconLeads: 'rgba(52,211,153,0.28)',
  kpiIconCpl:   'rgba(251,191,36,0.22)',
  kpiIconActive:'rgba(167,139,250,0.2)',
  kpiTextSpend: '#7bb8ff',
  kpiTextLeads: '#6ee7b7',
  kpiTextCpl:   '#fde68a',
  kpiTextActive:'#c4b5fd',
}

/* Nav config — ek hi jagah. Naya sidebar item add/remove karna ho
   to sirf yahan karo, har page me nahi. `path` se hi active state
   aur click-navigation dono decide hote hain. */
const NAV_ITEMS = [
  { id:'dashboard',    label:'Dashboard',     path:'/dashboard',                 exact:true,  icon:<LayoutGrid size={18} /> },
  { id:'campaigns',    label:'Campaigns',     path:'/dashboard/create-campaign', icon:<TrendingUp size={18} /> },
  { id:'leads',        label:'Leads',         path:'/dashboard/leads',           icon:<Users size={18} /> },
  { id:'analytics',    label:'Analytics',     path:'/dashboard/analytics',       icon:<BarChart3 size={18} /> },
  { id:'refer',        label:'Refer & Earn',  path:'/dashboard/refer',           icon:<Share2 size={18} /> },
  { id:'subscription', label:'Subscription',  path:'/dashboard/subscription',    icon:<CreditCard size={18} /> },
]
const SETTINGS_ITEM = { id:'settings', label:'Settings', path:'/dashboard/settings', icon:<Settings size={18} /> }

/**
 * Common Sidebar — dashboard, leads, settings, jahan bhi chahiye
 * bas import karke drop karo:
 *
 *   <Sidebar
 *     darkMode={darkMode}
 *     setDarkMode={setDarkMode}
 *     sidebarCollapsed={sidebarCollapsed}
 *     setSidebarCollapsed={setSidebarCollapsed}
 *   />
 *
 * darkMode / sidebarCollapsed ka state parent page hi rakhega
 * (kyunki wo poore page ke look pe asar dalta hai, sirf sidebar
 * pe nahi) — Sidebar sirf unko use/update karta hai.
 */
const Sidebar = ({ darkMode, setDarkMode, sidebarCollapsed, setSidebarCollapsed }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const t = darkMode ? DARK : LIGHT

  const displayName = user?.name || 'User'
  const displayRole = user?.role || 'Member'
  const displayInitials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || 'U'

  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)

  const sidebar     = { width: sidebarCollapsed ? '60px' : '230px', background: t.sidebarBg, borderRight: t.border, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden', transition:'width 0.22s ease', height:'100vh', ...(darkMode ? { backdropFilter:'blur(20px)' } : { boxShadow:'1px 0 0 #e4e9f5' }) }
  const sbLogo      = { display:'flex', alignItems:'center', gap:'10px', padding:'18px 16px 14px', borderBottom: t.border, minHeight:'58px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }
  const sbLogoText  = { fontSize:'16px', fontWeight:'700', color: t.textPrimary, letterSpacing:'-0.2px', whiteSpace:'nowrap' }
  const sbLogoSub   = { fontWeight:'700', textTransform:'uppercase', color: t.textMuted, fontSize:'9px', letterSpacing:'2.5px', marginTop:'1px', whiteSpace:'nowrap' }
  const sbNav       = { display:'flex', flexDirection:'column', gap:'3px', padding:'12px 10px', flex:1 }
  const sbSectionLbl= { fontWeight:'700', textTransform:'uppercase', color: t.textMuted, fontSize:'10px', letterSpacing:'2px', padding: sidebarCollapsed ? '0' : '4px 12px 6px', whiteSpace:'nowrap', overflow:'hidden' }
  const navItemBase = { display:'flex', alignItems:'center', gap:'11px', padding:'9px 12px', borderRadius:'10px', border:'none', background:'none', cursor:'pointer', width:'100%', textAlign:'left', fontFamily:'inherit', fontSize:'13px', fontWeight:'500', color: t.navColor, whiteSpace:'nowrap', overflow:'hidden', transition:'all 0.15s' }
  const navItemActiveStyle = { background: t.navActiveBg, color: t.navActiveColor, ...(darkMode ? { border:'1px solid rgba(59,139,255,0.28)' } : {}) }
  const sbBottom    = { borderTop: t.border, padding:'12px 10px' }
  const userRow     = { display:'flex', alignItems:'center', gap:'10px', padding:'9px 8px', borderRadius:'10px', cursor:'pointer', marginBottom:'4px', overflow:'hidden', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }
  const userAvatar  = { width:'34px', height:'34px', borderRadius:'50%', flexShrink:0, background: t.avatarBg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'12px', color:'#fff' }
  const userName    = { fontSize:'13px', fontWeight:'600', color: t.textPrimary, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }
  const userRole    = { fontSize:'11px', color: t.textSecondary, whiteSpace:'nowrap' }
  const collapseBtn = { display:'flex', alignItems:'center', gap:'8px', padding:'8px', borderRadius:'10px', border:'none', background:'none', cursor:'pointer', width:'100%', fontFamily:'inherit', whiteSpace:'nowrap', overflow:'hidden', color: t.textSecondary, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }

  const renderItem = (item) => (
    <button
      key={item.id}
      title={sidebarCollapsed ? item.label : ''}
      onClick={() => navigate(item.path)}
      style={{ ...navItemBase, ...(isActive(item) ? navItemActiveStyle : {}), justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
    >
      <span style={{ flexShrink:0, display:'flex' }}>{item.icon}</span>
      {!sidebarCollapsed && <span style={{ overflow:'hidden', whiteSpace:'nowrap' }}>{item.label}</span>}
    </button>
  )

  return (
    <aside className="dashboard-sidebar" style={sidebar}>
      <div style={sbLogo}>
        <img src={logo} alt="AdNexus" style={{ width:'34px', height:'34px', objectFit:'contain', flexShrink:0 }} />
        {!sidebarCollapsed && (
          <div>
            <div style={sbLogoText}>AdNexus</div>
            <div style={sbLogoSub}>Growth OS</div>
          </div>
        )}
      </div>

      <nav style={sbNav}>
        {!sidebarCollapsed && <div style={sbSectionLbl}>Workspace</div>}
        {NAV_ITEMS.map(renderItem)}
        {!sidebarCollapsed && <div style={{ ...sbSectionLbl, marginTop:'14px' }}>Workspace settings</div>}
        {renderItem(SETTINGS_ITEM)}
      </nav>

      <div style={sbBottom}>
        <div style={{ borderRadius:'14px', background: darkMode ? 'rgba(255,255,255,0.06)' : '#f8faff', padding: sidebarCollapsed ? '8px' : '10px' }}>
          <div style={userRow}>
            <div style={userAvatar}>{displayInitials}</div>
            {!sidebarCollapsed && (
              <>
                <div style={{ flex:1, overflow:'hidden', minWidth:0 }}>
                  <div style={userName}>{displayName}</div>
                  <div style={userRole}>{displayRole}</div>
                </div>
                <ChevronsUpDown size={14} style={{ flexShrink:0, color: t.textMuted }} />
              </>
            )}
          </div>
          <button
            onClick={() => setDarkMode(v => !v)}
            style={{
              display:'flex', alignItems:'center', gap:'8px', marginTop:'8px',
              background: t.cardBg, border: t.border, borderRadius:'10px',
              padding:'7px 10px', width:'100%', cursor:'pointer', fontFamily:'inherit',
              justifyContent: sidebarCollapsed ? 'center' : 'space-between',
              color: t.textSecondary,
            }}
          >
            <span style={{ display:'flex', alignItems:'center', gap:'6px', color: darkMode ? '#7bb8ff' : '#d97706' }}>
              {darkMode ? <Moon size={16} /> : <Sun size={16} />}
              {!sidebarCollapsed && <span style={{ fontSize:'12px', color: t.textPrimary, fontWeight:'500' }}>{darkMode ? 'Dark' : 'Light'}</span>}
            </span>
          </button>
        </div>
        <button onClick={() => setSidebarCollapsed(v => !v)} style={{ ...collapseBtn, marginTop:'6px' }} title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
          <ChevronLeft size={16} style={{ flexShrink:0, transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition:'transform 0.22s' }} />
          {!sidebarCollapsed && <span style={{ fontSize:'12px' }}>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar