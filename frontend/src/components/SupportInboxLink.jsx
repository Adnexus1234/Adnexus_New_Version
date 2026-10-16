import { useState, useEffect } from "react";

/**
 * useSupportInfo()
 * ----------------
 * Used by Sidebar.jsx to show a "Support Inbox" menu item ONLY to support accounts.
 *
 *   const { is_support, waiting } = useSupportInfo();
 *
 * Backend: GET /api/chat/is-support  ->  { is_support: bool, waiting: number }
 * Normal users: checked once, then no more polling.
 * Support users: refreshed every 20 seconds so the waiting-count badge stays current.
 */

const API_BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000/api" : "/api");

const TOKEN_KEY = "token"; // falls back to any JWT found in storage (same as AdminChatPanel.jsx)

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

export function useSupportInfo() {
  const [info, setInfo] = useState({ is_support: false, waiting: 0 });

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function load() {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/chat/is-support`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setInfo(data);
        if (!data.is_support && timer) {
          clearInterval(timer); // normal user: no need to keep checking
          timer = null;
        }
      } catch {
        /* stay hidden */
      }
    }

    load();
    timer = setInterval(load, 20000);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  return info;
}