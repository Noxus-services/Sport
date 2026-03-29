import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'ApexCoach',
  description: 'Ton coach IA personnel pour la musculation',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        <main className="pb-20 min-h-screen">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
