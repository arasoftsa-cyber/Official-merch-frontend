import React from 'react';
import { Link } from 'react-router-dom';

const footerLinks = [
  { label: 'Artists', to: '/artists' },
  { label: 'Drops', to: '/drops' },
  { label: 'Products', to: '/products' },
];

export default function BlackFooter() {
  return (
    <footer
      style={{
        background: '#000',
        color: '#fff',
        padding: '24px 16px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <strong>OfficialMerch</strong>
          <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Black chrome indie merch feel</p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {footerLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} OfficialMerch</p>
          <p style={{ margin: 0 }}>Privacy · Terms · Status</p>
        </div>
      </div>
    </footer>
  );
}
