'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getActiveSession, updateSessionExercises, finishWorkoutSession,
  saveAiCoachFeedback, getRecentSessions, cancelWorkoutSession,
} from '@/db/workoutService';
import { getTodayProgramDay } from '@/db/programService';
import { getUserProfile } from '@/db/userProfileService';
import { analyzeWorkout } from '@/lib/gemini-client';
import type { WorkoutSession, LoggedExercise, LoggedSet, PlannedExercise } from '@/db/database';

type FinishState = 'idle' | 'form' | 'analyzing' | 'done';

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<LoggedExercise[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState({ active: false, remaining: 0, total: 0 });
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
        const planned = await getTodayProgramDay();
        if (planned) setExercises(planned.exercises.map(plannedToLogged));
      }
      const startTime = active.startedAt instanceof Date ? active.startedAt : new Date(active.startedAt);
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000)), 1000);
    }
    load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restRef.current) clearInterval(restRef.current);
    };
  }, [router]);

  const scheduleSave = useCallback((exs: LoggedExercise[]) => {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      if (session?.id) await updateSessionExercises(session.id, exs);
    }, 3000);
  }, [session?.id]);

  function updateSet(exIdx: number, setIdx: number, field: keyof LoggedSet, value: string | boolean | number) {
    setExercises(prev => {
      const updated = prev.map((ex, i) => i !== exIdx ? ex : {
        ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value }),
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
    if (nowCompleted && restSeconds > 0) startRestTimer(restSeconds);
  }

  function addSet(exIdx: number) {
    setExercises(prev => {
      const updated = prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { setNumber: ex.sets.length + 1, weight: last?.weight ?? 0, reps: last?.reps ?? 8, completed: false, timestamp: new Date() }] };
      });
      scheduleSave(updated);
      return updated;
    });
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises(prev => {
      const updated = prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx).map((s, j) => ({ ...s, setNumber: j + 1 })) };
      });
      scheduleSave(updated);
      return updated;
    });
  }

  function startRestTimer(seconds: number) {
    if (restRef.current) clearInterval(restRef.current);
    setRestTimer({ active: true, remaining: seconds, total: seconds });
    restRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (prev.remaining <= 1) { if (restRef.current) clearInterval(restRef.current); return { ...prev, active: false, remaining: 0 }; }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  }

  async function handleCancel() {
    if (!session?.id) return;
    if (!confirm('Annuler la séance ? Aucune donnée ne sera sauvegardée.')) return;
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
      const [updated, profile, history] = await Promise.all([
        import('@/db/workoutService').then(m => m.getSessionById(session.id!)),
        getUserProfile(), getRecentSessions(10),
      ]);
      if (updated) {
        const fb = await analyzeWorkout(updated, profile ?? null, history);
        await saveAiCoachFeedback(session.id, fb);
        setFeedback(fb);
      }
    } catch { /* feedback optional */ }
    if (timerRef.current) clearInterval(timerRef.current);
    setFinishState('done');
  }

  const completedSets = exercises.flatMap(e => e.sets).filter(s => s.completed).length;
  const totalSets = exercises.flatMap(e => e.sets).length;
  const totalVolume = exercises.reduce((t, ex) => t + ex.sets.filter(s => s.completed).reduce((s, set) => s + set.weight * set.reps, 0), 0);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  if (finishState === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-5 bg-[#0a0a0a]">
        <div className="w-14 h-14 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="font-bold text-lg">Analyse en cours…</p>
          <p className="text-zinc-500 text-sm mt-1">Ton coach IA prépare ton feedback</p>
        </div>
      </div>
    );
  }

  if (finishState === 'done') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] px-5 pt-16 pb-8 flex flex-col gap-5">
        <div className="text-center py-4">
          <div className="w-20 h-20 rounded-3xl bg-orange-500/10 border border-orange-500/25 mx-auto flex items-center justify-center text-4xl mb-4">🏆</div>
          <h1 className="text-3xl font-black tracking-tight">Séance terminée !</h1>
          <p className="text-zinc-400 text-sm mt-2">Continue sur cette lancée.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Durée', value: `${mm}:${ss}` },
            { label: 'Volume', value: `${Math.round(totalVolume)}kg` },
            { label: 'Séries', value: String(completedSets) },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-black text-orange-400">{s.value}</p>
              <p className="text-zinc-500 text-xs mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
        {feedback && (
          <div className="card p-5 border-orange-500/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
              </div>
              <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">Analyse ApexCoach</p>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{feedback}</p>
          </div>
        )}
        <button onClick={() => router.replace('/dashboard')} className="btn-primary py-4 text-base">
          Retour à l'accueil
        </button>
      </div>
    );
  }

  if (finishState === 'form') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] px-5 pt-14 pb-8 flex flex-col gap-5">
        <div>
          <button onClick={() => setFinishState('idle')} className="flex items-center gap-2 text-zinc-500 mb-4 text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Retour
          </button>
          <h2 className="text-2xl font-black">Terminer la séance</h2>
          <p className="text-zinc-500 text-sm mt-1">Comment s'est passée cette séance ?</p>
        </div>

        <EmojiRating label="Humeur" value={mood} onChange={setMood} emojis={['😴','😐','🙂','😄','🔥']} />
        <EmojiRating label="Énergie" value={energy} onChange={setEnergy} emojis={['💀','😮‍💨','😐','💪','⚡']} />

        <div>
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-2.5">Notes</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Ressenti, observations, points à améliorer…"
            rows={3}
            className="w-full bg-[#111] border border-white/[0.07] rounded-2xl px-4 py-3.5 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>

        <button onClick={submitFinish} className="btn-primary py-4 text-base mt-auto">
          Analyser avec l'IA
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur px-5 pt-12 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-widest">Séance active</p>
            <h1 className="font-black text-lg tracking-tight">{session?.dayName}</h1>
          </div>
          <div className="text-right">
            <p className="text-orange-400 font-black text-2xl font-mono tracking-tight">{mm}:{ss}</p>
            <p className="text-[10px] text-zinc-500 font-medium">{Math.round(totalVolume)}kg · {completedSets}/{totalSets} séries</p>
          </div>
        </div>
        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500 shadow-sm shadow-orange-500/50"
            style={{ width: totalSets ? `${(completedSets / totalSets) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Rest timer overlay */}
      {restTimer.active && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/95 backdrop-blur flex flex-col items-center justify-center gap-6">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.3em]">Repos</p>
          <div className="relative">
            <svg className="w-44 h-44 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"/>
              <circle cx="50" cy="50" r="44" fill="none" stroke="#f97316" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - restTimer.remaining / restTimer.total)}`}
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 8px rgba(249,115,22,0.5))', transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black font-mono text-white">{restTimer.remaining}</span>
              <span className="text-zinc-500 text-xs font-medium mt-1">secondes</span>
            </div>
          </div>
          <button onClick={() => { if (restRef.current) clearInterval(restRef.current); setRestTimer({ active: false, remaining: 0, total: 0 }); }}
            className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-zinc-300 text-sm font-semibold">
            Passer
          </button>
        </div>
      )}

      {/* Exercise tabs */}
      <div className="flex gap-2 px-5 py-3 overflow-x-auto no-scrollbar">
        {exercises.map((ex, i) => {
          const done = ex.sets.filter(s => s.completed).length;
          const total = ex.sets.length;
          const complete = done === total && total > 0;
          return (
            <button key={i} onClick={() => setActiveExIndex(i)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeExIndex === i ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                : complete ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-white/[0.04] border border-white/[0.07] text-zinc-400'
              }`}>
              {complete && '✓ '}{done}/{total} {ex.name.split(' ').slice(0,2).join(' ')}
            </button>
          );
        })}
        <button
          onClick={() => {
            const name = prompt('Nom de l\'exercice ?');
            if (!name) return;
            const updated = [...exercises, { exerciseId: name.toLowerCase().replace(/\s+/g, '-'), name, sets: [{ setNumber: 1, weight: 0, reps: 8, completed: false, timestamp: new Date() }] }];
            setExercises(updated);
            scheduleSave(updated);
            setActiveExIndex(updated.length - 1);
          }}
          className="flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold border border-dashed border-white/[0.12] text-zinc-600">
          + Ajouter
        </button>
      </div>

      {/* Exercise content */}
      <div className="flex-1 px-5 pb-4 overflow-y-auto">
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

      {/* Bottom actions */}
      <div className="px-5 py-4 border-t border-white/[0.06] bg-[#0a0a0a] flex gap-3">
        <button onClick={handleCancel}
          className="px-4 py-3.5 bg-white/[0.04] border border-white/[0.07] rounded-2xl text-zinc-400 hover:text-red-400 hover:border-red-900/50 transition-all text-sm font-semibold">
          Annuler
        </button>
        <button onClick={() => setFinishState('form')}
          className="flex-1 py-3.5 btn-primary text-sm">
          Terminer ({completedSets}/{totalSets})
        </button>
      </div>
    </div>
  );
}

function ExerciseLogger({ exercise, exIdx, onUpdateSet, onToggleSet, onAddSet, onRemoveSet }: {
  exercise: LoggedExercise; exIdx: number;
  onUpdateSet: (ei: number, si: number, f: keyof LoggedSet, v: string|boolean|number) => void;
  onToggleSet: (ei: number, si: number, rest: number) => void;
  onAddSet: (ei: number) => void;
  onRemoveSet: (ei: number, si: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-2xl font-black tracking-tight">{exercise.name}</h2>

      {/* Column headers */}
      <div className="grid grid-cols-[44px_1fr_1fr_36px] gap-2 px-1">
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Sér.</span>
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Poids kg</span>
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Reps</span>
        <span />
      </div>

      {/* Sets */}
      <div className="flex flex-col gap-2">
        {exercise.sets.map((set, setIdx) => (
          <div key={setIdx} className={`grid grid-cols-[44px_1fr_1fr_36px] gap-2 items-center p-2.5 rounded-2xl transition-all ${
            set.completed ? 'bg-orange-500/8 border border-orange-500/20' : 'bg-white/[0.03] border border-white/[0.06]'
          }`}>
            <button onClick={() => onToggleSet(exIdx, setIdx, 90)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                set.completed ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-white/[0.06] border border-white/[0.1] text-zinc-400'
              }`}>
              {set.completed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : set.setNumber}
            </button>

            <input type="number" value={set.weight || ''} onChange={e => onUpdateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
              placeholder="0"
              className={`text-center py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-black text-xl focus:outline-none focus:border-orange-500/50 transition-colors ${set.completed ? 'opacity-50' : ''}`}
            />
            <input type="number" value={set.reps || ''} onChange={e => onUpdateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
              placeholder="0"
              className={`text-center py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-black text-xl focus:outline-none focus:border-orange-500/50 transition-colors ${set.completed ? 'opacity-50' : ''}`}
            />
            <button onClick={() => onRemoveSet(exIdx, setIdx)}
              className="w-8 h-8 flex items-center justify-center text-zinc-700 hover:text-red-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
      </div>

      <button onClick={() => onAddSet(exIdx)}
        className="w-full py-3 bg-white/[0.03] border border-dashed border-white/[0.1] rounded-2xl text-zinc-500 text-sm font-semibold hover:border-white/20 transition-colors">
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
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-3">{label}</label>
      <div className="flex gap-2">
        {emojis.map((emoji, i) => (
          <button key={i} onClick={() => onChange((i + 1) as 1|2|3|4|5)}
            className={`flex-1 py-3.5 rounded-2xl border text-xl transition-all ${
              value === i + 1 ? 'border-orange-500/50 bg-orange-500/10 scale-110 shadow-lg shadow-orange-500/10' : 'border-white/[0.07] bg-white/[0.03]'
            }`}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function plannedToLogged(ex: PlannedExercise): LoggedExercise {
  return {
    exerciseId: ex.exerciseId, name: ex.name,
    sets: Array.from({ length: ex.sets }, (_, i) => ({ setNumber: i + 1, weight: 0, reps: ex.repsMin, completed: false, timestamp: new Date() })),
  };
}
