import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check, X } from 'lucide-react'

// ════════════════════════════════════════════════════
// CustomSelect — reusable searchable dropdown
// Matches AdNexus theme: border #cbd5e1, active #1668f5, bg #eaf2ff
// ════════════════════════════════════════════════════
const CustomSelect = ({
  value,
  onChange,
  options,           // array of strings, OR array of {label, icon}
  placeholder = 'Select...',
  icon = null,        // fallback leading icon (lucide component) when nothing selected
  error = false,
  searchable = true,
  inputRef = null,    // for your registerRef() jump-to-error pattern
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)
  const searchInputRef = useRef(null)

  // normalize options to {label, icon} shape
  const normalized = options.map(o => typeof o === 'string' ? { label: o, icon: null } : o)
  const selected = normalized.find(o => o.label === value)

  const filtered = query.trim()
    ? normalized.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : normalized

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [open])

  const handleSelect = (label) => {
    onChange(label)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={(el) => { wrapRef.current = el; if (inputRef) inputRef(el) }} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          ...st.trigger,
          ...(error ? st.triggerError : {}),
          ...(open ? st.triggerOpen : {}),
        }}
      >
        <span style={st.triggerLeft}>
          <span style={st.triggerIcon}>
            {selected?.icon || icon || <span style={{ fontSize: '15px' }}>🏷️</span>}
          </span>
          <span style={{ ...st.triggerText, ...(!selected ? st.triggerPlaceholder : {}) }}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2.4}
          color="#94a3b8"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
        />
      </div>

      {/* Dropdown panel */}
      {open && (
        <div style={st.panel}>
          {searchable && (
            <div style={st.searchWrap}>
              <Search size={14} color="#94a3b8" strokeWidth={2.2} style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                style={st.searchInput}
                placeholder="Search..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <X
                  size={13}
                  strokeWidth={2.4}
                  color="#94a3b8"
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => setQuery('')}
                />
              )}
            </div>
          )}

          <div style={st.list}>
            {filtered.length === 0 && (
              <div style={st.empty}>No results found</div>
            )}
            {filtered.map(opt => {
              const isSel = opt.label === value
              return (
                <div
                  key={opt.label}
                  onClick={() => handleSelect(opt.label)}
                  style={{ ...st.item, ...(isSel ? st.itemActive : {}) }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#f8faff' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={st.itemLeft}>
                    {opt.icon && <span style={{ fontSize: '14px' }}>{opt.icon}</span>}
                    <span>{opt.label}</span>
                  </span>
                  {isSel && <Check size={14} strokeWidth={2.6} color="#1668f5" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles: same tokens as your `s` object (border #cbd5e1, active #1668f5) ──
const st = {
  trigger: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px', borderRadius: '10px', border: '2px solid #cbd5e1',
    background: '#fff', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
    transition: 'border-color 0.15s',
  },
  triggerOpen: { border: '2px solid #1668f5', boxShadow: '0 0 0 3px rgba(22,104,245,0.08)' },
  triggerError: { border: '1.5px solid #dc2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.08)' },
  triggerLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  triggerIcon: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  triggerText: { fontSize: '13px', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  triggerPlaceholder: { color: '#94a3b8', fontWeight: '500' },

  panel: {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
    background: '#fff', borderRadius: '12px', border: '1.5px solid #e4e9f5',
    boxShadow: '0 8px 28px rgba(15,23,42,0.12)', overflow: 'hidden',
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
    borderBottom: '1px solid #e4e9f5', background: '#f8faff',
  },
  searchInput: {
    flex: 1, border: 'none', outline: 'none', background: 'transparent',
    fontSize: '13px', fontWeight: '500', color: '#0f172a', fontFamily: 'inherit',
  },
  list: { maxHeight: '260px', overflowY: 'auto' },
  empty: { padding: '16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', fontSize: '13px', fontWeight: '500', color: '#0f172a',
    cursor: 'pointer', borderBottom: '0.5px solid #f0f2f8', transition: 'background 0.1s',
  },
  itemActive: { background: '#eaf2ff', color: '#1668f5', fontWeight: '700' },
  itemLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
}

export default CustomSelect