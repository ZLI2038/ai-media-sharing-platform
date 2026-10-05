'use client';

import { useSyncExternalStore } from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from '@/src/components/App';

export default function SocialApp() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) return null;

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
