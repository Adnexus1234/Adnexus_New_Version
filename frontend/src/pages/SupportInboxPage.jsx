import React, { useState } from 'react'
import Sidebar, { LIGHT, DARK } from './Sidebar'
import AdminChatPanel from '../components/AdminChatPanel'

/**
 * Support Inbox page — same layout as the other dashboard pages
 * (sidebar on the left, content on the right; on phones the sidebar becomes
 * the hamburger top bar + drawer, handled by Sidebar.jsx).
 * Route in App.jsx:  <Route path="/support-inbox" element={<ProtectedRoute><SupportInboxPage /></ProtectedRoute>} />
 * The chats themselves are locked on the backend to the support account(s).
 */
const SupportInboxPage = () => {
  const [darkMode, setDarkMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const t = darkMode ? DARK : LIGHT

  return (
    <div style={{ display: 'flex', height: '100vh', background: t.pageBg, fontFamily: "'Inter',system-ui,-apple-system,sans-serif", fontSize: '13px' }}>
      <Sidebar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />
      {/* must be the element right after <Sidebar /> (the sidebar's mobile layout relies on it).
          flex column + minHeight 0 lets the inbox fill exactly the screen height, no page scroll */}
      <div style={{
        flex: 1, minWidth: 0, minHeight: 0,
        padding: 'clamp(8px, 2vw, 16px)',
        display: 'flex', flexDirection: 'column',
        boxSizing: 'border-box', overflow: 'hidden',
      }}>
        <AdminChatPanel />
      </div>
    </div>
  )
}

export default SupportInboxPage