import type { Metadata } from 'next';
import '@/src/styles/index.css';

export const metadata: Metadata = {
  title: 'Social AI',
  description: 'Unleash Creativity, Share Memories—Where AI Meets Your Imagination!',
  icons: { icon: '/favicon.png' },
  openGraph: {
    type: 'website',
    title: 'Social AI',
    description: 'Unleash Creativity, Share Memories—Where AI Meets Your Imagination!',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Social AI — Imagine, Create, Share' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Social AI',
    description: 'Unleash Creativity, Share Memories—Where AI Meets Your Imagination!',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
