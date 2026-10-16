import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * AdNexus Support Inbox
 * ---------------------
 * Screen for the dedicated support user: lists chats waiting for a human,
 * lets them read the conversation, reply, and close the chat.
 *
 * Backend (chat_router.py admin_router, mounted at /api/admin):
 *   GET  /admin/chat/sessions?status=pending_human,answered
 *   GET  /admin/chat/sessions/{id}/messages
 *   POST /admin/chat/sessions/{id}/reply   { message }
 *   POST /admin/chat/sessions/{id}/close
 *
 * !! Change TOKEN_KEY below to whatever key your app stores the login token under
 *    (DevTools -> Application -> Local Storage). It is sent as a Bearer token so
 *    the admin routes can be locked down to the support user.
 */

const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000/api" : "/api");

const TOKEN_KEY = "token"; // <-- change if your login token is stored under another key
 
// Looks for the login token: first under TOKEN_KEY, otherwise the first value in
// localStorage / sessionStorage that looks like a JWT (starts with "eyJ").
function getToken() {
  const clean = (v) => (v ? v.replace(/^"|"$/g, "") : v);
  const direct = clean(localStorage.getItem(TOKEN_KEY));
  if (direct) return direct;
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const v = clean(store.getItem(store.key(i)));
      if (v && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)) return v;
    }
  }
  return null;
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function timeAgo(iso) {
  if (!iso) return "";
  // backend stores UTC without a "Z"
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// true on phones / small tablets -> list and chat are shown one at a time
function useIsMobile(bp = 768) {
  const get = () => typeof window !== "undefined" && window.matchMedia(`(max-width:${bp}px)`).matches;
  const [isMobile, setIsMobile] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [bp]);
  return isMobile;
}

export default function AdminChatPanel() {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const isMobile = useIsMobile();

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/chat/sessions?status=pending_human,answered`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setError("Login not detected (401). Please log in again with the support account.");
        return;
      }
      if (res.status === 403) {
        setError("This account is not a support account (403). Log in with the support user's email.");
        return;
      }
      if (!res.ok) throw new Error("failed to load chats");
      setSessions(await res.json());
      setError("");
    } catch {
      setError("Could not load chats. Check that the backend is running.");
    }
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/admin/chat/sessions/${id}/messages`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("failed to load messages");
      const data = await res.json();
      setMessages(data.messages || []);
      setStatus(data.status);
    } catch {
      /* keep what is on screen */
    }
  }, []);

  // poll the chat list
  useEffect(() => {
    loadSessions();
    const t = setInterval(loadSessions, 8000);
    return () => clearInterval(t);
  }, [loadSessions]);

  // poll the open chat
  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
    const t = setInterval(() => loadMessages(selectedId), 5000);
    return () => clearInterval(t);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendReply(e) {
    e.preventDefault();
    const text = reply.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/chat/sessions/${selectedId}/reply`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error("reply failed");
      setReply("");
      await loadMessages(selectedId);
      loadSessions();
    } catch {
      setError("Reply could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function closeChat() {
    if (!selectedId) return;
    if (!window.confirm("Close this chat? The bot will take over again for this user.")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/chat/sessions/${selectedId}/close`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("close failed");
      setSelectedId(null);
      setMessages([]);
      setStatus(null);
      loadSessions();
    } catch {
      setError("Could not close the chat.");
    }
  }

  const selected = sessions.find((s) => s.session_id === selectedId);
  const waiting = sessions.filter((s) => s.status === "pending_human").length;

  // "(2) Support Inbox" in the browser tab so waiting chats are noticed from other tabs
  useEffect(() => {
    const original = document.title;
    document.title = waiting > 0 ? `(${waiting}) Support Inbox` : "Support Inbox";
    return () => {
      document.title = original;
    };
  }, [waiting]);

  const showList = !isMobile || !selectedId;   // phone: list OR chat, never both
  const showChat = !isMobile || !!selectedId;

  return (
    <div style={styles.page}>
      {showList && (
        <div style={{ ...styles.listCol, ...(isMobile ? styles.listColMobile : {}) }}>
          <div style={styles.listHeader}>
            <div style={styles.title}>Support Inbox</div>
            <div style={styles.sub}>{waiting} waiting for a reply</div>
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.list}>
            {sessions.length === 0 && !error && <div style={styles.empty}>No open support chats.</div>}
            {sessions.map((s) => (
              <button
                key={s.session_id}
                style={{ ...styles.item, ...(s.session_id === selectedId ? styles.itemActive : {}) }}
                onClick={() => setSelectedId(s.session_id)}
              >
                <div style={styles.itemTop}>
                  <span style={styles.itemName}>{s.user_name || s.user_email || "Guest visitor"}</span>
                  <span
                    style={{
                      ...styles.badge,
                      ...(s.status === "pending_human" ? styles.badgeWaiting : styles.badgeAnswered),
                    }}
                  >
                    {s.status === "pending_human" ? "Waiting" : "Replied"}
                  </span>
                </div>
                <div style={styles.preview}>{s.last_message}</div>
                <div style={styles.time}>{timeAgo(s.updated_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showChat && (
        <div style={styles.chatCol}>
          {!selectedId ? (
            <div style={styles.placeholder}>Select a chat from the left to read and reply.</div>
          ) : (
            <>
              <div style={{ ...styles.chatHeader, ...(isMobile ? { padding: "10px 12px" } : {}) }}>
                {isMobile && (
                  <button
                    style={styles.backBtn}
                    onClick={() => {
                      setSelectedId(null);
                      setMessages([]);
                      setStatus(null);
                    }}
                    aria-label="Back to chats"
                  >
                    ←
                  </button>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...styles.title, ...styles.ellipsis }}>
                    {selected?.user_name || selected?.user_email || "Guest visitor"}
                  </div>
                  <div style={{ ...styles.sub, ...styles.ellipsis }}>
                    {selected?.user_email && !isMobile ? `${selected.user_email} · ` : ""}
                    {status === "pending_human" ? "Waiting for your reply" : "You replied"}
                  </div>
                </div>
                <button style={styles.closeBtn} onClick={closeChat}>
                  Close chat
                </button>
              </div>

              <div style={{ ...styles.messages, ...(isMobile ? { padding: 12 } : {}) }} ref={scrollRef}>
                {messages.map((m, i) => {
                  const bubbleMax = { maxWidth: isMobile ? "88%" : "70%", wordBreak: "break-word" };
                  return (
                    <div key={i} style={m.role === "user" ? styles.userRow : styles.otherRow}>
                      <div style={styles.roleLabel}>
                        {m.role === "user" ? "User" : m.role === "admin" ? "Support (you)" : "Bot"}
                      </div>
                      <div
                        style={{
                          ...(m.role === "user"
                            ? styles.userBubble
                            : m.role === "admin"
                            ? styles.adminBubble
                            : styles.botBubble),
                          ...bubbleMax,
                        }}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                style={{ ...styles.replyRow, ...(isMobile ? styles.replyRowMobile : {}) }}
                onSubmit={sendReply}
              >
                <textarea
                  style={{ ...styles.textarea, ...(isMobile ? { fontSize: 16 } : {}) }}  /* 16px stops iPhone auto-zoom */
                  rows={isMobile ? 1 : 2}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply to the user..."
                  onKeyDown={(e) => {
                    // Enter sends on desktop; on phones Enter is a new line (use the Send button)
                    if (!isMobile && e.key === "Enter" && !e.shiftKey) sendReply(e);
                  }}
                />
                <button
                  style={{ ...styles.sendBtn, ...(isMobile ? { padding: "0 14px" } : {}) }}
                  type="submit"
                  disabled={!reply.trim() || sending}
                >
                  {sending ? "Sending..." : isMobile ? "Send" : "Send reply"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const ACCENT = "#4F46E5";
const ACCENT_DARK = "#3730A3";

const styles = {
  page: { display: "flex", flex: 1, minHeight: 420, height: "100%", width: "100%", background: "#fff", border: "1px solid #ECECEF", borderRadius: 14, overflow: "hidden", fontFamily: "inherit", boxSizing: "border-box" },
  listCol: { width: 320, flexShrink: 0, borderRight: "1px solid #ECECEF", display: "flex", flexDirection: "column", background: "#FAFAFB", minHeight: 0 },
  listColMobile: { width: "100%", borderRight: "none" },
  listHeader: { padding: "14px 16px", borderBottom: "1px solid #ECECEF", background: "#fff" },
  title: { fontWeight: 600, fontSize: 15, color: "#18181B" },
  sub: { fontSize: 12, color: "#71717A", marginTop: 2 },
  error: { margin: 12, padding: "8px 10px", background: "#FEF2F2", color: "#B91C1C", fontSize: 12.5, borderRadius: 8 },
  list: { flex: 1, minHeight: 0, overflowY: "auto" },
  empty: { padding: 24, textAlign: "center", color: "#A1A1AA", fontSize: 13 },
  item: { display: "block", width: "100%", textAlign: "left", padding: "12px 16px", border: "none", borderBottom: "1px solid #F0F0F2", background: "transparent", cursor: "pointer" },
  itemActive: { background: "#EEF2FF" },
  itemTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  itemName: { fontWeight: 600, fontSize: 13.5, color: "#27272A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badge: { fontSize: 10.5, padding: "2px 8px", borderRadius: 10, fontWeight: 600, flexShrink: 0 },
  badgeWaiting: { background: "#FEF3C7", color: "#92400E" },
  badgeAnswered: { background: "#DCFCE7", color: "#166534" },
  preview: { fontSize: 12.5, color: "#52525B", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  time: { fontSize: 11, color: "#A1A1AA", marginTop: 3 },
  chatCol: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 },
  placeholder: { margin: "auto", color: "#A1A1AA", fontSize: 14 },
  chatHeader: { display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid #ECECEF" },
  backBtn: { background: "#F4F4F5", border: "none", borderRadius: 8, width: 36, height: 36, fontSize: 18, cursor: "pointer", flexShrink: 0, color: "#27272A" },
  ellipsis: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  closeBtn: { background: "#fff", border: "1px solid #E5E5E9", color: "#B91C1C", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", fontWeight: 600, flexShrink: 0 },
  messages: { flex: 1, minHeight: 0, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 10, background: "#FAFAFB" },
  userRow: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
  otherRow: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  roleLabel: { fontSize: 10.5, color: "#9CA3AF", marginBottom: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" },
  userBubble: { background: "#fff", border: "1px solid #ECECEF", color: "#27272A", padding: "8px 12px", borderRadius: "13px 13px 13px 3px", fontSize: 13.5, lineHeight: 1.45, maxWidth: "70%", whiteSpace: "pre-wrap" },
  botBubble: { background: "#F4F4F5", color: "#52525B", padding: "8px 12px", borderRadius: "13px 13px 3px 13px", fontSize: 13, lineHeight: 1.45, maxWidth: "70%", whiteSpace: "pre-wrap" },
  adminBubble: { background: ACCENT, color: "#fff", padding: "8px 12px", borderRadius: "13px 13px 3px 13px", fontSize: 13.5, lineHeight: 1.45, maxWidth: "70%", whiteSpace: "pre-wrap" },
  replyRow: { display: "flex", gap: 10, padding: 12, borderTop: "1px solid #ECECEF", background: "#fff" },
  replyRowMobile: { gap: 8, padding: "8px 10px", paddingBottom: "max(8px, env(safe-area-inset-bottom))", alignItems: "flex-end" },
  textarea: { flex: 1, minWidth: 0, border: "1px solid #E5E5E9", borderRadius: 10, padding: "8px 12px", fontSize: 13.5, resize: "none", outline: "none", fontFamily: "inherit" },
  sendBtn: { background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, color: "#fff", border: "none", borderRadius: 10, padding: "0 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
};