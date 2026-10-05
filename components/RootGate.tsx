'use client';

import { useEffect } from 'react';
import { TOKEN_KEY } from '@/lib/client';

export default function RootGate() {
  useEffect(() => {
    window.location.replace(localStorage.getItem(TOKEN_KEY) ? '/create' : '/login');
  }, []);

  return (
    <main className="route-loader" aria-live="polite">
      <span className="loader-orbit" aria-hidden="true" />
      <p>Opening Social AI…</p>
    </main>
  );
}
