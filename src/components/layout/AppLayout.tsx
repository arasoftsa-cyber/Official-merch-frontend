import React from 'react';
import { Outlet } from 'react-router-dom';
import BlackFooter from './BlackFooter';
import BlackHeader from './BlackHeader';

export default function AppLayout() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#111',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BlackHeader />
      <main
        style={{
          flex: 1,
          padding: '24px 16px',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
          color: '#fff',
        }}
        role="main"
      >
        <Outlet />
      </main>
      <BlackFooter />
    </div>
  );
}
