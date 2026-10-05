'use client';
/* eslint-disable @next/next/no-html-link-for-pages */

import { useState } from 'react';
import { TOKEN_KEY, USER_KEY } from '@/lib/client';

type Props = {
  active?: 'create' | 'collection';
  authenticated?: boolean;
};

export default function AppHeader({ active, authenticated = true }: Props) {
  const [open, setOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/login';
  };

  return (
    <header className="topbar">
      <a className={`brand ${authenticated ? 'brand-authenticated' : ''}`} href="/" aria-label="Social AI home">
        <span className="brand-mark" aria-hidden="true">◎</span>
        <span>SOCIAL AI</span>
      </a>

      {authenticated && (
        <>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <nav className={`primary-nav ${open ? 'mobile-open' : ''}`} aria-label="Primary navigation">
            <a className={active === 'create' ? 'active' : ''} href="/create" onClick={() => setOpen(false)}>Create</a>
            <a className={active === 'collection' ? 'active' : ''} href="/collection" onClick={() => setOpen(false)}>Collection</a>
          </nav>
          <button className="logout-button" type="button" onClick={logout}>
            <span aria-hidden="true">↗</span> Log out
          </button>
        </>
      )}
    </header>
  );
}
