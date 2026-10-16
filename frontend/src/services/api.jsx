import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'
})
// ── Auto-attach token to every request ──
// Har request jaane se pehle localStorage se token nikaal ke
// Authorization header mein daal deta hai. Isse har API function
// mein alag se token pass karne ki zaroorat nahi padti.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('adnexus_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Campaign APIs
export const createCampaign = (data) => API.post('/api/campaigns/', data)
export const getCampaigns = () => API.get('/api/campaigns/')
export const getCampaign = (id) => API.get(`/api/campaigns/${id}`)
export const updateCampaign = (id, data) => API.put(`/api/campaigns/${id}`, data)
export const deleteCampaign = (id) => API.delete(`/api/campaigns/${id}`)
export const getCampaignDetail = (id) => API.get(`/api/campaigns/${id}/detail`)
export const getCampaignStats = (id) => API.get(`/api/campaigns/${id}/stats`)  // ← naya
export const updateMe = (data) => API.patch('/api/auth/me', data)
export const changePassword = (data) => API.patch('/api/auth/me/password', data)

// Ad Content APIs
export const createAdContent = (campaignId, data) =>
  API.post(`/api/campaigns/${campaignId}/ad-content`, data)
export const getAdContents = (campaignId) =>
  API.get(`/api/campaigns/${campaignId}/ad-content`)
export const updateAdContent = (campaignId, adId, data) =>
  API.put(`/api/campaigns/${campaignId}/ad-content/${adId}`, data)

// Leads APIs
export const createLead = (data) => API.post('/api/leads/', data)
export const getLeads = () => API.get('/api/leads/')
export const getCampaignLeads = (campaignId) => API.get(`/api/leads/campaign/${campaignId}`)
export const updateLeadStatus = (id, data) => API.put(`/api/leads/${id}`, data)
export const deleteLead = (id) => API.delete(`/api/leads/${id}`)

// Referral APIs
export const getReferralSummary = () => API.get('/api/referral/summary')
export const getReferralList = () => API.get('/api/referral/list')
export const validateReferralCode = (code) => API.get(`/api/referral/validate/${code}`)

// Notification APIs
export const getNotifications = () => API.get('/api/notifications/')
export const getUnreadNotificationCount = () => API.get('/api/notifications/unread-count')
export const markNotificationRead = (id) => API.post(`/api/notifications/${id}/read`)
export const markAllNotificationsRead = () => API.post('/api/notifications/read-all')
export const dismissNotification = (id) => API.post(`/api/notifications/${id}/dismiss`)

// ════════════════════════════════════════════════════
// AUTH FUNCTIONS
// ════════════════════════════════════════════════════

export const signup = (data) => API.post('/api/auth/signup', data)

export const verifyOtp = (data) => API.post('/api/auth/verify-otp', data)

export const resendOtp = (data) => API.post('/api/auth/resend-otp', data)

export const login = (data) => API.post('/api/auth/login', data)

export const googleLogin = (data) => API.post('/api/auth/google', data)

export const getMe = (token) =>
  API.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  })

// NEW: forgot / reset password
export const forgotPassword = (data) => API.post('/api/auth/forgot-password', data)

export const verifyResetOtp = (data) => API.post('/api/auth/verify-reset-otp', data)

export const resetPassword = (data) => API.post('/api/auth/reset-password', data)

// FIXED: was using lowercase `api.post` (undefined) — now uses the `API` instance
export const uploadPhoto = (formData) =>
  API.post('/api/auth/me/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const syncPlatformStats = (campaignId) =>
  API.post(`/api/campaigns/${campaignId}/sync-stats`)


// Places APIs (city autocomplete — session_token billing ke liye required)
export const placesAutocomplete = (input, sessionToken) =>
  API.get('/api/places/autocomplete', { params: { input, session_token: sessionToken } })

export const placesDetails = (placeId, sessionToken) =>
  API.get('/api/places/details', { params: { place_id: placeId, session_token: sessionToken } })

// Design Templates APIs
export const getDesignTemplates = (industry) =>
  API.get('/api/templates', { params: { industry } })

export const getDesignTemplate = (id) => API.get(`/api/templates/${id}`)

export const saveUserDesign = (data) => API.post('/api/designs', data)

export const getUserDesigns = () => API.get('/api/designs')