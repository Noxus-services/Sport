'use client';

import { useEffect, useState } from 'react';
import { getAllPrograms, setActiveProgram, deleteProgram, saveProgram } from '@/db/programService';
import { getUserProfile } from '@/db/userProfileService';
import { getRecentSessions } from '@/db/workoutService';
import { generateProgram } from '@/lib/gemini-client';
import type { Program, UserProfile } from '@/db/database';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    const [progs, p] = await Promise.all([getAllPrograms(), getUserProfile()]);
    setPrograms(progs);
    setProfile(p ?? null);
  }

  useEffect(() => { load(); }, []);

  async function handleGenerate() {
    if (!profile) return;
    setGenerating(true); setError('');
    try {
      const sessions = await getRecentSessions(10);
      const data = await generateProgram(profile, sessions);
      await saveProgram({ ...(data as object), generatedAt: new Date(), weekNumber: 0, isActive: true } as Parameters<typeof saveProgram>[0]);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur Gemini. Vérifie ta clé API dans Profil.');
    }
    setGenerating(false);
  }

  async function handleActivate(id: number) {
    await setActiveProgram(id); await load();
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer ce programme ?')) return;
    await deleteProgram(id); await load();
  }

  return (
    <div className="flex flex-col gap-5 pt-14 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5">
        <div>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">ApexCoach</p>
          <h1 className="text-[28px] font-black tracking-tight">Programmes</h1>
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
            generating ? 'bg-white/5 text-zinc-500 border border-white/[0.07]' : 'btn-primary'
          }`}>
          {generating ? (
            <><span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" /> Génération…</>
          ) : (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg> Générer</>
          )}
        </button>
      </div>

      {error && (
        <div className="mx-5 p-4 bg-red-500/8 border border-red-500/20 rounded-2xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {generating && (
        <div className="mx-5 card p-6 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="font-bold">Création de ton programme…</p>
            <p className="text-zinc-500 text-sm mt-1">L'IA analyse ton profil et ton historique</p>
          </div>
        </div>
      )}

      {programs.length === 0 && !generating && (
        <div className="mx-5 card p-10 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center text-3xl">📋</div>
          <p className="font-bold text-lg">Aucun programme</p>
          <p className="text-zinc-500 text-sm">Génère un programme IA 100% personnalisé en un tap</p>
        </div>
      )}

      <div className="flex flex-col gap-4 px-5">
        {programs.map(prog => (
          <div key={prog.id} className={`card overflow-hidden ${prog.isActive ? 'border-orange-500/25' : ''}`}>
            {prog.isActive && (
              <div className="h-0.5 bg-gradient-to-r from-orange-500 to-orange-400" />
            )}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                  {prog.isActive && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-lg font-bold uppercase tracking-widest mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      Actif
                    </span>
                  )}
                  <h3 className="font-black text-lg tracking-tight">{prog.name}</h3>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {new Date(prog.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · {prog.weeks?.length ?? 0} sem.
                  </p>
                </div>
                <button onClick={() => setExpanded(expanded === prog.id ? null : prog.id!)}
                  className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-400 flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    {expanded === prog.id ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                  </svg>
                </button>
              </div>

              {prog.aiRationale && (
                <p className="text-zinc-400 text-sm leading-relaxed mb-4 line-clamp-2">{prog.aiRationale}</p>
              )}

              {/* Day grid */}
              {prog.weeks?.[0] && (
                <div className="flex gap-1 mb-4">
                  {DAYS.map((day, i) => {
                    const hasDay = prog.weeks[0].days.some(d => d.dayIndex === i);
                    const dayName = prog.weeks[0].days.find(d => d.dayIndex === i)?.name ?? '';
                    return (
                      <div key={i} title={dayName} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full h-6 rounded-lg flex items-center justify-center text-[9px] font-bold transition-all ${
                          hasDay ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25' : 'bg-white/[0.04] text-zinc-700'
                        }`}>
                          {hasDay ? day[0] : ''}
                        </div>
                        <span className="text-[8px] text-zinc-700 font-medium">{day}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                {!prog.isActive && (
                  <button onClick={() => handleActivate(prog.id!)}
                    className="flex-1 py-2.5 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] rounded-xl text-zinc-300 font-semibold text-sm transition-all">
                    Activer
                  </button>
                )}
                <button onClick={() => handleDelete(prog.id!)}
                  className="w-10 h-10 flex items-center justify-center bg-white/[0.04] border border-white/[0.07] rounded-xl text-zinc-600 hover:text-red-400 hover:border-red-900/40 transition-all">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
              </div>
            </div>

            {/* Expanded */}
            {expanded === prog.id && prog.weeks?.[0] && (
              <div className="border-t border-white/[0.06] p-5 flex flex-col gap-3">
                {prog.weeks[0].days.map(day => (
                  <div key={day.dayIndex} className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold">{day.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{DAYS[day.dayIndex]} · {day.focus} · {day.estimatedDuration}min</p>
                      </div>
                      <span className="text-xs bg-white/[0.05] border border-white/[0.08] text-zinc-400 px-2 py-1 rounded-lg font-medium">
                        {day.exercises.length} ex.
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {day.exercises.map((ex, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <span className="text-sm text-zinc-300 font-medium">{ex.name}</span>
                          <span className="text-xs text-zinc-500 font-mono">{ex.sets}×{ex.repsMin}-{ex.repsMax} · RPE {ex.rpe}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
