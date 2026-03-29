'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const NAV = [
  { href: '/dashboard', label: 'Accueil', icon: HomeIcon },
  { href: '/workout',   label: 'Séance',  icon: DumbbellIcon },
  { href: '/programs',  label: 'Programme', icon: GridIcon },
  { href: '/coach',     label: 'Coach',   icon: SparkIcon },
  { href: '/reminders', label: 'Rappels', icon: BellIcon },
];

export default function BottomNav() {
  const path = usePathname();
  const isHidden = path === '/' || path?.startsWith('/onboarding') || path?.startsWith('/workout/active');
  if (isHidden) return null;

  return (
    <nav className="fixed bottom-5 left-0 right-0 z-50 flex justify-center px-6 safe-bottom">
      <motion.div
        className="flex items-center gap-1 bg-[#111] border border-white/[0.08] rounded-[28px] px-2 py-2 shadow-2xl shadow-black/60 backdrop-blur-xl"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/dashboard' && path?.startsWith(href));
          return (
            <motion.div key={href} whileTap={{ scale: 0.88 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
              <Link
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 px-3.5 py-2.5 rounded-[22px] transition-all duration-200 min-w-[54px] ${
                  active
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon size={20} active={active} />
                <span className={`text-[9px] font-semibold tracking-wide ${active ? 'text-white' : 'text-zinc-600'}`}>
                  {label}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </nav>
  );
}

function HomeIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? 'white' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9" stroke={active ? 'rgba(0,0,0,0.4)' : 'currentColor'} strokeWidth="2"/>
    </svg>
  );
}

function DumbbellIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5v14M18 5v14"/>
      <path d="M4 7h4M16 7h4M4 17h4M16 17h4"/>
      <line x1="8" y1="12" x2="16" y2="12" strokeWidth={active ? "3" : "2"}/>
    </svg>
  );
}

function GridIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? 'white' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  );
}

function SparkIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? 'white' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>
    </svg>
  );
}

function BellIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? 'white' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
