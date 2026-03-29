'use client';

import { useEffect, useState } from 'react';
import { getRecentSessions } from '@/db/workoutService';
import type { WorkoutSession } from '@/db/database';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selected, setSelected] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentSessions(30).then((s) => { setSessions(s); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (selected) {
    return <SessionDetail session={selected} onBack={() => setSelected(null)} />;
  }

  const groupedByMonth: Record<string, WorkoutSession[]> = {};
  for (const s of sessions) {
    const key = new Date(s.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!groupedByMonth[key]) groupedByMonth[key] = [];
    groupedByMonth[key].push(s);
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="text-2xl font-bold mb-6">Historique</h1>

      {sessions.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏋️</p>
          <p className="font-semibold text-zinc-300">Aucune séance</p>
          <p className="text-zinc-500 text-sm mt-1">Tes séances apparaîtront ici</p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(groupedByMonth).map(([month, monthSessions]) => (
          <div key={month}>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3 capitalize">{month}</p>
            <div className="flex flex-col gap-2">
              {monthSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{s.dayName}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-400 font-bold text-sm">{Math.round(s.totalVolume)}kg</p>
                      <p className="text-xs text-zinc-500">{s.duration}min</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <span className="text-xs text-zinc-500">{s.exercises.length} exercices</span>
                    <span className="text-xs text-zinc-500">
                      {s.exercises.flatMap((e) => e.sets).filter((s) => s.completed).length} séries
                    </span>
                    {s.prsAchieved?.length > 0 && (
                      <span className="text-xs text-yellow-500">🏆 {s.prsAchieved.length} PR</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionDetail({ session, onBack }: { session: WorkoutSession; onBack: () => void }) {
  return (
    <div className="px-4 pt-12 pb-4">
      <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 mb-5 text-sm">
        ← Retour
      </button>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">{session.dayName}</h2>
          <p className="text-zinc-400 text-sm">
            {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center">
          <p className="text-lg font-bold text-orange-400">{session.duration}min</p>
          <p className="text-xs text-zinc-500">Durée</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center">
          <p className="text-lg font-bold text-orange-400">{Math.round(session.totalVolume)}kg</p>
          <p className="text-xs text-zinc-500">Volume</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center">
          <p className="text-lg font-bold text-orange-400">
            {['','😴','😐','🙂','😄','🔥'][session.mood]}
          </p>
          <p className="text-xs text-zinc-500">Humeur</p>
        </div>
      </div>

      {session.prsAchieved?.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-2">🏆 Records personnels</p>
          {session.prsAchieved.map((pr, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-zinc-300">{pr.exerciseName}</span>
              <span className="text-yellow-400 font-bold">{pr.value.toFixed(1)}kg (+{(pr.value - pr.previousValue).toFixed(1)})</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 mb-4">
        {session.exercises.map((ex, i) => (
          <div key={i} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3">
            <p className="font-semibold mb-2">{ex.name}</p>
            <div className="flex flex-col gap-1">
              {ex.sets.filter((s) => s.completed).map((s, j) => (
                <div key={j} className="flex justify-between text-sm text-zinc-400">
                  <span>Série {s.setNumber}</span>
                  <span className="font-medium text-zinc-300">{s.weight}kg × {s.reps}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {session.aiCoachFeedback && (
        <div className="bg-zinc-900 border border-orange-500/30 rounded-2xl p-4">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">🤖 Analyse ApexCoach</p>
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{session.aiCoachFeedback}</p>
        </div>
      )}
    </div>
  );
}
