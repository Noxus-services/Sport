'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRecentSessions } from '@/db/workoutService';
import type { WorkoutSession } from '@/db/database';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } } };

export default function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selected, setSelected] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentSessions(50).then(s => { setSessions(s); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <motion.div
        className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      />
    </div>
  );

  if (selected) return <SessionDetail session={selected} onBack={() => setSelected(null)} />;

  const grouped: Record<string, WorkoutSession[]> = {};
  for (const s of sessions) {
    const key = new Date(s.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  const totalVolume = sessions.reduce((t, s) => t + s.totalVolume, 0);
  const totalSessions = sessions.length;
  const avgDuration = totalSessions ? Math.round(sessions.reduce((t, s) => t + s.duration, 0) / totalSessions) : 0;
  const totalPRs = sessions.reduce((t, s) => t + (s.prsAchieved?.length ?? 0), 0);

  // Volume chart data — last 8 sessions reversed
  const chartData = [...sessions].reverse().slice(-8);
  const maxVol = Math.max(...chartData.map(s => s.totalVolume), 1);
  const W = 320, H = 80;
  const pts = chartData.map((s, i) => {
    const x = (i / Math.max(chartData.length - 1, 1)) * (W - 24) + 12;
    const y = H - 12 - ((s.totalVolume / maxVol) * (H - 24));
    return { x, y, s };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pts.length > 0
    ? `${pathD} L ${pts[pts.length-1].x} ${H} L ${pts[0].x} ${H} Z`
    : '';

  return (
    <motion.div
      className="flex flex-col gap-5 pt-14 pb-4"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="px-5">
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">ApexCoach</p>
        <h1 className="text-[28px] font-black tracking-tight">Historique</h1>
      </motion.div>

      {/* Summary stats */}
      {totalSessions > 0 && (
        <motion.div variants={fadeUp} className="flex gap-3 px-5">
          {[
            { value: totalSessions, label: 'Séances', color: 'text-orange-400' },
            { value: totalVolume >= 1000 ? `${(totalVolume/1000).toFixed(0)}T` : `${Math.round(totalVolume)}kg`, label: 'Volume', color: 'text-white' },
            { value: totalPRs, label: 'PRs', color: 'text-yellow-400' },
            { value: `${avgDuration}m`, label: 'Durée moy.', color: 'text-blue-400' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              className="flex-1 card p-3.5 text-center"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.07, type: 'spring' }}
            >
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] font-semibold text-zinc-600 mt-0.5 uppercase tracking-wide">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Volume chart */}
      {chartData.length > 1 && (
        <motion.div variants={fadeUp} className="mx-5 card p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Volume (8 dernières séances)</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: H }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ea580c"/>
                <stop offset="100%" stopColor="#fb923c"/>
              </linearGradient>
            </defs>
            {/* Area fill */}
            <motion.path
              d={areaD}
              fill="url(#areaGrad)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            />
            {/* Line */}
            <motion.path
              d={pathD}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
            />
            {/* Dots */}
            {pts.map((p, i) => (
              <motion.circle
                key={i}
                cx={p.x} cy={p.y} r="3.5"
                fill="#f97316"
                stroke="#0a0a0a"
                strokeWidth="2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4 + i * 0.06, type: 'spring' }}
                style={{ filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.6))' }}
              />
            ))}
          </svg>
          <div className="flex justify-between mt-2">
            {chartData.map((s, i) => (
              <span key={i} className="text-[8px] text-zinc-700 font-medium">
                {new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {sessions.length === 0 && (
        <motion.div variants={fadeUp} className="mx-5 card p-10 flex flex-col items-center text-center gap-3">
          <motion.div
            className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center text-3xl"
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >🏋️</motion.div>
          <p className="font-bold text-lg">Aucune séance</p>
          <p className="text-zinc-500 text-sm">Tes séances terminées apparaîtront ici</p>
        </motion.div>
      )}

      {/* Sessions by month */}
      <div className="flex flex-col gap-6 px-5">
        {Object.entries(grouped).map(([month, monthSessions], groupIdx) => (
          <motion.div
            key={month}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + groupIdx * 0.06 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest capitalize">{month}</p>
              <div className="flex-1 h-px bg-white/[0.05]" />
              <span className="text-xs text-zinc-600 font-medium">{monthSessions.length} séances</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {monthSessions.map((s, idx) => {
                const completedSets = s.exercises.flatMap(e => e.sets).filter(st => st.completed).length;
                return (
                  <motion.button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="w-full text-left card p-4"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + groupIdx * 0.05 + idx * 0.04 }}
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-black text-base tracking-tight">{s.dayName}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 font-medium capitalize">
                          {new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-orange-400">{Math.round(s.totalVolume)}kg</p>
                        <p className="text-xs text-zinc-500 font-medium">{s.duration}min</p>
                      </div>
                    </div>
                    {/* Volume bar */}
                    <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mb-3">
                      <motion.div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (s.totalVolume / 5000) * 100)}%` }}
                        transition={{ delay: 0.3 + idx * 0.05, duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600 font-medium">{s.exercises.length} ex. · {completedSets} séries</span>
                      {s.prsAchieved?.length > 0 && (
                        <motion.span
                          className="text-xs text-yellow-400 font-bold"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ delay: 0.5 + idx * 0.05, duration: 0.4 }}
                        >🏆 {s.prsAchieved.length} PR</motion.span>
                      )}
                      <span className="text-zinc-600 mx-auto">{'⭐'.repeat(s.mood)}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SessionDetail({ session, onBack }: { session: WorkoutSession; onBack: () => void }) {
  const completedSets = session.exercises.flatMap(e => e.sets).filter(s => s.completed).length;

  return (
    <motion.div
      className="flex flex-col gap-5 pt-14 pb-4"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
    >
      <div className="px-5">
        <motion.button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 mb-5 text-sm font-semibold"
          whileTap={{ scale: 0.95 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Historique
        </motion.button>
        <p className="text-xs text-zinc-600 font-medium capitalize mb-1">
          {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h2 className="text-2xl font-black tracking-tight">{session.dayName}</h2>
      </div>

      {/* Stats */}
      <div className="flex gap-3 px-5">
        {[
          { label: 'Durée', value: `${session.duration}min`, color: 'text-orange-400' },
          { label: 'Volume', value: `${Math.round(session.totalVolume)}kg`, color: 'text-white' },
          { label: 'Séries', value: String(completedSets), color: 'text-emerald-400' },
          { label: 'Humeur', value: ['','😴','😐','🙂','😄','🔥'][session.mood], color: 'text-yellow-400' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            className="flex-1 card p-3 text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: 'spring' }}
          >
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* PRs */}
      <AnimatePresence>
        {session.prsAchieved?.length > 0 && (
          <motion.div
            className="mx-5 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <motion.span animate={{ rotate: [0, -12, 12, 0] }} transition={{ delay: 0.4, duration: 0.5 }}>🏆</motion.span>
              <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Records personnels</p>
            </div>
            {session.prsAchieved.map((pr, i) => (
              <motion.div
                key={i}
                className="flex justify-between items-center py-1.5"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.07 }}
              >
                <span className="text-sm text-zinc-300 font-medium">{pr.exerciseName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-yellow-400">{pr.value.toFixed(1)}kg</span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">+{(pr.value - pr.previousValue).toFixed(1)}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercises */}
      <div className="flex flex-col gap-3 px-5">
        {session.exercises.map((ex, i) => {
          const done = ex.sets.filter(s => s.completed);
          if (!done.length) return null;
          const vol = done.reduce((t, s) => t + s.weight * s.reps, 0);
          return (
            <motion.div
              key={i}
              className="card p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold">{ex.name}</p>
                <span className="text-xs text-zinc-500 font-medium">{Math.round(vol)}kg vol.</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {done.map((s, j) => (
                  <div key={j} className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-orange-500/15 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-orange-400">{s.setNumber}</span>
                      </div>
                      <span className="text-xs text-zinc-500 font-medium">Série {s.setNumber}</span>
                    </div>
                    <span className="text-sm font-black text-zinc-200">{s.weight}kg <span className="text-zinc-500 font-normal">×</span> {s.reps}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* AI Feedback */}
      <AnimatePresence>
        {session.aiCoachFeedback && (
          <motion.div
            className="mx-5 card p-5 border-violet-500/15"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
              </div>
              <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Analyse Coach Elite</p>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{session.aiCoachFeedback}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
