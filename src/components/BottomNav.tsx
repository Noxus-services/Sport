'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Accueil', icon: HomeIcon },
  { href: '/workout',   label: 'Séance',  icon: DumbbellIcon },
  { href: '/programs',  label: 'Programme', icon: ClipboardIcon },
  { href: '/coach',     label: 'Coach',   icon: BotIcon },
  { href: '/history',   label: 'Historique', icon: ChartIcon },
];

export default function BottomNav() {
  const path = usePathname();
  const isHidden = path === '/' || path?.startsWith('/onboarding') || path?.startsWith('/workout/active');

  if (isHidden) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 safe-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/dashboard' && path?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[56px] ${
                active ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={22} active={active} />
              <span className={`text-[10px] font-medium ${active ? 'text-orange-500' : 'text-zinc-500'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function DumbbellIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M17.5 6.5V17.5M6.5 6.5V17.5M6.5 17.5h11"/>
      <circle cx="5" cy="12" r="2" fill={active ? 'currentColor' : 'none'}/>
      <circle cx="19" cy="12" r="2" fill={active ? 'currentColor' : 'none'}/>
      <line x1="3" y1="12" x2="7" y2="12"/>
      <line x1="17" y1="12" x2="21" y2="12"/>
      <line x1="7" y1="8" x2="7" y2="16"/>
      <line x1="17" y1="8" x2="17" y2="16"/>
    </svg>
  );
}
function ClipboardIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" stroke={active ? 'white' : 'currentColor'} fill="none"/>
    </svg>
  );
}
function BotIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <rect width="18" height="10" x="3" y="11" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 7v4"/>
      <line x1="8" y1="16" x2="8" y2="16"/>
      <line x1="16" y1="16" x2="16" y2="16"/>
      <circle cx="8" cy="16" r="1" fill={active ? 'white' : 'currentColor'}/>
      <circle cx="16" cy="16" r="1" fill={active ? 'white' : 'currentColor'}/>
    </svg>
  );
}
function ChartIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
      {active && <path d="M6 14h12" strokeOpacity="0.3"/>}
    </svg>
  );
}
