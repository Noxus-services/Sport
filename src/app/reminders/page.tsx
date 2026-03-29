'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserProfile } from '@/db/userProfileService';
import { getActiveProgram } from '@/db/programService';
import { getRecentSessions } from '@/db/workoutService';
import { getSupplementReminders, saveSupplementReminders, toggleReminder, updateReminderTime } from '@/db/supplementService';
import { requestNotificationPermission, getNotificationPermission, scheduleTodayReminders, formatReminderTime, DAY_LABELS } from '@/lib/notifications';
import { getGeminiKey } from '@/lib/gemini-client';
import type { SupplementReminder } from '@/db/database';

export default function RemindersPage() {
  const [reminders, setReminders] = useState<SupplementReminder[]>([]);
  const [notifPerm, setNotifPerm] = useState<string>('default');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [editingTime, setEditingTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setNotifPerm(getNotificationPermission());
    getSupplementReminders().then(r => { setReminders(r); setLoading(false); });
  }, []);

  // Schedule notifications whenever reminders change
  useEffect(() => {
    if (reminders.length > 0 && notifPerm === 'granted') {
      scheduleTodayReminders(reminders);
    }
  }, [reminders, notifPerm]);

  async function handleRequestPermission() {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm === 'granted' && reminders.length > 0) {
      scheduleTodayReminders(reminders);
    }
  }

  async function handleGenerate() {
    const key = getGeminiKey();
    if (!key) { setError('Configure ta clé API Gemini dans le Profil.'); return; }
    setGenerating(true); setError('');
    try {
      const [profile, program, sessions] = await Promise.all([
        getUserProfile(),
        getActiveProgram(),
        getRecentSessions(5),
      ]);
      if (!profile) { setError('Complète ton profil d\'abord.'); setGenerating(false); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'supplement_schedule', key, userProfile: profile, currentProgram: program, recentSessions: sessions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

      const newReminders: Omit<SupplementReminder, 'id'>[] = (data.reminders as Omit<SupplementReminder, 'id' | 'generatedAt'>[]).map(r => ({
        ...r,
        enabled: true,
        generatedAt: new Date(),
      }));
      await saveSupplementReminders(newReminders);
      setReminders(await getSupplementReminders());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération.');
    }
    setGenerating(false);
  }

  async function handleToggle(id: number, enabled: boolean) {
    await toggleReminder(id, enabled);
    setReminders(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
  }

  async function handleTimeChange(id: number, time: string) {
    await updateReminderTime(id, time);
    setReminders(prev => prev.map(r => r.id === id ? { ...r, time } : r));
    setEditingTime(null);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const activeCount = reminders.filter(r => r.enabled).length;

  return (
    <motion.div
      className="flex flex-col gap-5 pt-14 pb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5">
        <div>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">ApexCoach</p>
          <h1 className="text-[28px] font-black tracking-tight">Rappels</h1>
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
            generating ? 'bg-white/5 text-zinc-500 border border-white/[0.07]' : 'btn-primary'
          }`}>
          {generating ? (
            <><span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" /> Analyse…</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg> Générer</>
          )}
        </button>
      </div>

      {error && (
        <div className="mx-5 p-4 bg-red-500/8 border border-red-500/20 rounded-2xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Notification permission banner */}
      {notifPerm !== 'granted' && (
        <div className="mx-5 p-4 bg-orange-500/8 border border-orange-500/20 rounded-2xl flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-orange-300">Active les notifications</p>
            <p className="text-xs text-zinc-500 mt-0.5">Pour recevoir tes rappels compléments même quand l'app est en arrière-plan.</p>
            {notifPerm === 'denied' ? (
              <p className="text-xs text-red-400 mt-2 font-medium">Notifications bloquées — autorise-les dans les paramètres du navigateur.</p>
            ) : (
              <button onClick={handleRequestPermission} className="mt-2 px-4 py-2 bg-orange-500 rounded-xl text-white font-bold text-xs">
                Autoriser les notifications
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status */}
      {notifPerm === 'granted' && reminders.length > 0 && (
        <div className="mx-5 flex items-center gap-3 p-4 card">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-sm font-semibold text-zinc-300">{activeCount} rappel{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''} aujourd'hui</p>
        </div>
      )}

      {generating && (
        <div className="mx-5 card p-6 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="font-bold">Coach analyse ton profil…</p>
            <p className="text-zinc-500 text-sm mt-1">Création d'un planning compléments personnalisé</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {reminders.length === 0 && !generating && (
        <div className="mx-5 card p-10 flex flex-col items-center text-center gap-3">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-violet-600/5 border border-violet-500/20 flex items-center justify-center mb-1">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
          </div>
          <p className="font-black text-lg">Planning intelligent</p>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-[260px]">
            Le coach analyse ton profil, tes objectifs et ton programme pour créer un planning de compléments optimal.
          </p>
          <button onClick={handleGenerate} disabled={generating} className="mt-2 btn-primary px-6 py-3 rounded-2xl font-bold text-sm">
            Générer mon planning
          </button>
        </div>
      )}

      {/* Reminders list */}
      {reminders.length > 0 && (
        <div className="flex flex-col gap-3 px-5">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Planning du jour</p>
          {reminders
            .slice()
            .sort((a, b) => a.time.localeCompare(b.time))
            .map(r => (
              <div key={r.id} className={`card p-4 transition-all ${!r.enabled ? 'opacity-40' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
                    r.enabled ? 'bg-violet-500/15 border border-violet-500/20' : 'bg-white/[0.04] border border-white/[0.07]'
                  }`}>
                    {r.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-black text-base">{r.label}</p>
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(r.id!, !r.enabled)}
                        className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${r.enabled ? 'bg-orange-500' : 'bg-white/[0.1]'}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${r.enabled ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                    {r.dose && <p className="text-xs text-orange-400 font-bold mb-1">{r.dose}</p>}
                    <p className="text-xs text-zinc-500 leading-relaxed">{r.aiReason}</p>

                    <div className="flex items-center gap-3 mt-2.5">
                      {/* Time */}
                      {editingTime === r.id ? (
                        <input
                          type="time"
                          defaultValue={r.time}
                          autoFocus
                          onBlur={e => handleTimeChange(r.id!, e.target.value)}
                          onChange={e => e.target.value && handleTimeChange(r.id!, e.target.value)}
                          className="bg-white/[0.05] border border-orange-500/40 rounded-lg px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingTime(r.id!)}
                          className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:border-orange-500/30 transition-colors">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {formatReminderTime(r.time)}
                        </button>
                      )}

                      {/* Days */}
                      <div className="flex gap-1">
                        {DAY_LABELS.map((d, i) => (
                          <span key={i} className={`w-5 h-5 rounded-md text-[9px] font-bold flex items-center justify-center ${
                            r.days.length === 0 || r.days.includes(i)
                              ? 'bg-violet-500/20 text-violet-400'
                              : 'bg-white/[0.04] text-zinc-700'
                          }`}>{d[0]}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          <p className="text-[10px] text-zinc-700 text-center mt-1">
            Généré le {new Date(reminders[0]?.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · Appuie sur l'heure pour modifier
          </p>
        </div>
      )}
    </motion.div>
  );
}
