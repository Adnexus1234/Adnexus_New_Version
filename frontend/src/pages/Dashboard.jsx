import React, { useState, useEffect } from 'react'
import { getCampaigns, deleteCampaign, getCampaignStats, getLeads, syncPlatformStats, getCampaignDetail } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import logo from '../assets/logo.png'
import Sidebar, { LIGHT, DARK } from './Sidebar'
import CampaignSelect from './CampaignSelect'
import {
  LayoutGrid, TrendingUp, Users, BarChart3, Share2, Settings, Settings2,
  ChevronDown, ChevronsUpDown, ChevronLeft, Sun, Moon, Sparkles, Bell, CircleHelp,
  CalendarDays, Plus, Download, MoreHorizontal, Megaphone, ArrowUpRight,
  ArrowRight, MapPin, IndianRupee, UsersRound, BadgeIndianRupee, Activity, RefreshCw,
  Pin, PinOff, ChevronUp, X,
} from 'lucide-react'
import { SiGoogleads, SiMeta, SiInstagram } from 'react-icons/si'
import { FaLinkedin } from 'react-icons/fa'
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, dismissNotification } from '../services/api'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

const fmt = n => {
  if (!n && n !== 0) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toString()
}



/* ── Merged styles (was Dashboard.css) ── */
const DashboardStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .dashboard-kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    .dashboard-midrow {
      display: grid;
      grid-template-columns: 1fr 274px;
      gap: 16px;
      align-items: start;
    }

    .dashboard-left-col,
    .dashboard-right-col {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .dashboard-page {
      min-height: 100dvh;
    }

    .dashboard-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
    }

    .dashboard-topbar,
    .dashboard-filterbar {
      width: 100%;
    }

    .dashboard-table-scroll {
      overflow-x: auto;
      width: 100%;
    }

    .dashboard-table-scroll table {
      min-width: 680px;
      width: 100%;
      border-collapse: collapse;
    }

    .dashboard-table-scroll::-webkit-scrollbar {
      height: 7px;
    }

    .dashboard-table-scroll::-webkit-scrollbar-track {
      background: transparent;
    }

    .dashboard-table-scroll::-webkit-scrollbar-thumb {
      background: rgba(100, 116, 139, 0.25);
      border-radius: 9999px;
    }

    @media (max-width: 1100px) {
      .dashboard-kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dashboard-midrow {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .dashboard-kpis {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .dashboard-midrow {
        gap: 12px;
      }

      .dashboard-left-col,
      .dashboard-right-col {
        gap: 12px;
      }

      .dashboard-content {
        padding: 14px !important;
      }

      .dashboard-filterbar {
        flex-wrap: wrap;
        height: auto !important;
        padding: 10px 14px !important;
        gap: 8px !important;
      }

      .dashboard-filterbar > div:last-child {
        margin-left: 0 !important;
        width: 100%;
        justify-content: flex-start;
      }

      .kpi-card {
        padding: 12px 10px 10px !important;
      }
      .kpi-card .kpi-icon {
        width: 26px !important;
        height: 26px !important;
        font-size: 13px !important;
        margin-bottom: 8px !important;
      }
      .kpi-card .kpi-label {
        font-size: 8.5px !important;
        margin-bottom: 4px !important;
        letter-spacing: 0.02em !important;
      }
      .kpi-card .kpi-value {
        font-size: 15px !important;
      }
      .kpi-card .kpi-sub {
        font-size: 10px !important;
        display: block;
      }
      .kpi-card .kpi-progress-wrap {
        margin-top: 8px !important;
      }
    }

    @media (max-width: 540px) {
      .dashboard-kpis {
        gap: 7px;
      }

      .dashboard-midrow {
        gap: 10px;
      }

      .dashboard-topbar {
        padding: 0 14px !important;
      }
    }

    @media (max-width: 480px) {
      .dashboard-content {
        padding: 10px !important;
        gap: 12px !important;
      }

      .dashboard-topbar {
        height: auto !important;
        padding: 10px !important;
        flex-wrap: wrap;
        gap: 8px;
      }

      .dashboard-filterbar select {
        max-width: 140px !important;
      }

      .kpi-card {
        padding: 10px 8px 9px !important;
        border-radius: 12px !important;
      }
      .kpi-card .kpi-value {
        font-size: 13px !important;
      }
    }

    .dashboard-mobile-cards {
      display: none;
    }

    @media (max-width: 640px) {
      .dashboard-table-scroll {
        display: none;
      }

      .dashboard-mobile-cards {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
    }

    @media (max-width: 640px) {
      .dashboard-left-col > div,
      .dashboard-right-col > div {
        padding: 14px 16px !important;
      }
    }

    .platform-table-desktop {
      display: block;
    }
    .platform-row {
      transition: background 0.12s ease;
      cursor: default;
    }
    .platform-row:hover {
      background: var(--platform-row-hover);
    }
    .platform-table-mobile {
      display: none;
    }

    @media (max-width: 640px) {
      .platform-table-desktop {
        display: none;
      }
      .platform-table-mobile {
        display: block;
      }
    }

    .dashboard-topbar-actions {
      flex-shrink: 0;
    }

    .dashboard-topbar-actions button {
      flex-shrink: 0;
    }

    @media (max-width: 640px) {
      .dashboard-topbar-actions {
        gap: 6px !important;
      }
      .dashboard-topbar-actions button span {
        display: none;
      }
    }

    .icon-tooltip {
      position: relative;
    }
    .icon-tooltip::after {
      content: attr(data-tooltip);
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: var(--tt-bg);
      color: var(--tt-color);
      border: 1px solid var(--tt-border);
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      opacity: 0;
      visibility: hidden;
      transform: translateY(-4px);
      transition: opacity 0.15s ease, transform 0.15s ease;
      pointer-events: none;
      z-index: 50;
    }
    .icon-tooltip:hover::after {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }

    /* ── Recent campaigns: row-card hover + "more" menu ── */
    .campaign-row-card {
      transition: background 0.12s ease;
    }
    .campaign-row-card:hover {
      background: var(--row-hover-bg);
    }
    .campaign-more-wrap {
      position: relative;
    }
    .campaign-more-btn {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 6px;
    }

    /* ───── MOBILE FIXES ───── */
    .dashboard-filterbar { position: relative; z-index: 20; overflow: visible !important; }
    .campaign-meta { display: contents; }

    @media (max-width: 760px) {
      /* Filter bar: 2x2 grid, khali jagah nahi */
      .dashboard-filterbar {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        align-items: stretch !important;
        gap: 10px !important;
        height: auto !important;
        padding: 12px 14px !important;
      }
      .dashboard-filterbar .filter-label { display: none; }
      .dashboard-filterbar .filter-campaign,
      .dashboard-filterbar .filter-date { min-width: 0; }
      .dashboard-filterbar .filter-campaign > * { width: 100%; max-width: 100%; box-sizing: border-box; }
      .dashboard-filterbar .filter-date-pill { width: 100%; box-sizing: border-box; justify-content: center; min-height: 38px; }
      .dashboard-filterbar .filter-date-pill span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dashboard-filterbar .filter-actions {
        grid-column: 1 / -1; margin-left: 0 !important; width: 100%;
        display: grid !important; grid-template-columns: 1fr 1fr; gap: 10px !important;
      }
      .dashboard-filterbar .filter-actions button { justify-content: center; width: 100%; padding-top: 10px; padding-bottom: 10px; }
      /* Date popup screen se bahar na jaye */
      .date-popover { left: auto !important; right: 0; width: min(280px, calc(100vw - 28px)) !important; }
    }

    @media (max-width: 640px) {
      /* Notification popup poori width me */
      .dashboard-topbar { position: relative; }
      .notif-wrap { position: static !important; }
      .notif-popover { left: 12px !important; right: 12px !important; width: auto !important; top: calc(100% + 6px) !important; }

      /* KPI cards 2x2 */
      .dashboard-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .kpi-card { padding: 14px 14px 12px !important; border-radius: 16px !important; }
      .kpi-card .kpi-icon { width: 34px !important; height: 34px !important; margin-bottom: 10px !important; }
      .kpi-card .kpi-label { font-size: 9.5px !important; }
      .kpi-card .kpi-value { font-size: 20px !important; }
      .kpi-card .kpi-sub { font-size: 11px !important; }

      /* Recent campaigns row: 2 line me */
      .campaign-row-card { flex-wrap: wrap; gap: 8px 12px !important; }
      .campaign-row-card .campaign-info { flex: 1 1 0; min-width: 0; }
      .campaign-more-wrap { order: 2; }
      .campaign-meta {
        display: flex; order: 3; width: 100%; box-sizing: border-box;
        align-items: center; justify-content: space-between; padding-left: 50px;
      }
      .campaign-meta .campaign-spend { width: auto !important; }
    }
    .perf-badge-mobile { display: none; }

    @media (max-width: 640px) {
      .perf-badge { display: none; }
      .perf-badge-mobile { display: block; margin-top: 8px; }
      .perf-refresh-label { display: none; }
      .perf-refresh-btn {
        width: 38px; height: 38px; padding: 0 !important;
        justify-content: center; border-radius: 12px !important; flex-shrink: 0;
      }
    }

    @media (max-width: 640px) {
      /* Greeting left me, icons right me — ek hi row */
      .dashboard-topbar {
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 10px !important;
        padding: 10px 14px !important;
        height: auto !important;
      }
      .dashboard-topbar > div:first-child { min-width: 0; flex: 1; }
      .dashboard-topbar > div:first-child > div:first-child { font-size: 17px !important; flex-wrap: wrap; }
      .dashboard-topbar > div:first-child > div:last-child { font-size: 11px !important; line-height: 1.4; }
      .dashboard-topbar-actions { gap: 8px !important; }
    }
  `}</style>
)

const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [campaigns, setCampaigns]       = useState([])
  const [platformStats, setPlatformStats] = useState([])
  const [leads, setLeads]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [syncing, setSyncing]           = useState(false)
  const [syncError, setSyncError]       = useState('')
  const [activeNav, setActiveNav]       = useState('dashboard')
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [darkMode, setDarkMode]         = useState(false)
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [openMenuId, setOpenMenuId]     = useState(null)
  const [allStats, setAllStats]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('adnexus_all_stats') || '{}') } catch { return {} }
  })
  // Pin + "read more" state for the Recent Campaigns list
  const [pinnedCampaigns, setPinnedCampaigns] = useState([])   // array of campaign ids, most-recently-pinned first
  const [showAllCampaigns, setShowAllCampaigns] = useState(false)
  // Notifications
  const [notifications, setNotifications]   = useState([])
  const [unreadCount, setUnreadCount]       = useState(0)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [notifLoading, setNotifLoading]     = useState(false)
  const RECENT_CAMPAIGNS_LIMIT = 6

  const t = darkMode ? DARK : LIGHT   // active theme tokens

  const displayName = user?.name || 'User'
  const displayRole = user?.role || 'Member'
  const displayFirstName = displayName.split(' ')[0]
  const displayInitials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || 'U'

  // Real time-of-day greeting — no mock text
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    try { localStorage.setItem('adnexus_all_stats', JSON.stringify(allStats)) } catch {}
  }, [allStats])

  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth <= 640) setSidebarCollapsed(true)
    }
    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    setNotifLoading(true)
    try {
      const res = await getNotifications()
      setNotifications(res.data.notifications || [])
    } catch { setNotifications([]) }
    finally { setNotifLoading(false) }
  }

  const fetchUnreadCount = async () => {
    try {
      const res = await getUnreadNotificationCount()
      setUnreadCount(res.data.count || 0)
    } catch {}
  }

  const handleNotifClick = (notif) => {
    if (!notif.is_read) {
      markNotificationRead(notif.id).then(() => {
        setUnreadCount(c => Math.max(0, c - 1))
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
      }).catch(() => {})
    }
    // support notifications open the right screen
    if (notif.title === 'New support chat request') {
      setShowNotifDropdown(false)
      navigate('/support-inbox')
    } else if (notif.title === 'Support team replied') {
      setShowNotifDropdown(false)
      window.dispatchEvent(new Event('adnexus:toggle-chat'))
    }
  }
  const handleDismiss = (e, notif) => {
    e.stopPropagation()
    dismissNotification(notif.id).then(() => {
      setNotifications(prev => prev.filter(n => n.id !== notif.id))
      if (!notif.is_read) setUnreadCount(c => Math.max(0, c - 1))
    }).catch(() => {})
  }
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch {}
  }

  const summarizeDetail = (d) => ({
    spent: (d.platform_stats || []).reduce((s, p) => s + (p.budget_spent || 0), 0),
    totalBudget: d.total_budget || 0,
  })

  const fetchAllStats = async (list) => {
    // Update each campaign's numbers as soon as they arrive, don't wait for all of them
    list.forEach(async c => {
      try {
        const res = await getCampaignDetail(c.id)
        setAllStats(prev => ({ ...prev, [c.id]: summarizeDetail(res.data) }))
      } catch {}
    })
  }

  const fetchAll = async () => {
    try {
      const [campRes, leadsRes] = await Promise.all([getCampaigns(), getLeads()])
      const list = campRes.data.campaigns || campRes.data || []
      setCampaigns(list)
      fetchAllStats(list)
      const oldLeads = leadsRes.data.leads || leadsRes.data || []
      let formLeads = []
      try {
        for (const camp of list) {
          const res  = await fetch(`${API_BASE}/public/submissions/${camp.id}`)
          const data = await res.json()
          formLeads  = [...formLeads, ...(data.submissions || []).map(s => ({ ...s, name: s.full_name, campaign_id: camp.id }))]
        }
      } catch (e) { console.error('Form submissions fetch failed', e) }
      setLeads([...oldLeads, ...formLeads])
      if (list.length > 0) { setSelectedCampaign(list[0]); fetchStats(list[0].id) }
    } catch (err) { console.error('Fetch error:', err) }
    finally { setLoading(false) }
  }

  const fetchStats = async (id) => {
    setStatsLoading(true)
    try {
      const res = await getCampaignStats(id)
      setPlatformStats(res.data.stats || res.data || [])
    } catch { setPlatformStats([]) }
    finally { setStatsLoading(false) }
  }

  const handleSyncStats = async () => {
    if (!selectedCampaign) return
    setSyncing(true)
    setSyncError('')
    try {
      await syncPlatformStats(selectedCampaign.id)
      await fetchStats(selectedCampaign.id)
      const detail = await getCampaignDetail(selectedCampaign.id)
      setAllStats(prev => ({ ...prev, [selectedCampaign.id]: summarizeDetail(detail.data) }))
    } catch (err) {
      setSyncError(err.response?.data?.detail || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleCampaignChange = c => { setSelectedCampaign(c); fetchStats(c.id) }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this campaign?')) {
      try {
        await deleteCampaign(id)
        setPinnedCampaigns(prev => prev.filter(pid => pid !== id))
        fetchAll()
      } catch {}
    }
  }

  // Toggle pin: newly pinned campaign goes to the front of the pinned list.
  // Unpinning removes it and it falls back to its normal place in the list.
  const togglePinCampaign = (id) => {
    setPinnedCampaigns(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [id, ...prev])
  }

  const handleDownloadLeadsPDF = () => {
    if (leads.length === 0) {
      alert('No leads available to download.')
      return
    }

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.setTextColor(37, 99, 235)
    doc.text('AdNexus — Leads Report', 14, 15)

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 22)
    doc.text(`Total leads: ${leads.length}`, 14, 27)

    autoTable(doc, {
      startY: 33,
      head: [['Name', 'Phone', 'Platform', 'Campaign', 'Date', 'Score']],
      body: leads.map(lead => [
        lead.name || lead.full_name || '—',
        lead.phone || '—',
        lead.platform_name || lead.platform || 'Direct',
        campaigns.find(c => c.id === lead.campaign_id || c.id === String(lead.campaign_id))?.name || '—',
        lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN') : '—',
        lead.quality_score != null ? `${lead.quality_score}/10` : '—',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [240, 244, 255] },
    })

    doc.save(`adnexus-leads-${Date.now()}.pdf`)
  }

  const isCampaignInRange = (c) => {
    if (!dateFrom && !dateTo) return true
    const campStart = c.start_date ? new Date(c.start_date) : null
    const campEnd   = c.end_date ? new Date(c.end_date) : campStart
    if (!campStart) return true
    const rangeStart = dateFrom ? new Date(dateFrom) : null
    const rangeEnd   = dateTo ? new Date(dateTo) : rangeStart
    if (rangeStart && campEnd && campEnd < rangeStart) return false
    if (rangeEnd && campStart > rangeEnd) return false
    return true
  }
  const filteredCampaigns = campaigns.filter(isCampaignInRange)

  // Order for the Recent Campaigns list:
  // 1. Manually pinned campaigns (in the order they were pinned)
  // 2. The campaign currently selected in the top "Campaign" dropdown
  //    (only if it isn't already pinned) — this is what makes picking a
  //    campaign from that dropdown bring it to the top of the list.
  // 3. Everything else, in its normal order.
  const selectedId = selectedCampaign?.id
  const orderedCampaigns = [
    ...pinnedCampaigns
      .map(id => filteredCampaigns.find(c => c.id === id))
      .filter(Boolean),
    ...(selectedId != null && !pinnedCampaigns.includes(selectedId)
      ? filteredCampaigns.filter(c => c.id === selectedId)
      : []),
    ...filteredCampaigns.filter(c => c.id !== selectedId && !pinnedCampaigns.includes(c.id)),
  ]
  const visibleCampaigns = showAllCampaigns
    ? orderedCampaigns
    : orderedCampaigns.slice(0, RECENT_CAMPAIGNS_LIMIT)
  const hiddenCampaignsCount = Math.max(0, orderedCampaigns.length - RECENT_CAMPAIGNS_LIMIT)

  const dateRangeLabel = () => {
    if (!dateFrom && !dateTo) return 'All time'
    if (dateFrom && dateTo && dateFrom === dateTo) return `${dateFrom}`
    if (dateFrom && dateTo) return `${dateFrom} → ${dateTo}`
    if (dateFrom) return `From ${dateFrom}`
    return `Until ${dateTo}`
  }

  const campaignSpend       = (c) => allStats[c.id]?.spent ?? c.budget_spent ?? 0
  const campaignTotalBudget = (c) => allStats[c.id]?.totalBudget ?? c.total_budget ?? 0
  const totalBudget         = filteredCampaigns.reduce((s, c) => s + campaignTotalBudget(c), 0)
  const totalSpent          = filteredCampaigns.reduce((s, c) => s + campaignSpend(c), 0)
  const activeCampaigns = filteredCampaigns.filter(c => c.status === 'active').length
  const filteredIds     = new Set(filteredCampaigns.map(c => String(c.id)))
  const totalLeads      = (!dateFrom && !dateTo)
    ? leads.length
    : leads.filter(l => filteredIds.has(String(l.campaign_id))).length
  const totalLeadsSpend = platformStats.reduce((s, p) => s + (p.spend || 0), 0)
  const campaignLeads   = leads.filter(l =>
    l.campaign_id === selectedCampaign?.id || l.campaign_id === String(selectedCampaign?.id)
  )
  const totalLeadsCount = campaignLeads.length
  const unifiedCPL      = totalLeads > 0 && totalSpent > 0 ? (totalSpent / totalLeads).toFixed(2) : null
  const PLATFORM_NAME_MAP = { google: 'Google Ads', meta: 'Facebook', instagram: 'Instagram', fb: 'Facebook', ig: 'Instagram', linkedin: 'LinkedIn' }
  const leadsByPlatform = {}
  campaignLeads.forEach(lead => {
    const rawPlatform = (lead.platform_name || lead.platform || '').toLowerCase()
    const key = PLATFORM_NAME_MAP[rawPlatform] || lead.platform_name || lead.platform || 'Direct'
    leadsByPlatform[key] = (leadsByPlatform[key] || 0) + 1
  })
  // Same name-mapping used everywhere we look up leadsByPlatform by a platformStats row —
  // fixes the bug where "meta" (raw) never matched "Facebook" (mapped) and always showed "—"
  const platformStatKey = (p) => {
    const raw = (p.platform_name || p.platform || '').toLowerCase()
    return PLATFORM_NAME_MAP[raw] || p.platform_name || p.platform || 'Direct'
  }
  // Real brand icon + official color per platform — falls back to a colored letter chip for anything unrecognized
  const PLATFORM_BRAND = {
    'Google Ads':  { Icon: SiGoogleads, bg: '#4285F4' },
    'Facebook':    { Icon: SiMeta,      bg: '#0866FF' },
    'Instagram':   { Icon: SiInstagram, bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' },
    'LinkedIn':    { Icon: FaLinkedin,  bg: '#0A66C2' },
  }
  const platformBrand = (p) => PLATFORM_BRAND[platformStatKey(p)] || null

  // Real progress ratios for KPI cards (no invented targets)
  const budgetUsedPct    = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0
  const budgetUsedLabel  = budgetUsedPct > 0 && budgetUsedPct < 1 ? '<1' : Math.round(budgetUsedPct)
  const activeRatioPct   = filteredCampaigns.length > 0 ? Math.round((activeCampaigns / filteredCampaigns.length) * 100) : 0

  const navItems = [
    { id:'dashboard', label:'Dashboard', action:() => {}, icon:<LayoutGrid size={18} /> },
    { id:'campaigns', label:'Campaigns', action:() => navigate('/dashboard/create-campaign'), icon:<TrendingUp size={18} /> },
    { id:'leads', label:'Leads', action:() => navigate('/dashboard/leads'), icon:<Users size={18} /> },
    { id:'analytics', label:'Analytics', action:() => {}, icon:<BarChart3 size={18} /> },
    { id:'refer', label:'Refer & Earn', action:() => navigate('/dashboard/refer'), icon:<Share2 size={18} /> },
    { id:'settings', label:'Settings', action:() => navigate('/dashboard/settings'), icon:<Settings size={18} /> },
  ]

  // AI suggestions — per-platform analysis (CTR, clicks-without-leads, best leads, lowest CPL)
  const aiSuggestions = []
  if (platformStats.length > 0) {
    const rows = platformStats.map(p => {
      const impressions = p.impressions || 0
      const clicks = p.clicks || 0
      const spend = p.spend || 0
      const leadsCount = leadsByPlatform[platformStatKey(p)] || 0
      return {
        name: p.platform_name || p.platform || 'Platform',
        impressions, clicks, spend,
        leads: leadsCount,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpl: leadsCount > 0 ? spend / leadsCount : null,
      }
    })

    rows.forEach(r => {
      if (r.clicks >= 20 && r.leads === 0)
        aiSuggestions.push(`${r.name}: ${r.clicks} clicks but 0 leads. Check your landing page or lead form.`)
      else if (r.impressions >= 1000 && r.ctr < 1)
        aiSuggestions.push(`${r.name}: CTR is only ${r.ctr.toFixed(2)}%. Try changing the ad creative or headline.`)
      else if (r.impressions === 0 && r.spend === 0)
        aiSuggestions.push(`${r.name}: no impressions yet. Check the connection and ad status.`)
    })

    const withLeads = rows.filter(r => r.leads > 0)
    if (withLeads.length > 0) {
      const best = [...withLeads].sort((a, b) => b.leads - a.leads)[0]
      aiSuggestions.push(`${best.name} has the most leads (${best.leads}). Consider increasing its budget.`)
    }
    if (withLeads.length >= 2) {
      const cheapest = [...withLeads].sort((a, b) => a.cpl - b.cpl)[0]
      aiSuggestions.push(`${cheapest.name} has the lowest CPL (₹${cheapest.cpl.toFixed(2)}). Consider investing more here.`)
    }
  }
  const visibleSuggestions = aiSuggestions.slice(0, 3)

  /* ── Helpers ── */
  const badge = (variant, text) => (
    <span style={{
      background: t[variant].bg, color: t[variant].color,
      border: `1px solid ${t[variant].border}`,
      padding:'3px 9px', borderRadius:'20px', fontSize:'10px', fontWeight:'600',
    }}>{text}</span>
  )

  const progressBar = (pct, color, trackColor) => (
    <div style={{ borderRadius:'20px', background: trackColor || t.progressTrack, height:'7px', overflow:'hidden' }}>
      <div style={{ width:`${Math.max(0, Math.min(100, pct))}%`, height:'100%', borderRadius:'20px', background: color, transition:'width 0.3s ease' }} />
    </div>
  )

  // Segmented pill bar (4 segments) — filled count derived from a real ratio, no invented data
  const segmentedBar = (pct, color) => {
    const filledSegments = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 4)
    return (
      <div style={{ display:'flex', gap:'4px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ flex:1, height:'7px', borderRadius:'20px', background: color, opacity: i < filledSegments ? 1 : 0.25 }} />
        ))}
      </div>
    )
  }

  const kpiAccentColors = ['#3b82f6','#10b981','#f59e0b','#a855f7']
  // Gradient icon-box fills — tinted to match each card's pastel background
  const kpiIconColors   = [
    { bg: t.kpiIconSpend,  color: t.kpiTextSpend },
    { bg: t.kpiIconLeads,  color: t.kpiTextLeads },
    { bg: t.kpiIconCpl,    color: t.kpiTextCpl },
    { bg: t.kpiIconActive, color: t.kpiTextActive },
  ]
  const kpiTextColors = [t.kpiTextSpend, t.kpiTextLeads, t.kpiTextCpl, t.kpiTextActive]
  // Each KPI card gets its own full solid gradient background (like the AI Suggestions card)
  const kpiCardBg = [t.kpiSpendBg, t.kpiLeadsBg, t.kpiCplBg, t.kpiActiveBg]

  /* Shared inline styles driven by theme tokens */
  const wrap        = { display:'flex', height:'100dvh', background: darkMode ? 'linear-gradient(135deg,#05101f 0%,#091830 50%,#05101f 100%)' : t.pageBg, fontFamily:"'Inter',system-ui,-apple-system,sans-serif", fontSize:'13px' }
  const mainCol      = { flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0, minHeight:0 }
  const sidebar     = { width: sidebarCollapsed ? '60px' : '230px', background: t.sidebarBg, borderRight: t.border, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden', transition:'width 0.22s ease', ...(darkMode ? { backdropFilter:'blur(20px)' } : { boxShadow:'1px 0 0 #e4e9f5' }) }
  const sbLogo      = { display:'flex', alignItems:'center', gap:'10px', padding:'18px 16px 14px', borderBottom: t.border, minHeight:'58px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }
  const sbLogoIcon  = { width:'34px', height:'34px', borderRadius:'10px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 10px rgba(37,99,235,0.4)' }
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
  const topbar      = { background: t.topbarBg, borderBottom: t.border, padding:'0 24px', minHeight:'70px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, ...(darkMode ? { backdropFilter:'blur(12px)' } : { boxShadow:'0 1px 0 #e4e9f5' }) }
  const topbarTitle = { fontSize:'21px', fontWeight:'800', color: t.textPrimary, letterSpacing:'-0.4px', display:'flex', alignItems:'center', gap:'6px' }
  const topbarSub   = { color: t.textSecondary, fontSize:'12px', marginTop:'2px' }
  const iconBtn     = { background: darkMode ? 'rgba(255,255,255,0.07)' : t.accentLight, border: darkMode ? '1px solid rgba(255,255,255,0.1)' : `1px solid ${t.accentBorder}`, cursor:'pointer', width:'38px', height:'38px', borderRadius:'11px', display:'flex', alignItems:'center', justifyContent:'center', color: t.accent }
  const filterbar   = { background: t.filterbarBg, borderBottom: t.border, padding:'0 24px', height:'48px', display:'flex', alignItems:'center', gap:'12px', flexShrink:0, ...(darkMode ? { backdropFilter:'blur(8px)' } : {}) }
  const filterLabel = { fontSize:'11px', color: t.textMuted, fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em' }
  const filterSelect= { background: t.inputBg, border: `1.5px solid ${t.borderColor}`, borderRadius:'20px', padding:'7px 34px 7px 16px', fontSize:'12px', color: t.textPrimary, cursor:'pointer', fontFamily:'inherit', outline:'none', maxWidth:'220px', fontWeight:'700', appearance:'none', WebkitAppearance:'none', MozAppearance:'none' }
  const datePill    = { background: t.inputBg, border: `1px solid ${t.borderColor}`, borderRadius:'20px', padding:'5px 14px', fontSize:'12px', color: t.textSecondary, display:'flex', alignItems:'center', gap:'5px' }
  const btnPrimary  = { background:'linear-gradient(135deg,#2b7fff,#1668f5)', color:'#fff', border:'none', borderRadius:'12px', padding:'8px 18px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'5px', boxShadow:'0 4px 14px rgba(43,127,255,0.4)' }
  const btnGhost    = { background: darkMode ? 'rgba(255,255,255,0.07)' : '#fff', color: t.accent, border: `1px solid ${t.accentBorder}`, borderRadius:'10px', padding:'7px 16px', fontSize:'12px', fontWeight:'500', cursor:'pointer', fontFamily:'inherit' }
  const content     = { flex:1, overflow:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:'18px' }
  const card        = { background: t.cardBg, border: t.border, borderRadius:'20px', padding:'22px 24px', ...(darkMode ? { backdropFilter:'blur(16px)' } : { boxShadow: t.shadow }) }
  const cardHeader  = { display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'18px' }
  const cardTitle   = { fontSize:'14px', fontWeight:'800', color: t.textPrimary, letterSpacing:'-0.1px' }
  const cardSub     = { fontSize:'11px', color: t.textSecondary, marginTop:'2px' }
  const table       = { width:'100%', borderCollapse:'collapse', fontSize:'12px' }
  const th          = { padding:'10px 14px', textAlign:'left', color: t.textMuted, fontWeight:'700', borderBottom: t.border, fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', background: t.tableHeadBg }
  const td          = { padding:'12px 14px', color: t.textPrimary, verticalAlign:'middle', borderTop:`1px solid ${t.borderColor}` }
  const chip        = { width:'26px', height:'26px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'11px', flexShrink:0, background: t.chipBg, color: t.chipColor }
  const avatar      = { width:'28px', height:'28px', borderRadius:'50%', background: t.avatarBg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'11px', color:'#fff', flexShrink:0 }
  const manageBtn   = { background: t.manageBg, color: t.manageColor, border:`1px solid ${t.manageBorder}`, borderRadius:'7px', padding:'4px 10px', fontSize:'11px', cursor:'default', fontFamily:'inherit' }
  const deleteBtn   = { background: t.deleteBg, color: t.deleteColor, border:`1px solid ${t.deleteBorder}`, borderRadius:'7px', padding:'4px 10px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }
  const scoreBar    = { width:'56px', height:'4px', borderRadius:'2px', background: t.scoreTrack, overflow:'hidden' }
  const actionBtn   = { width:'100%', padding:'11px 14px', borderRadius:'13px', border: t.border, background: darkMode ? 'rgba(255,255,255,0.05)' : '#fff', color: t.textPrimary, fontSize:'12px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', fontFamily:'inherit', textAlign:'left', boxShadow: darkMode ? 'none' : t.shadow }
  const actionIcon  = { width:'26px', height:'26px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }
  const emptyStyle  = { textAlign:'center', padding:'28px', color: t.emptyColor, fontSize:'12px' }

  const toggleBtn = {
    display:'flex', alignItems:'center', gap:'6px',
    background: darkMode ? 'rgba(255,255,255,0.1)' : t.accentLight,
    border: darkMode ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${t.accentBorder}`,
    borderRadius:'20px', padding:'5px 12px',
    fontSize:'12px', fontWeight:'500', cursor:'pointer',
    color: darkMode ? '#fff' : t.accent,
    fontFamily:'inherit',
  }

  const tooltipVars = {
    '--tt-bg':     t.cardBg,
    '--tt-color':  t.textPrimary,
    '--tt-border': t.borderColor,
  }

  const platformTotals = {
    impressions: platformStats.reduce((s, p) => s + (p.impressions || 0), 0),
    clicks:      platformStats.reduce((s, p) => s + (p.clicks || 0), 0),
    spend:       platformStats.reduce((s, p) => s + (p.spend || 0), 0),
    leads:       totalLeadsCount,
  }
  const platformTotalCPL = platformTotals.leads > 0 ? (platformTotals.spend / platformTotals.leads).toFixed(2) : null

  return (
    <div className="dashboard-page" style={wrap}>
      <DashboardStyles />

      <Sidebar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />

      {/* ── Main ── */}
      <div className="dashboard-main" style={mainCol}>

        {/* Topbar — real greeting + subtext */}
        <header className="dashboard-topbar" style={topbar}>
          <div>
            <div style={topbarTitle}>
              {greeting}, {displayFirstName}
              <span style={{ color:'#d97706', display:'flex' }}><Sparkles size={16} color="#d97706" /></span>
            </div>
            <div style={topbarSub}>Here's what's happening with your campaigns today.</div>
          </div>
          <div className="dashboard-topbar-actions" style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div className="notif-wrap" style={{ position: 'relative' }}>
              <button
                className="icon-tooltip"
                style={{ ...iconBtn, ...tooltipVars, position: 'relative' }}
                data-tooltip="Notifications"
                onClick={() => {
                  setShowNotifDropdown(v => !v)
                  if (!showNotifDropdown) fetchNotifications()
                }}
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-3px', right: '-3px',
                    background: '#dc2626', color: '#fff', fontSize: '9px', fontWeight: '700',
                    borderRadius: '10px', minWidth: '16px', height: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px', border: `2px solid ${t.topbarBg}`,
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="notif-popover" style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
                  background: t.cardBg, border: t.border, borderRadius: '14px',
                  width: '340px', maxHeight: '420px', display: 'flex', flexDirection: 'column',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.16)', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: t.border }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: t.textPrimary }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: t.accent, fontFamily: 'inherit' }}>
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {notifLoading ? (
                      <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: t.textMuted }}>Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: t.textMuted }}>No notifications yet.</div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          style={{
                            padding: '12px 16px', cursor: 'pointer',
                            borderBottom: `1px solid ${t.borderColor}`,
                            background: n.is_read ? 'transparent' : (darkMode ? 'rgba(59,139,255,0.08)' : '#eaf2ff'),
                            position: 'relative',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            {!n.is_read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.accent, marginTop: '5px', flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: t.textPrimary, paddingRight: '18px' }}>{n.title}</div>
                              <div style={{ fontSize: '11px', color: t.textSecondary, marginTop: '2px' }}>{n.message}</div>
                              <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '4px' }}>
                                {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleDismiss(e, n)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: t.textMuted, padding: '2px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              className="icon-tooltip"
              style={{ ...iconBtn, ...tooltipVars }}
              data-tooltip="Help & Support"
              onClick={() => window.dispatchEvent(new Event('adnexus:toggle-chat'))}
            >
              <CircleHelp size={17} />
            </button>
            <button
              className="icon-tooltip"
              style={{ ...iconBtn, ...tooltipVars }}
              data-tooltip={darkMode ? 'Switch to light' : 'Switch to dark'}
              onClick={() => setDarkMode(v => !v)}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Filter bar */}
        <div className="dashboard-filterbar" style={filterbar}>
          <span className="filter-label" style={filterLabel}>Campaign</span>
          <div className="filter-campaign">
            <CampaignSelect
              campaigns={campaigns}
              selectedCampaign={selectedCampaign}
              onChange={handleCampaignChange}
              t={t}
              darkMode={darkMode}
            />
          </div>
          <div className="filter-date" style={{ position: 'relative' }}>
            <div className="filter-date-pill" style={{ ...datePill, cursor: 'pointer' }} onClick={() => setShowDatePicker(v => !v)}>
              <CalendarDays size={13} style={{ flexShrink: 0 }} />
              <span>{dateRangeLabel()}</span>
            </div>
            {showDatePicker && (
              <div className="date-popover" style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                background: t.cardBg, border: t.border, borderRadius: '12px',
                padding: '14px', width: '260px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {[
                    { label: 'All time', from: '', to: '' },
                    { label: 'Today', from: new Date().toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) },
                    { label: 'Last 7 days', from: new Date(Date.now() - 6*86400000).toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) },
                    { label: 'Last 30 days', from: new Date(Date.now() - 29*86400000).toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) },
                  ].map(preset => (
                    <button key={preset.label} onClick={() => { setDateFrom(preset.from); setDateTo(preset.to) }}
                      style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '20px', border: `1px solid ${t.borderColor}`, background: t.inputBg, color: t.textPrimary, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '10px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Custom range</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.borderColor}`, background: t.inputBg, color: t.textPrimary, fontSize: '12px', fontFamily: 'inherit' }} />
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.borderColor}`, background: t.inputBg, color: t.textPrimary, fontSize: '12px', fontFamily: 'inherit' }} />
                </div>
                <button onClick={() => setShowDatePicker(false)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: 'none', background: t.accent, color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Apply
                </button>
              </div>
            )}
          </div>
          <div className="filter-actions" style={{ marginLeft:'auto', display:'flex', gap:'8px' }}>
            <button style={btnPrimary} onClick={() => navigate('/dashboard/create-campaign')}><Plus size={14} /> New campaign</button>
            <button style={{ ...btnGhost, display:'flex', alignItems:'center', gap:'5px' }} onClick={() => navigate('/dashboard/leads')}><Users size={14} /> View leads</button>
          </div>
        </div>

        {/* Content */}
        <div className="dashboard-content" style={content}>

          {selectedCampaign && (
            <div style={{ fontWeight:'700', textTransform:'uppercase', color: darkMode ? 'rgba(123,184,255,0.75)' : 'rgba(37,99,235,0.7)', fontSize:'10px', letterSpacing:'2.4px' }}>
              All campaigns · {dateRangeLabel()}
            </div>
          )}

          {/* KPI row — every number/progress bar below is derived from real state, no invented targets */}
          <div className="dashboard-kpis">
            {[
              {
                label:'Total Spend', value:`₹${totalSpent.toLocaleString()}`,
                sub: totalBudget > 0 ? `of ₹${totalBudget.toLocaleString()} budget` : null,
                progress: totalBudget > 0 ? budgetUsedPct : null,
                progressColor: kpiAccentColors[0],
                progressNote: totalBudget > 0 ? [`${budgetUsedLabel}% used`, `₹${totalBudget.toLocaleString()} budget`] : null,
              },
              {
                label:'Total Leads', value: totalLeads || '—',
                sub: null,
                progress: null,
              },
              {
                label:'Unified CPL', value: unifiedCPL ? `₹${unifiedCPL}` : '—',
                sub: null,
                progress: null,
              },
              {
                label:'Active Campaigns', value: activeCampaigns || '—',
                sub: filteredCampaigns.length > 0 ? `of ${filteredCampaigns.length} total` : null,
                progress: filteredCampaigns.length > 0 ? activeRatioPct : null,
                progressColor: kpiAccentColors[3],
                progressNote: filteredCampaigns.length > 0 ? [`${activeCampaigns} active`, `${filteredCampaigns.length} total`] : null,
                segmented: true,
              },
            ].map((k, i) => (
              <div key={k.label} className="kpi-card" style={{ background: kpiCardBg[i], border: darkMode ? `1px solid ${kpiAccentColors[i]}22` : `1px solid ${kpiAccentColors[i]}18`, borderRadius:'22px', padding:'22px 22px 20px', position:'relative', overflow:'hidden', boxShadow: darkMode ? 'none' : `0 4px 14px ${kpiAccentColors[i]}12` }}>
                <div className="kpi-icon" style={{ width:'44px', height:'44px', borderRadius:'14px', background: kpiIconColors[i].bg, color: kpiIconColors[i].color, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'18px' }}>
                  {[<IndianRupee size={20} key="ir" />, <UsersRound size={20} key="ur" />, <BadgeIndianRupee size={20} key="bir" />, <Activity size={20} key="ac" />][i]}
                </div>
                <div className="kpi-label" style={{ fontSize:'10px', fontWeight:'700', color: t.textMuted, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:'8px' }}>{k.label}</div>
                <div className="kpi-value" style={{ fontSize:'27px', fontWeight:'800', color: t.textPrimary, lineHeight:1, letterSpacing:'-0.4px' }}>
                  {k.value}
                </div>
                {k.sub && <div className="kpi-sub" style={{ fontSize:'11px', color: t.textSecondary, fontWeight:'400', marginTop:'8px' }}>{k.sub}</div>}
                {k.progress != null && (
                  <div className="kpi-progress-wrap" style={{ marginTop:'18px' }}>
                    {k.segmented ? segmentedBar(k.progress, kpiTextColors[i]) : progressBar(k.progress, kpiTextColors[i], darkMode ? 'rgba(255,255,255,0.08)' : `${kpiAccentColors[i]}18`)}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color: t.textMuted, marginTop:'8px' }}>
                      <span>{k.progressNote[0]}</span>
                      <span>{k.progressNote[1]}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mid row */}
          <div className="dashboard-midrow">

            {/* Left col */}
            <div className="dashboard-left-col">

              {/* Platform performance */}
              <div style={card}>
                <div style={{ ...cardHeader, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={cardTitle}>Platform Performance</div>
                    <div style={cardSub}>Spend and lead quality for your active channels</div>
                    {selectedCampaign && (
                      <div className="perf-badge-mobile">{badge('badgeBlue', selectedCampaign.name)}</div>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink: 0 }}>
                    {selectedCampaign && <span className="perf-badge">{badge('badgeBlue', selectedCampaign.name)}</span>}
                    {selectedCampaign && (
                      <button
                        className="perf-refresh-btn"
                        aria-label="Refresh stats"
                        onClick={handleSyncStats}
                        disabled={syncing}
                        style={{
                          background: syncing ? '#93b8f4' : 'linear-gradient(135deg,#2b7fff,#1660e8)',
                          color: '#fff', border: 'none', borderRadius: '20px',
                          padding: '7px 16px', fontSize: '11px', fontWeight: '700',
                          cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                          whiteSpace: 'nowrap', display:'flex', alignItems:'center', gap:'6px',
                          boxShadow: syncing ? 'none' : '0 4px 14px rgba(43,127,255,0.4)',
                        }}
                      >
                        <RefreshCw size={13} style={{ animation: syncing ? 'spin 0.9s linear infinite' : 'none' }} />
                        <span className="perf-refresh-label">{syncing ? 'Syncing...' : 'Refresh Stats'}</span>
                      </button>
                    )}
                  </div>
                </div>
                {syncError && (
                  <div style={{ background: t.badgeRed.bg, color: t.badgeRed.color, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px', border: `1px solid ${t.badgeRed.border}` }}>
                    {syncError}
                  </div>
                )}
                {statsLoading ? <div style={emptyStyle}>Loading stats…</div>
                : platformStats.length === 0 ? <div style={emptyStyle}>{selectedCampaign ? 'No platform data for this campaign yet.' : 'Select a campaign to see stats.'}</div>
                : (
                  <>
                  {/* Desktop / tablet: bordered rounded table, all columns */}
                  <div className="dashboard-table-scroll platform-table-desktop" style={{ borderRadius:'14px', border: `1.5px solid ${t.borderColor}`, overflow:'hidden', boxShadow: darkMode ? 'none' : '0 4px 16px rgba(43,127,255,0.08)', '--platform-row-hover': darkMode ? 'rgba(59,139,255,0.14)' : '#eaf2ff' }}>
                    <table style={table}>
                      <thead><tr>{['Platform','Impressions','Clicks','Spend','Leads','CPL'].map(h => <th key={h} style={{ ...th, background: darkMode ? 'rgba(59,139,255,0.1)' : '#eaf2ff', color: darkMode ? '#7bb8ff' : '#1660e8' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {platformStats.map((p, i) => {
                          const rowColor = kpiAccentColors[i % kpiAccentColors.length]
                          const brand = platformBrand(p)
                          return (
                            <tr key={p.platform_id || i} className="platform-row">
                            <td style={{ ...td, borderTop: i === 0 ? 'none' : td.borderTop, fontWeight:'700' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
                                {brand ? (
                                  <div style={{ ...chip, background: brand.bg, color:'#fff', boxShadow:'0 3px 8px rgba(0,0,0,0.15)' }}>
                                    <brand.Icon size={14} />
                                  </div>
                                ) : (
                                  <div style={{ ...chip, background: `linear-gradient(135deg,${rowColor},${rowColor}cc)`, color:'#fff', boxShadow:`0 3px 8px ${rowColor}55` }}>{(p.platform_name || p.platform || 'P').charAt(0).toUpperCase()}</div>
                                )}
                                <span>{p.platform_name || p.platform || '—'}</span>
                              </div>
                            </td>
                            <td style={{ ...td, borderTop: i === 0 ? 'none' : td.borderTop, color: t.textSecondary }}>{fmt(p.impressions)}</td>
                            <td style={{ ...td, borderTop: i === 0 ? 'none' : td.borderTop, color: t.textSecondary }}>{p.clicks ? p.clicks.toLocaleString() : '—'}</td>
                            <td style={{ ...td, borderTop: i === 0 ? 'none' : td.borderTop, fontWeight:'700' }}>{p.spend ? `₹${p.spend.toLocaleString()}` : '—'}</td>
                            <td style={{ ...td, borderTop: i === 0 ? 'none' : td.borderTop }}>{badge('badgeBlue', leadsByPlatform[platformStatKey(p)] ?? '—')}</td>
                            <td style={{ ...td, borderTop: i === 0 ? 'none' : td.borderTop }}>{badge('badgePurple', (() => {
                              const pLeads = leadsByPlatform[platformStatKey(p)] || 0
                              const pCpl = pLeads > 0 ? (p.spend / pLeads).toFixed(2) : null
                              return pCpl ? `₹${pCpl}` : '—'
                            })())}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>

                  {/* Mobile: compact 4-column table + Total row */}
                  <div className="platform-table-mobile">
                    <table style={table}>
                      <thead><tr>{['Platform','Spend','Leads','CPL'].map(h => <th key={h} style={{ ...th, padding:'6px 8px' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {platformStats.map((p, i) => {
                          const rowColor = kpiAccentColors[i % kpiAccentColors.length]
                          const brand = platformBrand(p)
                          return (
                            <tr key={p.platform_id || i}>
                              <td style={{ ...td, padding:'8px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                  {brand ? (
                                    <div style={{ ...chip, width:'20px', height:'20px', background: brand.bg, color:'#fff' }}>
                                      <brand.Icon size={11} />
                                    </div>
                                  ) : (
                                    <div style={{ ...chip, width:'20px', height:'20px', fontSize:'10px', background: `linear-gradient(135deg,${rowColor},${rowColor}cc)`, color:'#fff' }}>{(p.platform_name || p.platform || 'P').charAt(0).toUpperCase()}</div>
                                  )}
                                  <span style={{ fontWeight:'600', fontSize:'12px' }}>{p.platform_name || p.platform || '—'}</span>
                                </div>
                              </td>
                              <td style={{ ...td, padding:'8px', fontSize:'12px' }}>{p.spend ? `₹${p.spend.toLocaleString()}` : '—'}</td>
                              <td style={{ ...td, padding:'8px', fontSize:'12px' }}>{leadsByPlatform[platformStatKey(p)] ?? '—'}</td>
                              <td style={{ ...td, padding:'8px', fontSize:'12px' }}>{(() => {
                                const pLeads = leadsByPlatform[platformStatKey(p)] || 0
                                const pCpl = pLeads > 0 ? (p.spend / pLeads).toFixed(2) : null
                                return pCpl ? `₹${pCpl}` : '—'
                              })()}</td>
                            </tr>
                          )
                        })}
                        <tr>
                          <td style={{ ...td, padding:'8px', fontWeight:'700', fontSize:'12px', borderBottom:'none' }}>Total</td>
                          <td style={{ ...td, padding:'8px', fontWeight:'700', fontSize:'12px', borderBottom:'none' }}>{platformTotals.spend ? `₹${platformTotals.spend.toLocaleString()}` : '—'}</td>
                          <td style={{ ...td, padding:'8px', fontWeight:'700', fontSize:'12px', borderBottom:'none' }}>{platformTotals.leads || '—'}</td>
                          <td style={{ ...td, padding:'8px', fontWeight:'700', fontSize:'12px', borderBottom:'none' }}>{platformTotalCPL ? `₹${platformTotalCPL}` : '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>

              {/* Recent campaigns — row-card style, pinned-first ordering, 6-item preview + Read more */}
              <div style={card}>
                <div style={cardHeader}>
                  <div>
                    <div style={cardTitle}>Recent Campaigns</div>
                    <div style={cardSub}>Monitor your latest campaign activity</div>
                  </div>
                  <button onClick={() => navigate('/dashboard/leads')} style={{ background:'none', border:'none', cursor:'pointer', color: t.accent, fontSize:'12px', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px', fontFamily:'inherit' }}>
                    View all
                    <ArrowUpRight size={12} />
                  </button>
                </div>
                {loading ? <div style={emptyStyle}>Loading…</div>
                : campaigns.length === 0 ? <div style={emptyStyle}>No campaigns yet. Create one to get started.</div>
                : (
                  <>
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                    {visibleCampaigns.map(c => {
                      const cLeadsCount = leads.filter(l => l.campaign_id === c.id || l.campaign_id === String(c.id)).length
                      const cSpend = campaignSpend(c)
                      // Real "ending soon" derivation — end_date within 7 days — no invented status
                      const daysToEnd = c.end_date ? Math.ceil((new Date(c.end_date) - new Date()) / 86400000) : null
                      const isEndingSoon = c.status === 'active' && daysToEnd != null && daysToEnd >= 0 && daysToEnd <= 7
                      const statusLabel = isEndingSoon ? 'Ending soon' : (c.status || '—')
                      const isPinned = pinnedCampaigns.includes(c.id)
                      return (
                        <div key={c.id} className="campaign-row-card" style={{ '--row-hover-bg': t.rowHover, borderRadius:'14px', display:'flex', padding:'12px', alignItems:'center', gap:'14px', background: isPinned ? t.accentLight : 'transparent' }}>
                          <div style={{ width:'38px', height:'38px', borderRadius:'12px', background: t.chipBg, color: t.chipColor, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <Megaphone size={16} color={t.chipColor} />
                          </div>
                          <div className="campaign-info" style={{ minWidth:0, flex:1, cursor:'pointer' }} onClick={() => navigate(`/dashboard/campaign/${c.id}`)}>
                            <div style={{ fontWeight:'700', fontSize:'14px', color: t.textPrimary, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', alignItems:'center', gap:'6px' }}>
                              {isPinned && <Pin size={12} color={t.accent} fill={t.accent} />}
                              {c.name}
                            </div>
                            <div style={{ fontSize:'11px', color: t.textSecondary, marginTop:'3px' }}>
                              {(c.goal || '—')}{c.start_date ? ` · Started ${new Date(c.start_date).toLocaleDateString('en-IN', { month:'short', day:'numeric' })}` : ''}
                            </div>
                          </div>
                          <div className="campaign-meta">
                            {badge('badgeBlue', statusLabel)}
                            <div className="campaign-spend" style={{ textAlign:'right', width:'96px', flexShrink:0 }}>
                              <div style={{ fontWeight:'700', fontSize:'12px', color: t.textPrimary }}>₹{cSpend.toLocaleString()}</div>
                              <div style={{ fontSize:'10px', color: t.textMuted, marginTop:'2px' }}>{cLeadsCount} leads</div>
                            </div>
                          </div>
                          <div className="campaign-more-wrap">
                            <button className="campaign-more-btn" onClick={() => setOpenMenuId(v => v === c.id ? null : c.id)} style={{ color: t.textMuted }}>
                              <MoreHorizontal size={16} color={t.textMuted} />
                            </button>
                            {openMenuId === c.id && (
                              <div style={{ position:'absolute', right:0, top:'calc(100% + 4px)', zIndex:20, background: t.cardBg, border: t.border, borderRadius:'10px', boxShadow:'0 8px 20px rgba(0,0,0,0.12)', overflow:'hidden', minWidth:'130px' }}>
                                <button style={{ display:'flex', alignItems:'center', gap:'6px', width:'100%', textAlign:'left', padding:'8px 12px', background:'none', border:'none', cursor:'pointer', fontSize:'12px', color: t.textPrimary, fontFamily:'inherit' }} onClick={() => { setOpenMenuId(null); togglePinCampaign(c.id) }}>
                                  {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                                  {isPinned ? 'Unpin' : 'Pin'}
                                </button>
                                <button style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', background:'none', border:'none', cursor:'pointer', fontSize:'12px', color: t.textPrimary, fontFamily:'inherit' }} onClick={() => { setOpenMenuId(null); navigate(`/dashboard/campaign/${c.id}/edit`) }}>Manage</button>
                                <button style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', background:'none', border:'none', cursor:'pointer', fontSize:'12px', color: t.deleteColor, fontFamily:'inherit' }} onClick={() => { setOpenMenuId(null); handleDelete(c.id) }}>Delete</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {orderedCampaigns.length > RECENT_CAMPAIGNS_LIMIT && (
                    <button
                      onClick={() => setShowAllCampaigns(v => !v)}
                      style={{
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'5px',
                        width:'100%', marginTop:'10px', padding:'9px', borderRadius:'10px',
                        border: `1px solid ${t.accentBorder}`, background: t.accentLight,
                        color: t.accent, fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit',
                      }}
                    >
                      {showAllCampaigns ? (
                        <>Show less <ChevronUp size={13} /></>
                      ) : (
                        <>Read more ({hiddenCampaignsCount} more) <ChevronDown size={13} /></>
                      )}
                    </button>
                  )}
                  </>
                )}
              </div>

              {/* Leads feed */}
              <div style={card}>
                <div style={cardHeader}>
                  <span style={cardTitle}>Leads{selectedCampaign ? ` — ${selectedCampaign.name}` : ''}</span>
                  <button style={btnGhost} onClick={() => navigate('/dashboard/leads')}>View all</button>
                </div>
                {campaignLeads.length === 0 ? <div style={emptyStyle}>No leads for this campaign yet.</div>
                : (
                  <>
                  <div className="dashboard-table-scroll">
                    <table style={table}>
                      <thead><tr>{['Name','Phone','Platform','Date','Score'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {campaignLeads.slice(0, 5).map((lead, i) => {
                        const score = lead.quality_score
                        const scoreColor = score >= 8 ? '#16a34a' : score >= 5 ? '#d97706' : '#dc2626'
                        return (
                          <tr key={lead.id || i} style={{ cursor:'pointer' }} onClick={() => navigate(`/dashboard/campaign/${selectedCampaign?.id}/`)}>
                            <td style={td}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <div style={avatar}>{(lead.name || lead.full_name || '?').charAt(0).toUpperCase()}</div>
                                <span style={{ fontWeight:'600', color: t.accent }}>{lead.name || lead.full_name || '—'}</span>
                              </div>
                            </td>
                            <td style={td}>{lead.phone || '—'}</td>
                            <td style={td}>{badge('badgeGreen', lead.platform_name || lead.platform || 'Direct')}</td>
                            <td style={td}>{lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN') : '—'}</td>
                            <td style={td}>
                              {score != null ? (
                                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                  <div style={scoreBar}><div style={{ height:'100%', borderRadius:'2px', width:`${score * 10}%`, background: scoreColor }} /></div>
                                  <span style={{ fontSize:'11px', color: t.textSecondary }}>{score}/10</span>
                                </div>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>

                  <div className="dashboard-mobile-cards">
                    {campaignLeads.slice(0, 5).map((lead, i) => {
                      const score = lead.quality_score
                      const scoreColor = score >= 8 ? '#16a34a' : score >= 5 ? '#d97706' : '#dc2626'
                      return (
                        <div key={lead.id || i} style={{ border: t.border, borderRadius:'12px', padding:'12px 14px', background: darkMode ? 'rgba(255,255,255,0.03)' : '#fafbff' }}
                          onClick={() => navigate(`/dashboard/campaign/${selectedCampaign?.id}`)}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                            <div style={avatar}>{(lead.name || lead.full_name || '?').charAt(0).toUpperCase()}</div>
                            <span style={{ fontWeight:'600', color: t.accent, fontSize:'13px' }}>{lead.name || lead.full_name || '—'}</span>
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'8px', fontSize:'11px', color: t.textSecondary }}>
                            <span>{lead.phone || '—'}</span>
                            {badge('badgeGreen', lead.platform_name || lead.platform || 'Direct')}
                            <span style={{ color: t.textMuted }}>{lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN') : '—'}</span>
                            {score != null && <span style={{ color: scoreColor, fontWeight:'600' }}>{score}/10</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  </>
                )}
              </div>

            </div>

            {/* Right col */}
            <div className="dashboard-right-col">

              {/* Quick actions */}
              <div style={card}>
                <div style={cardHeader}><span style={cardTitle}>Quick Actions</span></div>
                {[
                  { label:'Create new campaign', icon:<Plus size={15} />, iconBg: darkMode ? 'rgba(59,139,255,0.2)' : '#eaf2ff', iconColor: darkMode ? '#7bb8ff' : '#2b7fff', action: () => navigate('/dashboard/create-campaign') },
                  { label:'Download leads (PDF)', icon:<Download size={15} />, iconBg: darkMode ? 'rgba(52,211,153,0.15)' : '#f0fdf4', iconColor: darkMode ? '#6ee7b7' : '#16a34a', action: handleDownloadLeadsPDF },
                  { label:'Manage integrations', icon:<Settings2 size={15} />, iconBg: darkMode ? 'rgba(167,139,250,0.15)' : '#faf5ff', iconColor: darkMode ? '#c4b5fd' : '#7c3aed', action: () => navigate('/dashboard/settings') },
                ].map(a => (
                  <button key={a.label} style={actionBtn} onClick={a.action}>
                    <span style={{ ...actionIcon, background: a.iconBg, color: a.iconColor }}>{a.icon}</span>
                    {a.label}
                  </button>
                ))}
              </div>

              {/* AI suggestions — solid accent card, real data from platformStats */}
              <div style={{
                borderRadius:'18px',
                background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                color:'#eff6ff',
                padding:'20px 22px',
                boxShadow: darkMode ? '0 8px 24px rgba(37,99,235,0.35)' : '0 8px 24px rgba(37,99,235,0.25)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <Sparkles size={16} color="#eff6ff" />
                  <span style={{ fontWeight:'700', fontSize:'13px' }}>AI Suggestions</span>
                  <span style={{ marginLeft:'auto', fontSize:'9px', fontWeight:'700', background:'rgba(255,255,255,0.18)', padding:'3px 9px', borderRadius:'20px' }}>Live</span>
                </div>
                {visibleSuggestions.length === 0 ? (
                  <p style={{ color:'rgba(239,246,255,0.75)', fontSize:'12px', lineHeight:'1.6', marginTop:'14px' }}>
                    Suggestions appear once platform data is available.
                  </p>
                ) : (
                  visibleSuggestions.map((tip, i) => (
                    <p key={i} style={{ color:'rgba(239,246,255,0.85)', fontSize:'12px', lineHeight:'1.7', marginTop: i === 0 ? '14px' : '8px' }}>
                      {tip}
                    </p>
                  ))
                )}
                <button
                  onClick={() => selectedCampaign && navigate(`/dashboard/campaign/${selectedCampaign.id}`)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#eff6ff', fontSize:'12px', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px', marginTop:'14px', marginLeft:'auto', fontFamily:'inherit' }}
                >
                  View analytics
                  <ArrowRight size={12} />
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard