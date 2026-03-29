'use client';

import { useEffect, useState } from 'react';
import { getRecentSessions } from '@/db/workoutService';
import type { WorkoutSession } from '@/db/database';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selected, setSelected] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentSessions(50).then(s => { setSessions(s); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
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

  return (
    <div className="flex flex-col gap-5 pt-14 pb-4">
      {/* Header */}
      <div className="px-5">
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">ApexCoach</p>
        <h1 className="text-[28px] font-black tracking-tight">Historique</h1>
      </div>

      {/* Summary stats */}
      {totalSessions > 0 && (
        <div className="flex gap-3 px-5">
          <div className="flex-1 card p-4 text-center">
            <p className="text-2xl font-black text-orange-400">{totalSessions}</p>
            <p className="text-[10px] font-semibold text-zinc-500 mt-1 uppercase tracking-wide">Séances</p>
          </div>
          <div className="flex-1 card p-4 text-center">
            <p className="text-2xl font-black text-white">
              {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(0)}T` : `${Math.round(totalVolume)}kg`}
            </p>
            <p className="text-[10px] font-semibold text-zinc-500 mt-1 uppercase tracking-wide">Volume</p>
          </div>
          <div className="flex-1 card p-4 text-center">
            <p className="text-2xl font-black text-white">{totalPRs}</p>
            <p className="text-[10px] font-semibold text-zinc-500 mt-1 uppercase tracking-wide">PRs</p>
          </div>
          <div className="flex-1 card p-4 text-center">
            <p className="text-2xl font-black text-white">{avgDuration}m</p>
            <p className="text-[10px] font-semibold text-zinc-500 mt-1 uppercase tracking-wide">Durée moy.</p>
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="mx-5 card p-10 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center text-3xl">🏋️</div>
          <p className="font-bold text-lg">Aucune séance</p>
          <p className="text-zinc-500 text-sm">Tes séances terminées apparaîtront ici</p>
        </div>
      )}

      {/* Sessions by month */}
      <div className="flex flex-col gap-6 px-5">
        {Object.entries(grouped).map(([month, monthSessions]) => (
          <div key={month}>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest capitalize">{month}</p>
              <div className="flex-1 h-px bg-white/[0.05]" />
              <span className="text-xs text-zinc-600 font-medium">{monthSessions.length} séances</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {monthSessions.map(s => {
                const completedSets = s.exercises.flatMap(e => e.sets).filter(st => st.completed).length;
                const maxVolExercise = s.exercises.reduce((best, ex) => {
                  const vol = ex.sets.filter(st => st.completed).reduce((t, st) => t + st.weight * st.reps, 0);
                  const bestVol = best.sets.filter(st => st.completed).reduce((t, st) => t + st.weight * st.reps, 0);
                  return vol > bestVol ? ex : best;
                }, s.exercises[0]);

                return (
                  <button key={s.id} onClick={() => setSelected(s)}
                    className="w-full text-left card p-4 hover:border-white/[0.1] active:scale-[0.99] transition-all">
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
                      <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
                        style={{ width: `${Math.min(100, (s.totalVolume / 5000) * 100)}%` }} />
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600 font-medium">{s.exercises.length} ex. · {completedSets} séries</span>
                      {s.prsAchieved?.length > 0 && (
                        <span className="text-xs text-yellow-500 font-bold">🏆 {s.prsAchieved.length} PR</span>
                      )}
                      <span className="text-zinc-600 mx-auto">{'⭐'.repeat(s.mood)}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionDetail({ session, onBack }: { session: WorkoutSession; onBack: () => void }) {
  const completedSets = session.exercises.flatMap(e => e.sets).filter(s => s.completed).length;

  return (
    <div className="flex flex-col gap-5 pt-14 pb-4">
      <div className="px-5">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 mb-5 text-sm font-semibold">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Historique
        </button>
        <p className="text-xs text-zinc-600 font-medium capitalize mb-1">
          {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h2 className="text-2xl font-black tracking-tight">{session.dayName}</h2>
      </div>

      {/* Stats */}
      <div className="flex gap-3 px-5">
        {[
          { label: 'Durée', value: `${session.duration}min` },
          { label: 'Volume', value: `${Math.round(session.totalVolume)}kg` },
          { label: 'Séries', value: String(completedSets) },
          { label: 'Humeur', value: ['','😴','😐','🙂','😄','🔥'][session.mood] },
        ].map(s => (
          <div key={s.label} className="flex-1 card p-3 text-center">
            <p className="text-lg font-black text-orange-400">{s.value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* PRs */}
      {session.prsAchieved?.length > 0 && (
        <div className="mx-5 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span>🏆</span>
            <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Records personnels</p>
          </div>
          {session.prsAchieved.map((pr, i) => (
            <div key={i} className="flex justify-between items-center py-1.5">
              <span className="text-sm text-zinc-300 font-medium">{pr.exerciseName}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-yellow-400">{pr.value.toFixed(1)}kg</span>
                <span className="text-xs font-bold text-emerald-500">+{(pr.value - pr.previousValue).toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Exercises */}
      <div className="flex flex-col gap-3 px-5">
        {session.exercises.map((ex, i) => {
          const done = ex.sets.filter(s => s.completed);
          if (!done.length) return null;
          const vol = done.reduce((t, s) => t + s.weight * s.reps, 0);
          return (
            <div key={i} className="card p-4">
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
            </div>
          );
        })}
      </div>

      {/* AI Feedback */}
      {session.aiCoachFeedback && (
        <div className="mx-5 card p-5 border-orange-500/15">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
            </div>
            <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">Analyse ApexCoach</p>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{session.aiCoachFeedback}</p>
        </div>
      )}
    </div>
  );
}
