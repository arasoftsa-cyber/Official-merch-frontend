import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAccessToken, clearTokens } from '../../shared/auth/tokenStore';
import { logoutAuth } from '../../lib/api/auth';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Artists', to: '/artists' },
  { label: 'Drops', to: '/drops' },
  { label: 'Products', to: '/products' },
];

export default function BlackHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAccessToken()));
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await logoutAuth();
    } catch {
      // Best-effort server logout.
    } finally {
      clearTokens();
      sessionStorage.clear();
      setIsAuthenticated(false);
      navigate('/login', { replace: true });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setMenuOpen(!isMobile);
  }, [isMobile]);

  const navStyle: React.CSSProperties = {
    display: isMobile ? (menuOpen ? 'flex' : 'none') : 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: 'center',
    gap: '1rem',
    marginTop: isMobile ? '1rem' : '0',
  };

  return (
    <header
      style={{
        background: '#000',
        color: '#fff',
        padding: '12px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/"
          style={{
            color: '#fff',
            textDecoration: 'none',
            fontSize: '1.25rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          OfficialMerch
        </Link>
        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
          style={{
            border: '1px solid rgba(255,255,255,0.5)',
            background: 'transparent',
            color: '#fff',
            fontSize: '1.1rem',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: 999,
            display: isMobile ? 'block' : 'none',
          }}
        >
          Menu
        </button>
        <nav aria-label="Primary" style={{ display: 'flex', alignItems: 'center' }}>
          <div style={navStyle}>
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  color: '#fff',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  fontSize: '0.9rem',
                  letterSpacing: '0.08em',
                }}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                style={{ marginTop: isMobile ? '0.25rem' : '0' }}
              >
                Logout
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                style={{ marginTop: isMobile ? '0.25rem' : '0' }}
              >
                Login
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
