'use client';

import { useEffect, useRef, useState } from 'react';
import { db } from '@/db/database';
import { getUserProfile } from '@/db/userProfileService';
import { getRecentSessions } from '@/db/workoutService';
import { getActiveProgram } from '@/db/programService';
import { sendAgentMessage, getGeminiKey } from '@/lib/gemini-client';
import { saveProgram } from '@/db/programService';
import { saveSupplementReminders } from '@/db/supplementService';
import { getPendingCheckin, getLastCompletedCheckin, createCheckin, completeCheckin } from '@/db/checkinService';
import { upsertUserProfile } from '@/db/userProfileService';
import { shouldShowCheckin } from '@/lib/notifications';
import type { UserProfile, WorkoutSession, Program, CheckIn } from '@/db/database';

interface Message { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  { text: 'Génère-moi un programme complet', icon: '🏗️' },
  { text: 'Analyse mon historique récent', icon: '📊' },
  { text: 'Quelle nutrition post-séance ?', icon: '🥗' },
  { text: 'Planifie mes suppléments', icon: '⚡' },
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check-in state
  const [checkin, setCheckin] = useState<CheckIn | null>(null);
  const [checkinAnswers, setCheckinAnswers] = useState<Record<string, string | number>>({});
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [generatingCheckin, setGeneratingCheckin] = useState(false);

  useEffect(() => {
    Promise.all([
      getUserProfile(),
      getRecentSessions(10),
      getActiveProgram(),
      db.coachMessages.orderBy('timestamp').toArray(),
      getPendingCheckin(),
      getLastCompletedCheckin(),
    ]).then(([p, s, prog, msgs, pending, lastCompleted]) => {
      setProfile(p ?? null);
      setRecentSessions(s);
      setCurrentProgram(prog ?? null);
      setMessages(msgs.map(m => ({ role: m.role, content: m.content })));

      if (pending) {
        setCheckin(pending);
        setShowCheckin(true);
      } else if (shouldShowCheckin(lastCompleted?.completedAt)) {
        // Auto-generate check-in if due
        handleGenerateCheckin(p ?? null, s);
      }
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleGenerateCheckin(p: UserProfile | null, sessions: WorkoutSession[]) {
    const key = getGeminiKey();
    if (!key || !p) return;
    setGeneratingCheckin(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkin_generate', key, userProfile: p, recentSessions: sessions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const id = await createCheckin(data.questions);
      const newCheckin = await (async () => {
        const { db: d } = await import('@/db/database');
        return d.checkins.get(id);
      })();
      if (newCheckin) { setCheckin(newCheckin); setShowCheckin(true); }
    } catch {
      // Silently fail — check-in is optional
    }
    setGeneratingCheckin(false);
  }

  async function handleCompleteCheckin() {
    if (!checkin?.id) return;
    setCheckinLoading(true);
    const key = getGeminiKey();
    try {
      let profileSuggestions;
      let aiSummary = '';
      if (key && profile) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gemini`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'checkin_analyze',
            key,
            userProfile: profile,
            recentSessions,
            questions: checkin.questions,
            answers: checkinAnswers,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          profileSuggestions = data.profileUpdates;
          aiSummary = data.summary;
          // Apply profile updates automatically if any
          if (profileSuggestions && profile) {
            const updated = { ...profile, ...profileSuggestions };
            await upsertUserProfile(updated as Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>);
            setProfile(updated as UserProfile);
          }
        }
      }
      await completeCheckin(checkin.id, checkinAnswers, profileSuggestions, aiSummary);
      setCheckinDone(true);
      setTimeout(() => { setShowCheckin(false); setCheckinDone(false); }, 3000);
    } catch {
      setShowCheckin(false);
    }
    setCheckinLoading(false);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';

    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    await db.coachMessages.add({ role: 'user', content, timestamp: new Date(), context: 'chat' });

    try {
      const result = await sendAgentMessage(content, profile, recentSessions, currentProgram, messages);
      const reply = result.reply;
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      await db.coachMessages.add({ role: 'assistant', content: reply, timestamp: new Date(), context: 'chat' });

      // Handle agent actions (program generation, supplements, etc.)
      if (result.action?.type === 'program' && result.action.data) {
        await saveProgram({ ...(result.action.data as object), generatedAt: new Date(), weekNumber: 0, isActive: true } as Parameters<typeof saveProgram>[0]);
        const { getActiveProgram } = await import('@/db/programService');
        setCurrentProgram(await getActiveProgram() ?? null);
      }
      if (result.action?.type === 'supplements' && Array.isArray(result.action.data)) {
        await saveSupplementReminders((result.action.data as Omit<import('@/db/database').SupplementReminder, 'id'>[]).map(r => ({ ...r, enabled: true, generatedAt: new Date() })));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur de connexion.';
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
    }
    setLoading(false);
  }

  async function clearHistory() {
    if (!confirm('Effacer la conversation ?')) return;
    await db.coachMessages.clear();
    setMessages([]);
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  // Weekly check-in modal
  if (showCheckin && checkin) {
    const allAnswered = checkin.questions.every(q => checkinAnswers[q.id] !== undefined && checkinAnswers[q.id] !== '');

    return (
      <div className="flex flex-col h-screen bg-[#0a0a0a]">
        <div className="flex items-center gap-3 px-5 pt-14 pb-4 border-b border-white/[0.06]">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/30 to-violet-600/10 border border-violet-500/25 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight">Bilan Hebdo</h1>
            <p className="text-[10px] text-zinc-600 font-medium">Coach Elite · Mise à jour de ton profil</p>
          </div>
          <button onClick={() => setShowCheckin(false)} className="ml-auto w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4 no-scrollbar">
          {checkinDone ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="font-black text-xl">Bilan complété !</p>
              <p className="text-zinc-500 text-sm">Ton profil a été mis à jour par le coach.</p>
            </div>
          ) : (
            <>
              <div className="bg-violet-500/8 border border-violet-500/20 rounded-2xl p-4">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Coach Elite fait le point chaque semaine pour affiner ton programme et tes recommandations.
                </p>
              </div>
              {checkin.questions.map((q, i) => (
                <div key={q.id} className="card p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-zinc-200 leading-relaxed">
                    <span className="text-zinc-600 font-bold mr-2">{i + 1}.</span>{q.question}
                  </p>
                  {q.type === 'scale' ? (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(v => (
                        <button key={v} onClick={() => setCheckinAnswers(prev => ({ ...prev, [q.id]: v }))}
                          className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                            checkinAnswers[q.id] === v
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'border-white/[0.08] text-zinc-400'
                          }`}>{v}</button>
                      ))}
                    </div>
                  ) : q.type === 'number' ? (
                    <input
                      type="number"
                      placeholder="Entrer une valeur…"
                      value={checkinAnswers[q.id] ?? ''}
                      onChange={e => setCheckinAnswers(prev => ({ ...prev, [q.id]: Number(e.target.value) }))}
                      className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-zinc-100 text-sm focus:outline-none focus:border-orange-500/40 transition-colors"
                    />
                  ) : (
                    <textarea
                      rows={2}
                      placeholder="Ta réponse…"
                      value={checkinAnswers[q.id] ?? ''}
                      onChange={e => setCheckinAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-zinc-100 text-sm placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500/40 transition-colors"
                    />
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {!checkinDone && (
          <div className="px-5 py-4 border-t border-white/[0.06]">
            <button
              onClick={handleCompleteCheckin}
              disabled={!allAnswered || checkinLoading}
              className={`w-full py-4 rounded-2xl font-bold text-sm transition-all ${
                allAnswered && !checkinLoading ? 'btn-primary' : 'bg-white/5 text-zinc-500 border border-white/[0.07]'
              }`}>
              {checkinLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  Analyse en cours…
                </span>
              ) : 'Valider le bilan'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/30 to-violet-600/10 border border-violet-500/25 flex items-center justify-center shadow-lg shadow-violet-500/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight">Coach Elite</h1>
            <p className="text-[10px] text-zinc-600 font-medium">Propulsé par Gemini · Niveau olympique</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {generatingCheckin && (
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" title="Bilan en préparation" />
          )}
          {messages.length > 0 && (
            <button onClick={clearHistory} className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-600 hover:text-zinc-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-violet-600/5 border border-violet-500/20 mx-auto flex items-center justify-center mb-4">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
              </div>
              <p className="font-black text-xl">Bonjour{profile ? `, ${profile.name}` : ''} !</p>
              <p className="text-zinc-500 text-sm mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                Ton coach élite est prêt. Pose n'importe quelle question sur l'entraînement, la nutrition ou la récupération.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map(s => (
                <button key={s.text} onClick={() => send(s.text)}
                  className="w-full text-left card px-4 py-3.5 flex items-center gap-3 hover:border-white/[0.1] active:scale-[0.99] transition-all">
                  <span className="text-base">{s.icon}</span>
                  <span className="text-sm text-zinc-300 font-medium">{s.text}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" className="ml-auto"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
              </div>
            )}
            <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
              msg.role === 'user'
                ? 'bg-orange-500 text-white rounded-tr-sm font-medium'
                : 'bg-[#161616] border border-white/[0.07] text-zinc-200 rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 items-start">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
            </div>
            <div className="bg-[#161616] border border-white/[0.07] px-4 py-3.5 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06] bg-[#0a0a0a]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Pose ta question…"
            rows={1}
            className="flex-1 bg-[#161616] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500/40 transition-colors"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${
              input.trim() && !loading ? 'bg-orange-500 shadow-lg shadow-orange-500/25 active:scale-95' : 'bg-white/[0.05] border border-white/[0.07]'
            }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? 'white' : '#52525b'} strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
