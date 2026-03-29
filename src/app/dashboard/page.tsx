'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUserProfile } from '@/db/userProfileService';
import { getActiveProgram, getTodayProgramDay } from '@/db/programService';
import { getRecentSessions, getActiveSession, startWorkoutSession } from '@/db/workoutService';
import type { UserProfile, ProgramDay, WorkoutSession } from '@/db/database';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayDay, setTodayDay] = useState<ProgramDay | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [p, td, sessions, active] = await Promise.all([
        getUserProfile(), getTodayProgramDay(), getRecentSessions(5), getActiveSession(),
      ]);
      if (!p) { router.replace('/onboarding'); return; }
      setProfile(p);
      setTodayDay(td);
      setRecentSessions(sessions);
      setActiveSession(active ?? null);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleStartWorkout() {
    if (!todayDay) return;
    if (activeSession?.id) { router.push('/workout/active'); return; }
    await startWorkoutSession(todayDay.name, `day-${todayDay.dayIndex}`);
    router.push('/workout/active');
  }

  if (loading) return <LoadingScreen />;

  const today = new Date().getDay();
  const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const weekStart = new Date(); weekStart.setDate(new Date().getDate() - today); weekStart.setHours(0,0,0,0);
  const weekSessions = recentSessions.filter(s => new Date(s.date) >= weekStart);
  const weekVolume = Math.round(weekSessions.reduce((t, s) => t + s.totalVolume, 0));
  const avgDuration = recentSessions.length
    ? Math.round(recentSessions.reduce((t, s) => t + s.duration, 0) / recentSessions.length) : 0;
  const allPRs = recentSessions.flatMap(s => s.prsAchieved ?? []);

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="flex flex-col gap-5 pt-14 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5">
        <div>
          <p className="text-zinc-500 text-sm font-medium">{greeting},</p>
          <h1 className="text-[28px] font-black tracking-tight leading-tight">{profile?.name ?? 'Athlète'}</h1>
        </div>
        <Link href="/profile">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/30 to-orange-600/10 border border-orange-500/25 flex items-center justify-center text-xl font-black text-orange-400 shadow-lg shadow-orange-500/10">
            {profile?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        </Link>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="mx-5">
          <Link href="/workout/active" className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <div>
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">En cours</p>
                <p className="font-bold text-sm">{activeSession.dayName}</p>
              </div>
            </div>
            <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl">
              Reprendre →
            </div>
          </Link>
        </div>
      )}

      {/* Today's workout hero */}
      <div className="mx-5">
        {todayDay ? (
          <div className="card overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1.5">Aujourd'hui</p>
                  <h2 className="text-2xl font-black tracking-tight">{todayDay.name}</h2>
                  <p className="text-zinc-400 text-sm mt-0.5">{todayDay.focus}</p>
                </div>
                <div className="text-right">
                  <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 font-medium">{todayDay.estimatedDuration}min</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {todayDay.exercises.slice(0, 4).map((ex, i) => (
                  <span key={i} className="text-xs bg-white/5 border border-white/[0.07] text-zinc-300 px-2.5 py-1 rounded-lg font-medium">
                    {ex.name}
                  </span>
                ))}
                {todayDay.exercises.length > 4 && (
                  <span className="text-xs bg-white/5 border border-white/[0.07] text-zinc-500 px-2.5 py-1 rounded-lg">
                    +{todayDay.exercises.length - 4}
                  </span>
                )}
              </div>

              {!activeSession && (
                <button onClick={handleStartWorkout} className="btn-primary w-full py-4 text-base">
                  Démarrer la séance
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 mx-auto flex items-center justify-center text-2xl mb-3">😴</div>
            <p className="font-bold text-lg">Repos mérité</p>
            <p className="text-zinc-500 text-sm mt-1">Récupère bien aujourd'hui</p>
            <Link href="/workout" className="inline-block mt-4 text-orange-400 text-sm font-semibold">
              Lancer une séance libre →
            </Link>
          </div>
        )}
      </div>

      {/* Weekly progress */}
      <div className="mx-5">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-sm">Cette semaine</p>
            <div className="flex items-center gap-1.5">
              <span className="text-orange-500 font-black text-lg">{weekSessions.length}</span>
              <span className="text-zinc-600 text-sm font-medium">/ {profile?.daysPerWeek ?? 4}</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            {daysOfWeek.map((day, i) => {
              const hasSession = recentSessions.some(s => new Date(s.date) >= weekStart && new Date(s.date).getDay() === i);
              const isToday = i === today;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className={`w-full h-8 rounded-lg flex items-center justify-center transition-all ${
                    hasSession ? 'bg-orange-500 shadow-md shadow-orange-500/20' :
                    isToday ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-white/[0.04]'
                  }`}>
                    {hasSession && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                    {isToday && !hasSession && <div className="w-1 h-1 rounded-full bg-orange-500" />}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${isToday ? 'text-orange-400' : 'text-zinc-600'}`}>{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 px-5">
        <StatCard icon="⚡" value={weekVolume > 0 ? `${weekVolume >= 1000 ? (weekVolume/1000).toFixed(1)+'T' : weekVolume+'kg'}` : '—'} label="Volume" />
        <StatCard icon="🔥" value={String(recentSessions.length)} label="Séances" />
        <StatCard icon="⏱" value={avgDuration > 0 ? `${avgDuration}m` : '—'} label="Durée moy." />
      </div>

      {/* PRs */}
      {allPRs.length > 0 && (
        <div className="mx-5">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🏆</span>
              <p className="font-bold text-sm">Records récents</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {allPRs.slice(0, 3).map((pr, i) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-sm text-zinc-300 font-medium">{pr.exerciseName}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-orange-400">{pr.value.toFixed(1)}kg</span>
                    <span className="text-xs text-emerald-500 font-semibold">+{(pr.value - pr.previousValue).toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3 px-5">
        <Link href="/coach" className="flex-1 card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
          </div>
          <div>
            <p className="font-bold text-sm">Coach IA</p>
            <p className="text-zinc-500 text-xs">Demande conseil</p>
          </div>
        </Link>
        <Link href="/programs" className="flex-1 card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          </div>
          <div>
            <p className="font-bold text-sm">Programme</p>
            <p className="text-zinc-500 text-xs">Planning IA</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex-1 card p-3.5">
      <span className="text-lg">{icon}</span>
      <p className="text-xl font-black text-white mt-1.5">{value}</p>
      <p className="text-zinc-500 text-[11px] font-medium mt-0.5">{label}</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
