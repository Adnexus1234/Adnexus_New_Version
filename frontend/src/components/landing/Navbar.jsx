import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Sparkles, Workflow, Mail, Info, Briefcase } from 'lucide-react'
import logo from '../../assets/logo.png'

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <style>{`
        .an-nav-links { display: flex; align-items: center; gap: 24px; }
        .an-nav-right { display: flex; align-items: center; gap: 10px; }
        .an-burger { display: none !important; }
        .an-mobile-panel { display: none; }

        .an-nav-link-item {
          padding: 8px 14px;
          border-radius: 8px;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .an-nav-link-item:hover {
          background: #eaf1fe;
          color: #1A73E8 !important;
        }

        .an-btn-ghost-hover {
          border-radius: 10px !important;
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        .an-btn-ghost-hover:hover {
          background: #eaf1fe !important;
          border-color: #1A73E8 !important;
          color: #1A73E8 !important;
        }

        .an-btn-blue-hover {
          border: 1.5px solid #0f5fd1 !important;
          transition: background 0.2s ease, box-shadow 0.2s ease;
        }
        .an-btn-blue-hover:hover {
          background: #155fc9;
          box-shadow: 0 4px 12px rgba(26,115,232,0.35);
        }

        @media (max-width: 860px) {
          .an-nav-links { display: none !important; }
          .an-nav-right .an-desktop-only { display: none !important; }
          .an-burger {
            display: flex !important;
            margin-left: auto;
          }
          .an-mobile-panel.open {
            display: flex !important;
          }
          .an-mobile-panel {
            position: relative;
            flex-direction: column;
            gap: 8px;
          }
        }
      `}</style>

      <nav style={s.nav}>
        <div style={s.navInner}>
          <div style={s.logo}>
            <img src={logo} alt="AdNexus" style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }} />
            <span style={s.logoText}>AdNexus</span>
          </div>
          <div className="an-nav-links" style={s.navLinks}>
            <a href="/#features" className="an-nav-link-item" style={s.navLink}>
              <Sparkles size={16} color="#1A73E8" /> Features
            </a>
            <Link to="/how-it-works" className="an-nav-link-item" style={s.navLink}>
              <Workflow size={16} color="#1A73E8" /> How it works
            </Link>
            <Link to="/contact" className="an-nav-link-item" style={s.navLink}>
              <Mail size={16} color="#1A73E8" /> Contact
            </Link>
            <Link to="/about" className="an-nav-link-item" style={s.navLink}>
              <Info size={16} color="#1A73E8" /> About
            </Link>
            <Link to="/services" className="an-nav-link-item" style={s.navLink}>
              <Briefcase size={16} color="#1A73E8" /> Services
            </Link>
          </div>
          <div className="an-nav-right" style={s.navRight}>
            <button className="an-desktop-only an-btn-ghost-hover" style={s.btnGhost} onClick={() => navigate('/login')}>Login</button>
            <button className="an-desktop-only an-btn-blue-hover" style={s.btnBlue} onClick={() => navigate('/signup')}>Get Started Free</button>
            <button
              className="an-burger"
              style={s.burgerBtn}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span style={s.burgerLine} />
              <span style={s.burgerLine} />
              <span style={s.burgerLine} />
            </button>
          </div>
        </div>

        <div className={`an-mobile-panel${menuOpen ? ' open' : ''}`} style={s.mobilePanel}>
          <a href="/#features" className="an-nav-link-item" style={s.mobileLink} onClick={() => setMenuOpen(false)}>
            <Sparkles size={16} color="#1A73E8" /> Features
          </a>
          <Link to="/how-it-works" className="an-nav-link-item" style={s.mobileLink} onClick={() => setMenuOpen(false)}>
            <Workflow size={16} color="#1A73E8" /> How it works
          </Link>
          <Link to="/contact" className="an-nav-link-item" style={s.mobileLink} onClick={() => setMenuOpen(false)}>
            <Mail size={16} color="#1A73E8" /> Contact
          </Link>
          <Link to="/about" className="an-nav-link-item" style={s.mobileLink} onClick={() => setMenuOpen(false)}>
            <Info size={16} color="#1A73E8" /> About
          </Link>
          <Link to="/services" className="an-nav-link-item" style={s.mobileLink} onClick={() => setMenuOpen(false)}>
            <Briefcase size={16} color="#1A73E8" /> Services
          </Link>
          <div style={s.mobileBtnRow}>
            <button style={{ ...s.btnGhost, flex: 1 }} onClick={() => navigate('/login')}>Login</button>
            <button style={{ ...s.btnBlue, flex: 1 }} onClick={() => navigate('/signup')}>Get Started Free</button>
          </div>
        </div>
      </nav>
    </>
  )
}

const s = {
  nav: { background: '#fff', borderBottom: '0.5px solid #e8eaf0', position: 'sticky', top: 0, zIndex: 100 },
  navInner: { maxWidth: '1200px', margin: '0 auto', padding: '0 20px', height: '64px', display: 'flex', alignItems: 'center', gap: '16px' },
  logo: { display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' },
  logoText: { fontSize: '18px', fontWeight: '700', color: '#1a1a2e', letterSpacing: '-0.3px' },
  navLinks: { gap: '28px', marginLeft: '32px' },
  navLink: { fontSize: '14px', color: '#6b7280', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' },
  navRight: { marginLeft: 'auto', gap: '10px', alignItems: 'center' },
  btnGhost: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #e0e4ef', background: '#fff', fontSize: '13px', color: '#1a1a2e', cursor: 'pointer', fontWeight: '500', fontFamily: 'inherit' },
  btnBlue: { padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#1A73E8', fontSize: '13px', color: '#fff', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit' },
  burgerBtn: { display: 'inline-flex', width: '38px', height: '38px', borderRadius: '8px', border: '1px solid #e0e4ef', background: '#fff', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' },
  burgerLine: { width: '18px', height: '2px', background: '#1a1a2e', borderRadius: '2px' },
  mobilePanel: { flexDirection: 'column', gap: '4px', padding: '12px 20px 18px', borderTop: '0.5px solid #e8eaf0', background: '#fff' },
  mobileLink: { fontSize: '15px', color: '#1a1a2e', textDecoration: 'none', fontWeight: '500', padding: '10px 4px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', alignItems: 'center', gap: '8px' },
  mobileBtnRow: { display: 'flex', gap: '10px', marginTop: '10px' },
}

export default Navbar