'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getActiveSession,
  updateSessionExercises,
  finishWorkoutSession,
  saveAiCoachFeedback,
  getRecentSessions,
  cancelWorkoutSession,
} from '@/db/workoutService';
import { getTodayProgramDay } from '@/db/programService';
import { getUserProfile } from '@/db/userProfileService';
import { analyzeWorkout } from '@/lib/gemini-client';
import type { WorkoutSession, LoggedExercise, LoggedSet, PlannedExercise } from '@/db/database';

type FinishState = 'idle' | 'form' | 'analyzing' | 'done' | 'cancel';

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<LoggedExercise[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState<{ active: boolean; remaining: number; total: number }>({
    active: false, remaining: 0, total: 0,
  });
  const [finishState, setFinishState] = useState<FinishState>('idle');
  const [mood, setMood] = useState<1|2|3|4|5>(3);
  const [energy, setEnergy] = useState<1|2|3|4|5>(3);
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const [activeExIndex, setActiveExIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      const active = await getActiveSession();
      if (!active?.id) { router.replace('/workout'); return; }
      setSession(active);

      if (active.exercises?.length > 0) {
        setExercises(active.exercises);
      } else {
        // Pre-populate from program
        const planned = await getTodayProgramDay();
        if (planned) {
          setExercises(planned.exercises.map((ex) => plannedToLogged(ex)));
        }
      }

      // Start elapsed timer
      const startTime = active.startedAt instanceof Date ? active.startedAt : new Date(active.startedAt);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    }
    load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restRef.current) clearInterval(restRef.current);
    };
  }, [router]);

  // Auto-save exercises every 3s after a change
  const scheduleSave = useCallback((exs: LoggedExercise[]) => {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      if (session?.id) await updateSessionExercises(session.id, exs);
    }, 3000);
  }, [session?.id]);

  function updateSet(exIdx: number, setIdx: number, field: keyof LoggedSet, value: string | boolean | number) {
    setExercises((prev) => {
      const updated = prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value }),
        };
      });
      scheduleSave(updated);
      return updated;
    });
  }

  function toggleSet(exIdx: number, setIdx: number, restSeconds: number) {
    const set = exercises[exIdx]?.sets[setIdx];
    if (!set) return;
    const nowCompleted = !set.completed;
    updateSet(exIdx, setIdx, 'completed', nowCompleted);

    if (nowCompleted && restSeconds > 0) {
      startRestTimer(restSeconds);
    }
  }

  function addSet(exIdx: number) {
    setExercises((prev) => {
      const updated = prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              setNumber: ex.sets.length + 1,
              weight: lastSet?.weight ?? 0,
              reps: lastSet?.reps ?? 8,
              completed: false,
              timestamp: new Date(),
            },
          ],
        };
      });
      scheduleSave(updated);
      return updated;
    });
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises((prev) => {
      const updated = prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.filter((_, j) => j !== setIdx)
          .map((s, j) => ({ ...s, setNumber: j + 1 }));
        return { ...ex, sets };
      });
      scheduleSave(updated);
      return updated;
    });
  }

  function startRestTimer(seconds: number) {
    if (restRef.current) clearInterval(restRef.current);
    setRestTimer({ active: true, remaining: seconds, total: seconds });
    restRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev.remaining <= 1) {
          if (restRef.current) clearInterval(restRef.current);
          return { ...prev, active: false, remaining: 0 };
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  }

  function dismissTimer() {
    if (restRef.current) clearInterval(restRef.current);
    setRestTimer({ active: false, remaining: 0, total: 0 });
  }

  async function handleFinish() {
    if (!session?.id) return;
    setFinishState('form');
  }

  async function handleCancel() {
    if (!session?.id) return;
    if (timerRef.current) clearInterval(timerRef.current);
    await cancelWorkoutSession(session.id);
    router.replace('/dashboard');
  }

  async function submitFinish() {
    if (!session?.id) return;
    setFinishState('analyzing');
    await updateSessionExercises(session.id, exercises);
    await finishWorkoutSession(session.id, { mood, energy, notes });

    try {
      const [updatedSession, profile, history] = await Promise.all([
        import('@/db/workoutService').then((m) => m.getSessionById(session.id!)),
        getUserProfile(),
        getRecentSessions(10),
      ]);
      if (updatedSession) {
        const feedback = await analyzeWorkout(updatedSession, profile ?? null, history);
        await saveAiCoachFeedback(session.id, feedback);
        setFeedback(feedback);
      }
    } catch { /* feedback optional */ }

    setFinishState('done');
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const completedSets = exercises.flatMap((e) => e.sets).filter((s) => s.completed).length;
  const totalSets = exercises.flatMap((e) => e.sets).length;
  const totalVolume = exercises.reduce((t, ex) =>
    t + ex.sets.filter((s) => s.completed).reduce((s, set) => s + set.weight * set.reps, 0), 0);

  const hms = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  // FINISH SCREEN
  if (finishState === 'done') {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 pt-12 pb-8 flex flex-col gap-5">
        <div className="text-center">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-2xl font-bold">Séance terminée !</h1>
          <p className="text-zinc-400 text-sm mt-1">Excellent travail, continue comme ça.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center">
            <p className="text-xl font-bold text-orange-400">{hms}</p>
            <p className="text-xs text-zinc-500">Durée</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center">
            <p className="text-xl font-bold text-orange-400">{Math.round(totalVolume)}kg</p>
            <p className="text-xs text-zinc-500">Volume</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center">
            <p className="text-xl font-bold text-orange-400">{completedSets}</p>
            <p className="text-xs text-zinc-500">Séries</p>
          </div>
        </div>
        {feedback && (
          <div className="bg-zinc-900 rounded-2xl p-4 border border-orange-500/30">
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">🤖 Analyse ApexCoach</p>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{feedback}</p>
          </div>
        )}
        <button
          onClick={() => router.replace('/dashboard')}
          className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  // FINISH FORM
  if (finishState === 'form') {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 pt-12 pb-8 flex flex-col gap-5">
        <h2 className="text-xl font-bold">Terminer la séance</h2>
        <EmojiRating label="😴 Humeur" value={mood} onChange={setMood} emojis={['😴','😐','🙂','😄','🔥']} />
        <EmojiRating label="⚡ Énergie" value={energy} onChange={setEnergy} emojis={['💀','😮‍💨','😐','💪','⚡']} />
        <div>
          <label className="text-sm font-medium text-zinc-400 block mb-2">Notes (optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ressenti, observations..."
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setFinishState('idle')} className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400">
            ← Annuler
          </button>
          <button onClick={submitFinish} className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl">
            Confirmer & analyser 🤖
          </button>
        </div>
      </div>
    );
  }

  if (finishState === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-semibold">Analyse de ta séance…</p>
        <p className="text-zinc-500 text-sm">Gemini génère ton feedback</p>
      </div>
    );
  }

  // MAIN WORKOUT SCREEN
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Fixed header */}
      <div className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur px-4 pt-10 pb-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-zinc-500">Séance en cours</p>
            <h1 className="font-bold text-lg">{session?.dayName}</h1>
          </div>
          <div className="text-right">
            <p className="text-orange-400 font-mono font-bold text-lg">{hms}</p>
            <p className="text-xs text-zinc-500">{Math.round(totalVolume)}kg total</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{ width: totalSets ? `${(completedSets / totalSets) * 100}%` : '0%' }}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-1">{completedSets}/{totalSets} séries</p>
      </div>

      {/* Rest timer overlay */}
      {restTimer.active && (
        <div className="fixed inset-0 z-50 bg-zinc-950/90 flex flex-col items-center justify-center gap-4">
          <p className="text-zinc-400 text-sm uppercase tracking-widest">Repos</p>
          <div className="relative">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#27272a" strokeWidth="8"/>
              <circle
                cx="50" cy="50" r="44" fill="none" stroke="#f97316" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - restTimer.remaining / restTimer.total)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold">{restTimer.remaining}s</span>
            </div>
          </div>
          <button onClick={dismissTimer} className="px-6 py-2.5 border border-zinc-700 rounded-xl text-zinc-400 text-sm">
            Passer
          </button>
        </div>
      )}

      {/* Exercise tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
        {exercises.map((ex, i) => {
          const done = ex.sets.filter((s) => s.completed).length;
          const total = ex.sets.length;
          const complete = done === total && total > 0;
          return (
            <button
              key={i}
              onClick={() => setActiveExIndex(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                activeExIndex === i
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : complete
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-400 line-through'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400'
              }`}
            >
              {done}/{total} {ex.name.split(' ')[0]}
            </button>
          );
        })}
        <button
          onClick={() => {
            const name = prompt('Nom de l\'exercice ?');
            if (!name) return;
            setExercises((prev) => {
              const updated = [...prev, {
                exerciseId: name.toLowerCase().replace(/\s+/g, '-'),
                name,
                sets: [{ setNumber: 1, weight: 0, reps: 8, completed: false, timestamp: new Date() }],
              }];
              scheduleSave(updated);
              return updated;
            });
            setActiveExIndex(exercises.length);
          }}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-zinc-700 text-zinc-600"
        >
          + Ajouter
        </button>
      </div>

      {/* Active exercise */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        {exercises[activeExIndex] && (
          <ExerciseLogger
            exercise={exercises[activeExIndex]}
            exIdx={activeExIndex}
            onUpdateSet={updateSet}
            onToggleSet={toggleSet}
            onAddSet={addSet}
            onRemoveSet={removeSet}
          />
        )}
      </div>

      {/* Bottom buttons */}
      <div className="px-4 py-4 border-t border-zinc-800 bg-zinc-950 flex gap-3">
        <button
          onClick={() => {
            if (confirm('Annuler la séance ? Les données ne seront pas sauvegardées.')) {
              handleCancel();
            }
          }}
          className="px-4 py-3.5 border border-zinc-700 rounded-xl text-zinc-400 hover:border-red-800 hover:text-red-400 transition-colors text-sm font-semibold"
        >
          Annuler
        </button>
        <button
          onClick={handleFinish}
          className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
        >
          Terminer ({completedSets}/{totalSets})
        </button>
      </div>
    </div>
  );
}

function ExerciseLogger({ exercise, exIdx, onUpdateSet, onToggleSet, onAddSet, onRemoveSet }: {
  exercise: LoggedExercise;
  exIdx: number;
  onUpdateSet: (exIdx: number, setIdx: number, field: keyof LoggedSet, value: string | boolean | number) => void;
  onToggleSet: (exIdx: number, setIdx: number, restSeconds: number) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="mt-2">
        <h2 className="text-xl font-bold">{exercise.name}</h2>
      </div>

      {/* Set headers */}
      <div className="grid grid-cols-[32px_1fr_1fr_40px] gap-2 px-1">
        <span className="text-xs text-zinc-600 text-center">Sér.</span>
        <span className="text-xs text-zinc-600 text-center">Poids (kg)</span>
        <span className="text-xs text-zinc-600 text-center">Reps</span>
        <span />
      </div>

      {/* Sets */}
      <div className="flex flex-col gap-2">
        {exercise.sets.map((set, setIdx) => (
          <div
            key={setIdx}
            className={`grid grid-cols-[32px_1fr_1fr_40px] gap-2 items-center p-2 rounded-xl transition-all ${
              set.completed ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-zinc-900 border border-zinc-800'
            }`}
          >
            <button
              onClick={() => onToggleSet(exIdx, setIdx, 90)}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
                set.completed ? 'bg-orange-500 border-orange-500 text-white' : 'border-zinc-600 text-zinc-600'
              }`}
            >
              {set.completed ? '✓' : set.setNumber}
            </button>

            <input
              type="number"
              value={set.weight || ''}
              onChange={(e) => onUpdateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
              placeholder="0"
              className={`text-center py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-lg focus:outline-none focus:border-orange-500 ${
                set.completed ? 'opacity-60' : ''
              }`}
            />

            <input
              type="number"
              value={set.reps || ''}
              onChange={(e) => onUpdateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
              placeholder="0"
              className={`text-center py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-lg focus:outline-none focus:border-orange-500 ${
                set.completed ? 'opacity-60' : ''
              }`}
            />

            <button
              onClick={() => onRemoveSet(exIdx, setIdx)}
              className="w-8 h-8 flex items-center justify-center text-zinc-700 hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onAddSet(exIdx)}
        className="w-full py-2.5 border border-dashed border-zinc-700 rounded-xl text-zinc-500 text-sm hover:border-zinc-500 transition-colors"
      >
        + Ajouter une série
      </button>
    </div>
  );
}

function EmojiRating({ label, value, onChange, emojis }: {
  label: string; value: number; onChange: (v: 1|2|3|4|5) => void; emojis: string[];
}) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-400 block mb-2">{label}</label>
      <div className="flex justify-between gap-2">
        {emojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onChange((i + 1) as 1|2|3|4|5)}
            className={`flex-1 py-3 rounded-xl border text-xl transition-all ${
              value === i + 1
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-zinc-700 bg-zinc-900'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function plannedToLogged(ex: PlannedExercise): LoggedExercise {
  return {
    exerciseId: ex.exerciseId,
    name: ex.name,
    sets: Array.from({ length: ex.sets }, (_, i) => ({
      setNumber: i + 1,
      weight: 0,
      reps: ex.repsMin,
      completed: false,
      timestamp: new Date(),
    })),
  };
}
