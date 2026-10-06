import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Users, Megaphone, Activity, UserPlus, Wallet, CreditCard,
  Search, ArrowLeft, Download, ChevronLeft, ChevronRight,
  X, ChevronUp, ChevronDown, Gift, Image,
} from 'lucide-react'

// ══════════════════════════════════════════════════════════════
// Token key matches AuthContext.jsx exactly: "adnexus_token".
// axios.defaults.headers.common['Authorization'] is already set
// globally by AuthContext after login, but we also read the raw
// token here for the plain fetch() calls below.
// ══════════════════════════════════════════════════════════════
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000') + '/api'

const authHeaders = () => {
  const token = localStorage.getItem('adnexus_token')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// Icon + accent color per stat card — purely visual, keyed off the same
// overview fields the API already returns. No new data required.
// Colors are lighter/softer tints (pastel bg, medium-tone icon) for a
// less flat feel than solid saturated fills.
// cardBg = the full pastel card background (like the dashboard's colored
// stat cards); iconBg/fg are the small icon chip sitting on top of it.
const STAT_META = {
  total_users: { label: 'Total Users', cardBg: '#E0EDFF', iconBg: 'rgba(255,255,255,0.7)', fg: '#3B6FE0', icon: <Users size={20} strokeWidth={2} /> },
  total_campaigns: { label: 'Total Campaigns', cardBg: '#EDE4FF', iconBg: 'rgba(255,255,255,0.7)', fg: '#8B5CF6', icon: <Megaphone size={20} strokeWidth={2} /> },
  active_campaigns: { label: 'Active Campaigns', cardBg: '#DAF5E4', iconBg: 'rgba(255,255,255,0.7)', fg: '#1FA971', icon: <Activity size={20} strokeWidth={2} /> },
  total_leads: { label: 'Total Leads', cardBg: '#FDF0D5', iconBg: 'rgba(255,255,255,0.7)', fg: '#D9860F', icon: <UserPlus size={20} strokeWidth={2} /> },
  total_budget: { label: 'Total Budget', cardBg: '#D6F0FA', iconBg: 'rgba(255,255,255,0.7)', fg: '#0EA5C4', icon: <Wallet size={20} strokeWidth={2} /> },
  total_budget_spent: { label: 'Budget Spent', cardBg: '#FBDDDD', iconBg: 'rgba(255,255,255,0.7)', fg: '#E24545', icon: <CreditCard size={20} strokeWidth={2} /> },
}

const initials = (name = '') => name.trim().charAt(0).toUpperCase() || '?'

// ══════════════════════════════════════════════════════════════
// NEW — CSV export helpers.
// escapeCSV wraps any value containing a comma/quote/newline in
// quotes and doubles internal quotes, per standard CSV rules —
// otherwise a name like "Sharma, Rohit" would break columns.
// downloadCSV builds the file client-side (Blob) and triggers a
// browser download via a throwaway <a> tag — no backend call
// needed since the rows are already sitting in state.
// ══════════════════════════════════════════════════════════════
const escapeCSV = (val) => {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const downloadCSV = (headers, rows, filename) => {
  const csvContent = [headers, ...rows]
    .map(row => row.map(escapeCSV).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }) // BOM so Excel reads ₹/UTF-8 correctly
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const PaginationBar = ({ activeRows, page, setPage, totalPages, pageNumbers, PAGE_SIZE, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #F3F4F6', flexWrap: 'wrap', gap: '10px' }}>
    <span style={{ fontSize: '12px', color: '#6B7280' }}>
      Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, activeRows.length)} of {activeRows.length} {label}
    </span>
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <button
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
        style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#fff', color: page === 1 ? '#D1D5DB' : '#4B5563', cursor: page === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      ><ChevronLeft size={15} /></button>
      {pageNumbers.map(p => (
        <button
          key={p}
          onClick={() => setPage(p)}
          style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid ' + (p === page ? '#818CF8' : '#E5E7EB'), background: p === page ? '#818CF8' : '#fff', color: p === page ? '#fff' : '#374151', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit' }}
        >{p}</button>
      ))}
      <button
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
        style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#fff', color: page === totalPages ? '#D1D5DB' : '#4B5563', cursor: page === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      ><ChevronRight size={15} /></button>
    </div>
  </div>
)

const AVATAR_COLORS = ['#EEF2FF', '#F3E8FF', '#DCFCE7', '#FFEDD5', '#FEE2E2', '#E0F2FE']
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0]

const AdminDashboard = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState('users')
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [leads, setLeads] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [selectedReferrals, setSelectedReferrals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const PAGE_SIZE = 10

  // ══════════════════════════════════════════════════════════════
  // NEW — search, per-tab status filters, and column sorting.
  // searchQuery + sort are shared across tabs but reset on tab
  // switch (columns differ per tab). Status filters are kept as
  // separate state per tab so switching tabs doesn't lose them.
  // ══════════════════════════════════════════════════════════════
  const [searchQuery, setSearchQuery] = useState('')
  const [userVerifiedFilter, setUserVerifiedFilter] = useState('all')
  const [userAssociateFilter, setUserAssociateFilter] = useState('all')
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('all')
  const [leadPlatformFilter, setLeadPlatformFilter] = useState('all')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [hoveredRow, setHoveredRow] = useState(null)

  const SEARCH_PLACEHOLDER = {
    users: 'Search by name or email...',
    campaigns: 'Search by campaign or owner...',
    leads: 'Search by name, phone, email or campaign...',
  }

  const selectStyle = { padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: '#fff', color: '#374151', cursor: 'pointer' }

  const clearTabFilters = () => {
    setSearchQuery('')
    if (tab === 'users') { setUserVerifiedFilter('all'); setUserAssociateFilter('all') }
    if (tab === 'campaigns') setCampaignStatusFilter('all')
    if (tab === 'leads') setLeadPlatformFilter('all')
  }

  const hasActiveTabFilters =
    !!searchQuery ||
    (tab === 'users' && (userVerifiedFilter !== 'all' || userAssociateFilter !== 'all')) ||
    (tab === 'campaigns' && campaignStatusFilter !== 'all') ||
    (tab === 'leads' && leadPlatformFilter !== 'all')

  const handleSort = (key) => {
    if (!key) return
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const getSortValue = (row, key) => {
    switch (key) {
      case 'name': return (row.name || '').toLowerCase()
      case 'full_name': return (row.full_name || '').toLowerCase()
      case 'email': return (row.email || '').toLowerCase()
      case 'auth_provider': return (row.auth_provider || '').toLowerCase()
      case 'is_verified': return row.is_verified ? 1 : 0
      case 'campaign_count': return Number(row.campaign_count || 0)
      case 'referral_count': return Number(row.referral_count || 0)
      case 'total_budget': return Number(row.total_budget || 0)
      case 'total_budget_spent': return Number(row.total_budget_spent || 0)
      case 'created_at': return new Date(row.created_at).getTime() || 0
      case 'owner_name': return (row.owner_name || '').toLowerCase()
      case 'goal': return (row.goal || '').toLowerCase()
      case 'industry': return (row.industry || '').toLowerCase()
      case 'status': return (row.status || '').toLowerCase()
      case 'budget': return Number(row.budget || 0)
      case 'budget_spent': return Number(row.budget_spent || 0)
      case 'phone': return (row.phone || '').toLowerCase()
      case 'campaign_name': return (row.campaign_name || '').toLowerCase()
      case 'platform': return (row.platform || '').toLowerCase()
      case 'quality_score': return Number(row.quality_score || 0)
      default: return ''
    }
  }

  const sortRows = (rows) => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const va = getSortValue(a, sortKey)
      const vb = getSortValue(b, sortKey)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }

  const USERS_HEADERS = [
    { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' }, { label: 'Provider', key: 'auth_provider' },
    { label: 'Verified', key: 'is_verified' }, { label: 'Associate', key: null }, { label: 'Campaigns', key: 'campaign_count' },
    { label: 'Referrals', key: 'referral_count' }, { label: 'Total Budget', key: 'total_budget' },
    { label: 'Budget Spent', key: 'total_budget_spent' }, { label: 'Joined', key: 'created_at' }, { label: '', key: null },
  ]
  const CAMPAIGNS_HEADERS = [
    { label: 'Campaign', key: 'name' }, { label: 'Owner', key: 'owner_name' }, { label: 'Goal', key: 'goal' },
    { label: 'Industry', key: 'industry' }, { label: 'Status', key: 'status' }, { label: 'Daily Budget', key: 'budget' },
    { label: 'Total Budget', key: 'total_budget' }, { label: 'Spent', key: 'budget_spent' }, { label: 'Created', key: 'created_at' },
    { label: '', key: null },
  ]
  const LEADS_HEADERS = [
    { label: 'Name', key: 'full_name' }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' },
    { label: 'Campaign', key: 'campaign_name' }, { label: 'Platform', key: 'platform' }, { label: 'Quality', key: 'quality_score' },
    { label: 'Received', key: 'created_at' },
  ]

  const renderSortableTh = (h, i) => (
    <th
      key={`${h.label}-${i}`}
      onClick={() => handleSort(h.key)}
      style={{
        padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase',
        letterSpacing: '0.03em', cursor: h.key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap',
        borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #F0F1F3',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        {h.label}
        {sortKey === h.key && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  )

  // Shared row style: subtle vertical dividers + hover highlight so the
  // grid reads clearly as a table instead of loose stacked text.
  const trStyle = (rowId) => ({
    borderTop: '1px solid #F3F4F6',
    background: hoveredRow === rowId ? '#F9FAFB' : '#fff',
    transition: 'background 0.12s',
  })
  const tdStyle = (extra = {}) => ({ padding: '12px 16px', borderRight: '1px solid #F6F7F9', ...extra })

    const toYMD = (d) => {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  }

  const setPreset = (days) => {
    const today = new Date()
    const from = new Date()
    from.setDate(today.getDate() - (days - 1))
    setDateFrom(toYMD(from))
    setDateTo(toYMD(today))
  }

  const clearDates = () => { setDateFrom(''); setDateTo('') }

  const qs = () => {
    const p = new URLSearchParams()
    if (dateFrom) p.set('date_from', dateFrom)
    if (dateTo) p.set('date_to', dateTo)
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  useEffect(() => { fetchOverview() }, [dateFrom, dateTo])
  useEffect(() => { setPage(1) }, [tab, dateFrom, dateTo, searchQuery, userVerifiedFilter, userAssociateFilter, campaignStatusFilter, leadPlatformFilter, sortKey, sortDir])
  // Search text and sort are tab-specific in meaning (different columns), so clear them on tab switch.
  // Status filters are left alone since each tab keeps its own filter state independently.
  useEffect(() => { setSearchQuery(''); setSortKey(null); setSortDir('asc') }, [tab])
  useEffect(() => {
    if (tab === 'users') fetchUsers()
    if (tab === 'campaigns') fetchCampaigns()
    if (tab === 'leads') fetchLeads()
  }, [tab, dateFrom, dateTo])

  const handleAuthError = (status) => {
    if (status === 403) {
      setError('Access denied — this account is not an admin.')
    } else if (status === 401) {
      setError('Session expired. Please log in again.')
      navigate('/login')
    } else {
      setError('Something went wrong fetching admin data.')
    }
  }

  const fetchOverview = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/overview${qs()}`, { headers: authHeaders() })
      if (!res.ok) return handleAuthError(res.status)
      setOverview(await res.json())
    } catch (e) { setError('Could not reach server.') }
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/users${qs()}`, { headers: authHeaders() })
      if (!res.ok) return handleAuthError(res.status)
      const data = await res.json()
      setUsers(data.users || [])
    } catch (e) { setError('Could not reach server.') } finally { setLoading(false) }
  }

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/campaigns${qs()}`, { headers: authHeaders() })
      if (!res.ok) return handleAuthError(res.status)
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch (e) { setError('Could not reach server.') } finally { setLoading(false) }
  }

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/leads${qs()}`, { headers: authHeaders() })
      if (!res.ok) return handleAuthError(res.status)
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (e) { setError('Could not reach server.') } finally { setLoading(false) }
  }

  const openUserDetail = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, { headers: authHeaders() })
      if (!res.ok) return handleAuthError(res.status)
      setSelectedUser(await res.json())
    } catch (e) { setError('Could not load user detail.') }
  }

  const openCampaignDetail = async (campaignId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/campaigns/${campaignId}${qs()}`, { headers: authHeaders() })
      if (!res.ok) return handleAuthError(res.status)
      setSelectedCampaign(await res.json())
    } catch (e) { setError('Could not load campaign detail.') }
  }

  // Users table mein referral_count pe click hone par ye khulta hai —
  // us user ne kisko-kisko refer kiya, naam + campaigns count ke saath
  const openReferralsDetail = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/referrals${qs()}`, { headers: authHeaders() })
      if (!res.ok) return handleAuthError(res.status)
      setSelectedReferrals(await res.json())
    } catch (e) { setError('Could not load referral detail.') }
  }

  // ══════════════════════════════════════════════════════════════
  // NEW — B (referee) ka payment admin ne verify kar diya, tick karo.
  // Backend khud check karta hai ki A (referrer) verified hai ya
  // nahi — agar nahi, referral "on_hold" reh jayega. Modal ko turant
  // refresh kar dete hain taaki naya status turant dikhe.
  // ══════════════════════════════════════════════════════════════
  const markPaymentReceived = async (referralId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/referrals/${referralId}/mark-payment-received`, {
        method: 'PATCH',
        headers: authHeaders(),
      })
      if (!res.ok) return handleAuthError(res.status)
      if (selectedReferrals?.referrer_id) {
        openReferralsDetail(selectedReferrals.referrer_id)
      }
    } catch (e) {
      setError('Could not update payment status.')
    }
  }

  // ══════════════════════════════════════════════════════════════
  // NEW — A ko actual mein manually commission pay kar diya, tick karo.
  // Sirf tab allowed jab commission already "completed" ho chuka ho.
  // ══════════════════════════════════════════════════════════════
  const grantReward = async (referralId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/referrals/${referralId}/grant-reward`, {
        method: 'PATCH',
        headers: authHeaders(),
      })
      if (!res.ok) return handleAuthError(res.status)
      if (selectedReferrals?.referrer_id) {
        openReferralsDetail(selectedReferrals.referrer_id)
      }
    } catch (e) {
      setError('Could not update reward status.')
    }
  }

  // ══════════════════════════════════════════════════════════════
  // NEW — A khud apna ₹10,000 associate-fee pay kar chuka hai, tick karo.
  // Backend automatically A ke pehle se "on_hold" pade referrals ko
  // bhi release kar deta hai (jahan B ka payment pehle se verified tha).
  // ══════════════════════════════════════════════════════════════
  const markPaidAssociate = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/mark-paid-associate`, {
        method: 'PATCH',
        headers: authHeaders(),
      })
      if (!res.ok) return handleAuthError(res.status)
      fetchUsers()
    } catch (e) {
      setError('Could not update associate status.')
    }
  }

  // ══════════════════════════════════════════════════════════════
  // NEW — apply search text + tab-specific status filter, then sort.
  // Filter options for campaigns/leads are built from whatever
  // status/platform values actually exist in the fetched data, so
  // the dropdown never goes stale against the backend's real values.
  // ══════════════════════════════════════════════════════════════
  const q = searchQuery.trim().toLowerCase()

  const filteredUsers = users.filter(u => {
    const matchesSearch = !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    const matchesVerified = userVerifiedFilter === 'all' || (userVerifiedFilter === 'verified' ? u.is_verified : !u.is_verified)
    const matchesAssociate = userAssociateFilter === 'all' || (userAssociateFilter === 'paid' ? u.is_paid_associate : !u.is_paid_associate)
    return matchesSearch && matchesVerified && matchesAssociate
  })

  const campaignStatusOptions = [...new Set(campaigns.map(c => c.status).filter(Boolean))]
  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = !q || (c.name || '').toLowerCase().includes(q) || (c.owner_name || '').toLowerCase().includes(q) || (c.owner_email || '').toLowerCase().includes(q)
    const matchesStatus = campaignStatusFilter === 'all' || c.status === campaignStatusFilter
    return matchesSearch && matchesStatus
  })

  const leadPlatformOptions = [...new Set(leads.map(l => l.platform).filter(Boolean))]
  const filteredLeads = leads.filter(l => {
    const matchesSearch = !q || (l.full_name || '').toLowerCase().includes(q) || (l.phone || '').toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q) || (l.campaign_name || '').toLowerCase().includes(q)
    const matchesPlatform = leadPlatformFilter === 'all' || l.platform === leadPlatformFilter
    return matchesSearch && matchesPlatform
  })

  const activeRows = sortRows(tab === 'users' ? filteredUsers : tab === 'campaigns' ? filteredCampaigns : filteredLeads)
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE))
  const pagedRows = activeRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageWindowStart = Math.max(1, Math.min(page - 2, totalPages - 4))
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => pageWindowStart + i).filter(n => n >= 1 && n <= totalPages)

  // ══════════════════════════════════════════════════════════════
  // NEW — CSV export for whichever tab is currently active.
  // Exports exactly what's on screen — after search, status filter,
  // and sort are applied (activeRows, not the raw fetched array) —
  // not just the current page, with a filename capturing tab, date
  // range, and today's date.
  // ══════════════════════════════════════════════════════════════
  const handleExportCSV = () => {
    let headers = []
    let rows = []

    if (tab === 'users') {
      headers = ['Name', 'Email', 'Provider', 'Verified', 'Paid Associate', 'Campaigns', 'Referrals', 'Total Budget (₹)', 'Budget Spent (₹)', 'Joined']
      rows = activeRows.map(u => [
        u.name,
        u.email,
        u.auth_provider,
        u.is_verified ? 'Yes' : 'No',
        u.is_paid_associate ? 'Yes' : 'No',
        u.campaign_count,
        u.referral_count,
        Number(u.total_budget || 0),
        Number(u.total_budget_spent || 0),
        new Date(u.created_at).toLocaleDateString(),
      ])
    } else if (tab === 'campaigns') {
      headers = ['Campaign', 'Owner Name', 'Owner Email', 'Goal', 'Industry', 'Status', 'Daily Budget (₹)', 'Total Budget (₹)', 'Spent (₹)', 'Created']
      rows = activeRows.map(c => [
        c.name,
        c.owner_name,
        c.owner_email,
        c.goal,
        c.industry,
        c.status,
        Number(c.budget || 0),
        Number(c.total_budget || 0),
        Number(c.budget_spent || 0),
        new Date(c.created_at).toLocaleDateString(),
      ])
    } else {
      headers = ['Name', 'Phone', 'Email', 'Campaign', 'Platform', 'Quality Score', 'Received']
      rows = activeRows.map(l => [
        l.full_name,
        l.phone,
        l.email,
        l.campaign_name,
        l.platform,
        l.quality_score,
        new Date(l.created_at).toLocaleDateString(),
      ])
    }

    if (rows.length === 0) return // nothing to export — button stays disabled anyway, this is a safety net

    const dateSuffix = (dateFrom || dateTo) ? `_${dateFrom || 'start'}_to_${dateTo || 'now'}` : ''
    const filename = `adnexus_${tab}${dateSuffix}_exported_${toYMD(new Date())}.csv`
    downloadCSV(headers, rows, filename)
  }

  if (error) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'inherit' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#DC2626' }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', background: '#F8FAFC', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', marginBottom: '16px',
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px',
            fontSize: '13px', fontWeight: '600', color: '#374151',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#111827', marginBottom: '4px', letterSpacing: '-0.02em' }}>Admin Dashboard</h2>
        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>All users, campaigns, and leads across AdNexus.</p>
                {/* ── Date filter ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Date</span>
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
          <span style={{ fontSize: '13px', color: '#9CA3AF' }}>to</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit' }} />

          {[{ label: 'Today', d: 1 }, { label: '7 Days', d: 7 }, { label: '30 Days', d: 30 }].map(p => (
            <button key={p.label} onClick={() => setPreset(p.d)}
              style={{ padding: '7px 12px', border: '1px solid #E5E7EB', background: '#F8FAFF', color: '#818CF8', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {p.label}
            </button>
          ))}

          {(dateFrom || dateTo) && (
            <button onClick={clearDates}
              style={{ padding: '7px 12px', border: 'none', background: '#FEE2E2', color: '#991B1B', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear
            </button>
          )}
        </div>

        {/* ── Search + status filter bar (tab-aware) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder={SEARCH_PLACEHOLDER[tab]}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {tab === 'users' && (
            <>
              <select value={userVerifiedFilter} onChange={e => setUserVerifiedFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Verification</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
              <select value={userAssociateFilter} onChange={e => setUserAssociateFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Associates</option>
                <option value="paid">Paid Associate</option>
                <option value="unpaid">Not Paid</option>
              </select>
            </>
          )}

          {tab === 'campaigns' && (
            <select value={campaignStatusFilter} onChange={e => setCampaignStatusFilter(e.target.value)} style={selectStyle}>
              <option value="all">All Statuses</option>
              {campaignStatusOptions.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
            </select>
          )}

          {tab === 'leads' && (
            <select value={leadPlatformFilter} onChange={e => setLeadPlatformFilter(e.target.value)} style={selectStyle}>
              <option value="all">All Platforms</option>
              {leadPlatformOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          {hasActiveTabFilters && (
            <button onClick={clearTabFilters}
              style={{ padding: '8px 12px', border: 'none', background: '#FEE2E2', color: '#991B1B', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Clear Filters
            </button>
          )}
        </div>

        {/* ── Overview cards ── */}
        {overview && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            {[
              { key: 'total_users', value: overview.total_users },
              { key: 'total_campaigns', value: overview.total_campaigns },
              { key: 'active_campaigns', value: overview.active_campaigns },
              { key: 'total_leads', value: overview.total_leads },
              { key: 'total_budget', value: `₹${Number(overview.total_budget || 0).toLocaleString()}` },
              { key: 'total_budget_spent', value: `₹${Number(overview.total_budget_spent || 0).toLocaleString()}` },
            ].map((card) => {
              const meta = STAT_META[card.key]
              return (
                <div key={card.key} style={{ background: meta.cardBg, border: 'none', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: meta.iconBg, color: meta.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                    {meta.icon}
                  </div>
                  <div style={{ fontSize: '12px', color: '#57606B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '8px' }}>{meta.label}</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827' }}>{card.value}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Tabs + Export ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '0', borderBottom: '1px solid #E5E7EB', background: '#fff', borderRadius: '14px 14px 0 0', padding: '4px 16px 0', flexWrap: 'wrap', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'users', label: 'Users' },
              { id: 'campaigns', label: 'Campaigns' },
              { id: 'leads', label: 'Leads' },
            ].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
                  color: tab === t.id ? '#818CF8' : '#6B7280',
                  borderBottom: tab === t.id ? '2.5px solid #818CF8' : '2.5px solid transparent',
                  marginBottom: '-1px',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* NEW — Export CSV button. Disabled + greyed out when the active tab has no rows to export. */}
          <button
            onClick={handleExportCSV}
            disabled={activeRows.length === 0}
            title={activeRows.length === 0 ? 'No data to export' : `Export ${tab} as CSV`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', marginBottom: '8px',
              background: activeRows.length === 0 ? '#F3F4F6' : '#EEF2FF',
              color: activeRows.length === 0 ? '#9CA3AF' : '#8B5CF6',
              border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: '700', fontFamily: 'inherit',
              cursor: activeRows.length === 0 ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>

        {loading && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: 'none', padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
            Loading...
          </div>
        )}

        {/* ── Users table ── */}
        {!loading && tab === 'users' && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFF', textAlign: 'left' }}>
                  {USERS_HEADERS.map(renderSortableTh)}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(u => (
                  <tr key={u.id} style={trStyle(u.id)} onMouseEnter={() => setHoveredRow(u.id)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={tdStyle()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: avatarColor(u.name), color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px' }}>
                          {initials(u.name)}
                        </div>
                        <span style={{ fontWeight: '600', color: '#111827' }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={tdStyle({ color: '#374151' })}>{u.email}</td>
                    <td style={tdStyle({ color: '#6B7280' })}>{u.auth_provider}</td>
                    <td style={tdStyle()}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: u.is_verified ? '#D1FAE5' : '#FEE2E2', color: u.is_verified ? '#065F46' : '#991B1B' }}>
                        {u.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    {/* NEW: Associate column — A ka apna ₹10,000 payment status */}
                    <td style={tdStyle()}>
                      {u.is_paid_associate ? (
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: '#D1FAE5', color: '#065F46' }}>
                          Paid Associate
                        </span>
                      ) : (
                        <button
                          onClick={() => markPaidAssociate(u.id)}
                          style={{ fontSize: '11px', fontWeight: '700', color: '#065F46', background: '#D1FAE5', border: 'none', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                    <td style={tdStyle({ color: '#374151' })}>{u.campaign_count}</td>
                    <td style={tdStyle()}>
                      {u.referral_count > 0 ? (
                        <button
                          onClick={() => openReferralsDetail(u.id)}
                          style={{ fontSize: '12px', fontWeight: '700', color: '#8B5CF6', background: '#EEF2FF', border: 'none', borderRadius: '20px', padding: '3px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          {u.referral_count}
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>0</span>
                      )}
                    </td>
                    <td style={tdStyle({ color: '#374151' })}>₹{Number(u.total_budget || 0).toLocaleString()}</td>
                    <td style={tdStyle({ color: '#374151' })}>₹{Number(u.total_budget_spent || 0).toLocaleString()}</td>
                    <td style={tdStyle({ color: '#9CA3AF' })}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => openUserDetail(u.id)} style={{ fontSize: '12px', color: '#818CF8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700', fontFamily: 'inherit' }}>View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {users.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>No users yet.</div>}
            {users.length > 0 && activeRows.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>No users match your search/filters.</div>}
            {activeRows.length > 0 && <PaginationBar activeRows={activeRows} page={page} setPage={setPage} totalPages={totalPages} pageNumbers={pageNumbers} PAGE_SIZE={PAGE_SIZE} label="users" />}
          </div>
        )}

        {/* ── Campaigns table ── */}
        {!loading && tab === 'campaigns' && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFF', textAlign: 'left' }}>
                  {CAMPAIGNS_HEADERS.map(renderSortableTh)}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(c => (
                  <tr key={c.id} style={trStyle(c.id)} onMouseEnter={() => setHoveredRow(c.id)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={tdStyle({ fontWeight: '600', color: '#111827' })}>{c.name}</td>
                    <td style={tdStyle({ color: '#374151' })}>{c.owner_name}<br /><span style={{ fontSize: '11px', color: '#9CA3AF' }}>{c.owner_email}</span></td>
                    <td style={tdStyle({ color: '#374151' })}>{c.goal}</td>
                    <td style={tdStyle({ color: '#374151' })}>{c.industry}</td>
                    <td style={tdStyle()}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: c.status === 'active' ? '#D1FAE5' : '#F3F4F6', color: c.status === 'active' ? '#065F46' : '#6B7280' }}>{c.status}</span>
                    </td>
                    <td style={tdStyle({ color: '#374151' })}>₹{Number(c.budget || 0).toLocaleString()}/day</td>
                    <td style={tdStyle({ color: '#374151' })}>₹{Number(c.total_budget || 0).toLocaleString()}</td>
                    <td style={tdStyle({ color: '#374151' })}>₹{Number(c.budget_spent || 0).toLocaleString()}</td>
                    <td style={tdStyle({ color: '#9CA3AF' })}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => openCampaignDetail(c.id)} style={{ fontSize: '12px', color: '#818CF8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700', fontFamily: 'inherit' }}>View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {campaigns.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>No campaigns yet.</div>}
            {campaigns.length > 0 && activeRows.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>No campaigns match your search/filters.</div>}
            {activeRows.length > 0 && <PaginationBar activeRows={activeRows} page={page} setPage={setPage} totalPages={totalPages} pageNumbers={pageNumbers} PAGE_SIZE={PAGE_SIZE} label="campaigns" />}
          </div>
        )}

        {/* ── Leads table ── */}
        {!loading && tab === 'leads' && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFF', textAlign: 'left' }}>
                  {LEADS_HEADERS.map(renderSortableTh)}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(l => (
                  <tr key={l.id} style={trStyle(l.id)} onMouseEnter={() => setHoveredRow(l.id)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={tdStyle({ fontWeight: '600', color: '#111827' })}>{l.full_name}</td>
                    <td style={tdStyle({ color: '#374151' })}>{l.phone}</td>
                    <td style={tdStyle({ color: '#374151' })}>{l.email}</td>
                    <td style={tdStyle({ color: '#374151' })}>{l.campaign_name}</td>
                    <td style={tdStyle({ color: '#374151' })}>{l.platform}</td>
                    <td style={tdStyle({ color: '#374151' })}>{l.quality_score}</td>
                    <td style={{ padding: '12px 16px', color: '#9CA3AF' }}>{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {leads.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>No leads yet.</div>}
            {leads.length > 0 && activeRows.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>No leads match your search/filters.</div>}
            {activeRows.length > 0 && <PaginationBar activeRows={activeRows} page={page} setPage={setPage} totalPages={totalPages} pageNumbers={pageNumbers} PAGE_SIZE={PAGE_SIZE} label="leads" />}
          </div>
        )}

        {/* ── User detail modal ── */}
        {selectedUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
            onClick={() => setSelectedUser(null)}>
            <div style={{ background: '#fff', borderRadius: '20px', width: '640px', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}>

              {/* Header banner */}
              <div style={{ background: 'linear-gradient(135deg, #818CF8 0%, #8B5CF6 100%)', padding: '24px 28px', position: 'relative' }}>
                <button onClick={() => setSelectedUser(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '8px', width: '28px', height: '28px', fontSize: '15px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15}/></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '19px' }}>
                    {initials(selectedUser.user.name)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '19px', fontWeight: '800', color: '#fff' }}>{selectedUser.user.name}</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 9px', borderRadius: '20px', background: selectedUser.user.is_verified ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)', color: selectedUser.user.is_verified ? '#065F46' : '#fff' }}>
                        {selectedUser.user.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{selectedUser.user.email}</div>
                  </div>
                </div>
              </div>

              {/* Stat strip */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #F0F1F3' }}>
                <div style={{ padding: '14px 20px', borderRight: '1px solid #F0F1F3' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '3px' }}>Campaigns</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>{selectedUser.campaigns.length}</div>
                </div>
                <div style={{ padding: '14px 20px', borderRight: '1px solid #F0F1F3' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '3px' }}>Total Spent</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>
                    ₹{selectedUser.campaigns.reduce((s, c) => s + Number(c.budget_spent || 0), 0).toLocaleString()}
                  </div>
                </div>
                <div style={{ padding: '14px 20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '3px' }}>Total Leads</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>
                    {selectedUser.campaigns.reduce((s, c) => s + Number(c.leads_count || 0), 0)}
                  </div>
                </div>
              </div>
              {/* Scrollable body */}
              <div style={{ padding: '20px 28px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: '#F5F3FF', color: '#A78BFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Megaphone size={14} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>Campaigns ({selectedUser.campaigns.length})</div>
                </div>
                {selectedUser.campaigns.map(c => (
                  <div key={c.id}
                    onClick={() => { setSelectedUser(null); openCampaignDetail(c.id) }}
                    style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '13px 14px', marginBottom: '8px', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#111827' }}>{c.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: c.status === 'active' ? '#D1FAE5' : '#F3F4F6', color: c.status === 'active' ? '#065F46' : '#6B7280' }}>{c.status}</span>
                        <ChevronRight size={14} color="#9CA3AF" />
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: c.ad_contents.length > 0 ? '6px' : '0' }}>
                      {c.goal} · {c.industry} · ₹{Number(c.budget_spent || 0).toLocaleString()} spent · {c.leads_count} leads
                    </div>
                    {c.ad_contents.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                        {c.ad_contents.length} ad creative{c.ad_contents.length > 1 ? 's' : ''} · avg score {(
                          c.ad_contents.reduce((s, ac) => s + (ac.creative_score || 0), 0) / c.ad_contents.length
                        ).toFixed(0)}/100
                      </div>
                    )}
                  </div>
                ))}
                {selectedUser.campaigns.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px', background: '#F9FAFB', borderRadius: '12px' }}>No campaigns created yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Campaign detail modal ── */}
        {selectedCampaign && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
            onClick={() => setSelectedCampaign(null)}>
            <div style={{ background: '#fff', borderRadius: '20px', width: '640px', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}>

              {/* Header banner */}
              <div style={{ background: 'linear-gradient(135deg, #818CF8 0%, #8B5CF6 100%)', padding: '24px 28px', position: 'relative' }}>
                <button onClick={() => setSelectedCampaign(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '8px', width: '28px', height: '28px', fontSize: '15px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15}/></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: selectedCampaign.campaign.status === 'active' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)', color: selectedCampaign.campaign.status === 'active' ? '#065F46' : '#fff', textTransform: 'capitalize' }}>
                    {selectedCampaign.campaign.status}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>{selectedCampaign.campaign.goal}</span>
                </div>
                <div style={{ fontSize: '21px', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>{selectedCampaign.campaign.name}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
                  {selectedCampaign.campaign.owner_name} · {selectedCampaign.campaign.owner_email}
                </div>
              </div>

               {/* Stat strip */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: '1px solid #F0F1F3' }}>
                <div style={{ padding: '14px 20px', borderRight: '1px solid #F0F1F3' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '3px' }}>Industry</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>{selectedCampaign.campaign.industry}</div>
                </div>
                <div style={{ padding: '14px 20px', borderRight: '1px solid #F0F1F3' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '3px' }}>Budget / day</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>₹{Number(selectedCampaign.campaign.budget || 0).toLocaleString()}</div>
                </div>
                <div style={{ padding: '14px 20px', borderRight: '1px solid #F0F1F3' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '3px' }}>Total Budget</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>₹{Number(selectedCampaign.campaign.total_budget || 0).toLocaleString()}</div>
                </div>
                <div style={{ padding: '14px 20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '3px' }}>Spent</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>₹{Number(selectedCampaign.campaign.budget_spent || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Scrollable body */}
              <div style={{ padding: '20px 28px', overflowY: 'auto' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: '#FFF7ED', color: '#FB923C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={14} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>Leads ({selectedCampaign.leads.length})</div>
                </div>
                {selectedCampaign.leads.map(l => (
                  <div key={l.id} style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '13px 14px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#111827', marginBottom: '3px' }}>{l.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>{l.phone} · {l.email}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '3px' }}>{l.platform}</div>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#EEF2FF', color: '#8B5CF6' }}>Q {l.quality_score}</span>
                    </div>
                  </div>
                ))}
                {selectedCampaign.leads.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px', background: '#F9FAFB', borderRadius: '12px', marginBottom: '8px' }}>No leads yet.</div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '22px 0 12px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: '#F5F3FF', color: '#A78BFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image size={14} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>Ad Creatives ({selectedCampaign.ad_contents.length})</div>
                </div>
                {selectedCampaign.ad_contents.map(ac => (
                  <div key={ac.id} style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '13px 14px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>{ac.headline || ac.description || 'Ad creative'}</div>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#DCFCE7', color: '#34D399', flexShrink: 0 }}>{ac.creative_score ?? '—'}/100</span>
                  </div>
                ))}
                {selectedCampaign.ad_contents.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px', background: '#F9FAFB', borderRadius: '12px' }}>No ad creatives yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Referrals detail modal ── */}
        {selectedReferrals && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
            onClick={() => setSelectedReferrals(null)}>
            <div style={{ background: '#fff', borderRadius: '20px', width: '640px', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}>

              {/* Header banner */}
              <div style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)', padding: '24px 28px', position: 'relative' }}>
                <button onClick={() => setSelectedReferrals(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '8px', width: '28px', height: '28px', fontSize: '15px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15}/></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Gift size={13} color="rgba(255,255,255,0.85)" />
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Referred by</div>
                </div>
                <div style={{ fontSize: '21px', fontWeight: '800', color: '#fff' }}>{selectedReferrals.referrer_name}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
                  {selectedReferrals.referrals.length} referral{selectedReferrals.referrals.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Scrollable body */}
              <div style={{ padding: '20px 28px', overflowY: 'auto' }}>
                {selectedReferrals.referrals.map(r => (
                  <div key={r.id} style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '13px 14px', marginBottom: '8px' }}>
                    {/* Top row: avatar/name/joined + status badge/campaigns count */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: r.payment_received ? '10px' : '0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: avatarColor(r.name), color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px', flexShrink: 0 }}>
                          {initials(r.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: '#111827' }}>{r.name}</div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                            Joined {r.joined_at ? new Date(r.joined_at).toLocaleDateString() : '—'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {/* NEW: status badge ab "on_hold" ko bhi handle karta hai */}
                        <span style={{
                          fontSize: '10px', fontWeight: '700', padding: '2px 9px', borderRadius: '20px',
                          background: r.status === 'completed' ? '#D1FAE5' : r.status === 'on_hold' ? '#FEE2E2' : '#FEF3C7',
                          color: r.status === 'completed' ? '#065F46' : r.status === 'on_hold' ? '#991B1B' : '#92400E',
                          display: 'inline-block', marginBottom: '5px',
                        }}>
                          {r.status === 'completed' ? 'Completed' : r.status === 'on_hold' ? 'On Hold' : 'Pending'}
                        </span>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>{r.campaigns_count} campaign{r.campaigns_count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>

                    {/* NEW: Payment / Reward action row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: r.payment_received ? '10px' : '0', borderTop: r.payment_received ? '1px solid #F3F4F6' : 'none' }}>
                      {r.commission_amount > 0 && (
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#111827' }}>₹{r.commission_amount.toLocaleString()}</span>
                      )}

                      <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                        {!r.payment_received ? (
                          <button
                            onClick={() => markPaymentReceived(r.id)}
                            style={{ fontSize: '11px', fontWeight: '700', color: '#065F46', background: '#D1FAE5', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Mark Payment Received
                          </button>
                        ) : !r.reward_granted ? (
                          <button
                            onClick={() => grantReward(r.id)}
                            disabled={r.status !== 'completed'}
                            title={r.status !== 'completed' ? 'Referrer not yet a verified associate — commission on hold' : ''}
                            style={{
                              fontSize: '11px', fontWeight: '700', color: r.status === 'completed' ? '#1E3A8A' : '#9CA3AF',
                              background: r.status === 'completed' ? '#DBEAFE' : '#F3F4F6', border: 'none', borderRadius: '8px',
                              padding: '6px 12px', cursor: r.status === 'completed' ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                            }}
                          >
                            Grant Reward
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#8B5CF6', background: '#EEF2FF', borderRadius: '8px', padding: '6px 12px' }}>
                            ✓ Reward Paid
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {selectedReferrals.referrals.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px', background: '#F9FAFB', borderRadius: '12px' }}>No referrals yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard