'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveProgram, getTodayProgramDay } from '@/db/programService';
import { startWorkoutSession, getActiveSession } from '@/db/workoutService';
import type { Program, ProgramDay } from '@/db/database';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function WorkoutPage() {
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [todayDay, setTodayDay] = useState<ProgramDay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [prog, td, active] = await Promise.all([
        getActiveProgram(),
        getTodayProgramDay(),
        getActiveSession(),
      ]);
      if (active) { router.replace('/workout/active'); return; }
      setProgram(prog ?? null);
      setTodayDay(td);
      setLoading(false);
    }
    load();
  }, [router]);

  async function start(day: ProgramDay) {
    await startWorkoutSession(day.name, `day-${day.dayIndex}`);
    router.push('/workout/active');
  }

  async function startFree() {
    await startWorkoutSession('Séance libre');
    router.push('/workout/active');
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const allDays = program?.weeks?.[0]?.days ?? [];

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="text-2xl font-bold mb-6">Séances</h1>

      {todayDay && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">Prévu aujourd'hui</p>
          <DayCard day={todayDay} onStart={() => start(todayDay)} highlighted />
        </div>
      )}

      {allDays.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Programme complet</p>
          <div className="flex flex-col gap-3">
            {allDays.map((day) => (
              <DayCard key={day.dayIndex} day={day} onStart={() => start(day)} />
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800 pt-4">
        <button
          onClick={startFree}
          className="w-full py-3.5 border border-zinc-700 rounded-xl text-zinc-400 font-semibold hover:border-zinc-500 transition-colors"
        >
          + Séance libre
        </button>
      </div>
    </div>
  );
}

function DayCard({ day, onStart, highlighted }: {
  day: ProgramDay; onStart: () => void; highlighted?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 border ${highlighted ? 'border-orange-500/40 bg-orange-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">{DAYS[day.dayIndex]}</p>
          <h3 className="font-bold text-lg">{day.name}</h3>
          <p className="text-zinc-400 text-sm">{day.focus}</p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>{day.exercises.length} ex.</p>
          <p>{day.estimatedDuration} min</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {day.exercises.slice(0, 3).map((ex, i) => (
          <span key={i} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
            {ex.name}
          </span>
        ))}
        {day.exercises.length > 3 && (
          <span className="text-xs text-zinc-600 px-2 py-0.5">+{day.exercises.length - 3}</span>
        )}
      </div>
      <button
        onClick={onStart}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
          highlighted
            ? 'bg-orange-500 hover:bg-orange-600 text-white'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
        }`}
      >
        Démarrer
      </button>
    </div>
  );
}
