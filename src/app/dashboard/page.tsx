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
        getUserProfile(),
        getTodayProgramDay(),
        getRecentSessions(5),
        getActiveSession(),
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
    if (activeSession?.id) {
      router.push('/workout/active');
      return;
    }
    const id = await startWorkoutSession(todayDay.name, `day-${todayDay.dayIndex}`);
    router.push('/workout/active');
  }

  if (loading) return <LoadingScreen />;

  const weekTotal = recentSessions
    .filter((s) => {
      const d = new Date(s.date);
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return d >= weekStart;
    }).length;

  const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const today = new Date().getDay();
  const greeting = getGreeting();

  return (
    <div className="px-4 pt-12 pb-4 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-sm">{greeting}</p>
          <h1 className="text-2xl font-bold">{profile?.name} 👋</h1>
        </div>
        <Link href="/profile" className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold text-orange-400">
          {profile?.name?.[0]?.toUpperCase() ?? '?'}
        </Link>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <Link href="/workout/active" className="block bg-orange-500/20 border border-orange-500/50 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-400 text-xs font-semibold uppercase tracking-wide">Séance en cours</p>
              <p className="font-bold">{activeSession.dayName}</p>
            </div>
            <span className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">Reprendre →</span>
          </div>
        </Link>
      )}

      {/* Today's workout card */}
      {todayDay ? (
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-1">Aujourd'hui</p>
              <h2 className="text-xl font-bold">{todayDay.name}</h2>
              <p className="text-zinc-400 text-sm">{todayDay.focus}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl">🏋️</span>
              <p className="text-xs text-zinc-500">{todayDay.estimatedDuration} min</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {todayDay.exercises.slice(0, 4).map((ex, i) => (
              <span key={i} className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-lg">
                {ex.name}
              </span>
            ))}
            {todayDay.exercises.length > 4 && (
              <span className="text-xs bg-zinc-800 text-zinc-500 px-2.5 py-1 rounded-lg">
                +{todayDay.exercises.length - 4}
              </span>
            )}
          </div>
          {!activeSession && (
            <button
              onClick={handleStartWorkout}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
            >
              🚀 Démarrer la séance
            </button>
          )}
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 text-center">
          <p className="text-4xl mb-2">😴</p>
          <p className="font-semibold">Repos aujourd'hui</p>
          <p className="text-zinc-500 text-sm mt-1">Récupère bien !</p>
          <Link href="/workout" className="mt-3 block text-orange-400 text-sm font-medium">
            Séance libre →
          </Link>
        </div>
      )}

      {/* Weekly progress */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">Cette semaine</p>
          <span className="text-orange-400 font-bold">{weekTotal}/{profile?.daysPerWeek ?? 4}</span>
        </div>
        <div className="flex gap-1.5">
          {daysOfWeek.map((day, i) => {
            const hasSession = recentSessions.some((s) => {
              const d = new Date(s.date);
              return d.getDay() === i;
            });
            const isToday = i === today;
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full h-1.5 rounded-full ${
                  hasSession ? 'bg-orange-500' : 'bg-zinc-800'
                }`} />
                <span className={`text-[10px] ${isToday ? 'text-orange-400 font-bold' : 'text-zinc-600'}`}>
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Volume total"
          value={`${Math.round(recentSessions.reduce((s, r) => s + r.totalVolume, 0) / 1000)}T`}
          sub="cette semaine"
          color="orange"
        />
        <StatCard
          label="Séances"
          value={String(recentSessions.length)}
          sub="récentes"
          color="blue"
        />
        <StatCard
          label="Durée moy."
          value={`${Math.round(recentSessions.reduce((s, r) => s + r.duration, 0) / Math.max(recentSessions.length, 1))}m`}
          sub="par séance"
          color="green"
        />
      </div>

      {/* Recent PRs */}
      {recentSessions.flatMap((s) => s.prsAchieved ?? []).length > 0 && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <p className="font-semibold mb-3">🏆 PRs récents</p>
          <div className="flex flex-col gap-2">
            {recentSessions.flatMap((s) => s.prsAchieved ?? []).slice(0, 3).map((pr, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">{pr.exerciseName}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-orange-400">{pr.value.toFixed(1)} kg</span>
                  <span className="text-xs text-zinc-600 ml-1">(+{(pr.value - pr.previousValue).toFixed(1)})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/coach" className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <p className="font-semibold text-sm">Coach IA</p>
            <p className="text-zinc-500 text-xs">Pose une question</p>
          </div>
        </Link>
        <Link href="/programs" className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-semibold text-sm">Programme</p>
            <p className="text-zinc-500 text-xs">Voir le planning</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: 'orange' | 'blue' | 'green';
}) {
  const colors = {
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
  };
  return (
    <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
      <p className={`text-xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-zinc-300 text-xs font-medium">{label}</p>
      <p className="text-zinc-600 text-[10px]">{sub}</p>
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour,';
  if (h < 18) return 'Bon après-midi,';
  return 'Bonsoir,';
}
