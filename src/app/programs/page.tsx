'use client';

import { useEffect, useState } from 'react';
import { getAllPrograms, setActiveProgram, deleteProgram } from '@/db/programService';
import { getUserProfile } from '@/db/userProfileService';
import { saveProgram } from '@/db/programService';
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
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/generate-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userProfile: profile }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await saveProgram(data.program);
      await load();
    } catch {
      setError('Erreur lors de la génération. Vérifie ta clé GEMINI_API_KEY.');
    }
    setGenerating(false);
  }

  async function handleActivate(id: number) {
    await setActiveProgram(id);
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer ce programme ?')) return;
    await deleteProgram(id);
    await load();
  }

  return (
    <div className="px-4 pt-12 pb-4 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Programmes</h1>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          {generating ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Génération…
            </>
          ) : '🤖 Nouveau'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl p-3">{error}</p>}

      {programs.length === 0 && !generating && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-zinc-300">Aucun programme</p>
          <p className="text-zinc-500 text-sm mt-1">Génère ton premier programme avec Gemini</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {programs.map((prog) => (
          <div
            key={prog.id}
            className={`rounded-2xl border overflow-hidden ${
              prog.isActive ? 'border-orange-500/50' : 'border-zinc-800'
            }`}
          >
            <div className="bg-zinc-900 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  {prog.isActive && (
                    <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-semibold uppercase tracking-wide mb-1 block w-fit">
                      Actif
                    </span>
                  )}
                  <h3 className="font-bold">{prog.name}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(prog.generatedAt).toLocaleDateString('fr-FR')} · {prog.weeks?.length ?? 0} semaine(s)
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(expanded === prog.id ? null : prog.id!)}
                  className="text-zinc-500 text-xl"
                >
                  {expanded === prog.id ? '▲' : '▼'}
                </button>
              </div>

              {prog.aiRationale && (
                <p className="text-zinc-400 text-sm leading-relaxed mb-3">{prog.aiRationale}</p>
              )}

              {/* Week overview */}
              {prog.weeks?.[0] && (
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {DAYS.map((day, i) => {
                    const hasDay = prog.weeks[0].days.some((d) => d.dayIndex === i);
                    const dayName = prog.weeks[0].days.find((d) => d.dayIndex === i)?.name ?? '';
                    return (
                      <div
                        key={i}
                        title={dayName}
                        className={`flex flex-col items-center gap-0.5 flex-1`}
                      >
                        <div className={`w-full h-1.5 rounded-full ${hasDay ? 'bg-orange-500' : 'bg-zinc-800'}`} />
                        <span className="text-[10px] text-zinc-600">{day}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                {!prog.isActive && (
                  <button
                    onClick={() => handleActivate(prog.id!)}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-sm transition-colors"
                  >
                    Activer
                  </button>
                )}
                <button
                  onClick={() => handleDelete(prog.id!)}
                  className="px-3 py-2 border border-zinc-700 rounded-xl text-red-400 text-sm"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === prog.id && prog.weeks?.[0] && (
              <div className="bg-zinc-950 border-t border-zinc-800 p-4 flex flex-col gap-3">
                {prog.weeks[0].days.map((day) => (
                  <div key={day.dayIndex} className="border border-zinc-800 rounded-xl p-3">
                    <p className="font-semibold mb-1">{day.name} <span className="text-zinc-500 text-xs">— {DAYS[day.dayIndex]}</span></p>
                    <p className="text-xs text-zinc-500 mb-2">{day.focus} · {day.estimatedDuration}min</p>
                    <div className="flex flex-col gap-1">
                      {day.exercises.map((ex, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-zinc-300">{ex.name}</span>
                          <span className="text-zinc-500">{ex.sets}×{ex.repsMin}-{ex.repsMax}</span>
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
