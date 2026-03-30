'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserProfile } from '@/db/userProfileService';
import { getActiveProgram, getTodayProgramDay } from '@/db/programService';
import { getRecentSessions, getActiveSession, startWorkoutSession } from '@/db/workoutService';
import type { UserProfile, ProgramDay, WorkoutSession } from '@/db/database';

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } } };
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

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
  const avgDuration = recentSessions.length ? Math.round(recentSessions.reduce((t, s) => t + s.duration, 0) / recentSessions.length) : 0;
  const allPRs = recentSessions.flatMap(s => s.prsAchieved ?? []);

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';

  const weekGoal = profile?.daysPerWeek ?? 4;
  const weekProgress = Math.min(weekSessions.length / weekGoal, 1);
  // SVG ring
  const R = 36, C = 2 * Math.PI * R;

  return (
    <motion.div
      className="flex flex-col gap-5 pt-14 pb-4"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between px-5">
        <div>
          <p className="text-zinc-500 text-sm font-medium">{greeting},</p>
          <h1 className="text-[28px] font-black tracking-tight leading-tight">{profile?.name ?? 'Athlète'}</h1>
        </div>
        <motion.div whileTap={{ scale: 0.92 }}>
          <Link href="/profile">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/30 to-orange-600/10 border border-orange-500/25 flex items-center justify-center text-xl font-black text-orange-400 shadow-lg shadow-orange-500/10">
              {profile?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          </Link>
        </motion.div>
      </motion.div>

      {/* Active session banner */}
      <AnimatePresence>
        {activeSession && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: -8 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-5"
          >
            <motion.div whileTap={{ scale: 0.98 }}>
              <Link href="/workout/active" className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full bg-orange-500"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                  <div>
                    <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">En cours</p>
                    <p className="font-bold text-sm">{activeSession.dayName}</p>
                  </div>
                </div>
                <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                  Reprendre →
                </div>
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's workout hero */}
      <motion.div variants={fadeUp} className="mx-5">
        {todayDay ? (
          <div className="card overflow-hidden">
            {/* Gradient accent */}
            <div className="h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-300" />
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
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.05, type: 'spring' as const, stiffness: 400 }}
                    className="text-xs bg-white/5 border border-white/[0.07] text-zinc-300 px-2.5 py-1 rounded-lg font-medium"
                  >
                    {ex.name}
                  </motion.span>
                ))}
                {todayDay.exercises.length > 4 && (
                  <span className="text-xs bg-white/5 border border-white/[0.07] text-zinc-500 px-2.5 py-1 rounded-lg">
                    +{todayDay.exercises.length - 4}
                  </span>
                )}
              </div>

              {!activeSession && (
                <motion.button
                  onClick={handleStartWorkout}
                  className="btn-primary w-full py-4 text-base"
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                >
                  Démarrer la séance
                </motion.button>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-5 text-center">
            <motion.div
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="w-14 h-14 rounded-2xl bg-zinc-800 mx-auto flex items-center justify-center text-2xl mb-3"
            >😴</motion.div>
            <p className="font-bold text-lg">Repos mérité</p>
            <p className="text-zinc-500 text-sm mt-1">Récupère bien aujourd'hui</p>
            <Link href="/workout" className="inline-block mt-4 text-orange-400 text-sm font-semibold">
              Lancer une séance libre →
            </Link>
          </div>
        )}
      </motion.div>

      {/* Weekly progress ring + days */}
      <motion.div variants={fadeUp} className="mx-5">
        <div className="card p-4">
          <div className="flex items-center gap-5">
            {/* SVG Progress Ring */}
            <div className="relative flex-shrink-0">
              <svg width="88" height="88" viewBox="0 0 88 88">
                {/* Background track */}
                <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                {/* Progress arc */}
                <motion.circle
                  cx="44" cy="44" r={R}
                  fill="none"
                  stroke="url(#ringGrad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  initial={{ strokeDashoffset: C }}
                  animate={{ strokeDashoffset: C * (1 - weekProgress) }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '44px 44px' }}
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#fb923c" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className="text-2xl font-black text-orange-400 leading-none"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' as const }}
                >
                  {weekSessions.length}
                </motion.span>
                <span className="text-[10px] text-zinc-600 font-bold">/ {weekGoal}</span>
              </div>
            </div>

            <div className="flex-1">
              <p className="font-bold text-sm mb-3">Cette semaine</p>
              <div className="flex gap-1">
                {daysOfWeek.map((day, i) => {
                  const hasSession = recentSessions.some(s => new Date(s.date) >= weekStart && new Date(s.date).getDay() === i);
                  const isToday = i === today;
                  return (
                    <motion.div
                      key={day}
                      className="flex-1 flex flex-col items-center gap-1"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                    >
                      <motion.div
                        className={`w-full h-7 rounded-lg flex items-center justify-center ${
                          hasSession ? 'bg-orange-500' :
                          isToday ? 'bg-orange-500/15 border border-orange-500/40' : 'bg-white/[0.04]'
                        }`}
                        animate={hasSession ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ delay: 0.4 + i * 0.08 }}
                      >
                        {hasSession && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        {isToday && !hasSession && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                      </motion.div>
                      <span className={`text-[8px] font-bold uppercase ${isToday ? 'text-orange-400' : 'text-zinc-700'}`}>{day}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={fadeUp} className="flex gap-3 px-5">
        {[
          { icon: '⚡', value: weekVolume > 0 ? (weekVolume >= 1000 ? `${(weekVolume/1000).toFixed(1)}T` : `${weekVolume}kg`) : '—', label: 'Volume', color: 'text-yellow-400' },
          { icon: '🔥', value: String(recentSessions.length), label: 'Séances', color: 'text-orange-400' },
          { icon: '⏱', value: avgDuration > 0 ? `${avgDuration}m` : '—', label: 'Durée moy.', color: 'text-blue-400' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            className="flex-1 card p-3.5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.08, type: 'spring' as const, stiffness: 300 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-xl">{s.icon}</span>
            <p className={`text-xl font-black mt-1.5 ${s.color}`}>{s.value}</p>
            <p className="text-zinc-600 text-[10px] font-semibold mt-0.5 uppercase tracking-wide">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* PRs */}
      <AnimatePresence>
        {allPRs.length > 0 && (
          <motion.div
            variants={fadeUp}
            className="mx-5"
          >
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <motion.span
                  className="text-xl"
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >🏆</motion.span>
                <p className="font-bold text-sm">Records récents</p>
              </div>
              <div className="flex flex-col gap-2.5">
                {allPRs.slice(0, 3).map((pr, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                  >
                    <p className="text-sm text-zinc-300 font-medium">{pr.exerciseName}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-orange-400">{pr.value.toFixed(1)}kg</span>
                      <motion.span
                        className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-md"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.6 + i * 0.08, type: 'spring' as const }}
                      >
                        +{(pr.value - pr.previousValue).toFixed(1)}
                      </motion.span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick actions */}
      <motion.div variants={fadeUp} className="flex gap-3 px-5">
        {[
          { href: '/coach', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>, color: 'bg-violet-500/10 border-violet-500/20', title: 'Coach IA', sub: 'Demande conseil' },
          { href: '/history', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, color: 'bg-emerald-500/10 border-emerald-500/20', title: 'Historique', sub: 'Voir les séances' },
        ].map((a, i) => (
          <motion.div key={a.href} className="flex-1" whileTap={{ scale: 0.96 }}>
            <Link href={a.href} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${a.color} border flex items-center justify-center flex-shrink-0`}>
                {a.icon}
              </div>
              <div>
                <p className="font-bold text-sm">{a.title}</p>
                <p className="text-zinc-500 text-xs">{a.sub}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <motion.div
        className="w-16 h-16 rounded-3xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 border border-orange-500/20 flex items-center justify-center"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round">
          <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M2 9.5h2M20 9.5h2M2 14.5h2M20 14.5h2"/>
        </svg>
      </motion.div>
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-500/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}
