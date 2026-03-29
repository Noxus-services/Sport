'use client';

import { useEffect, useRef, useState } from 'react';
import { db } from '@/db/database';
import { getUserProfile } from '@/db/userProfileService';
import { getRecentSessions } from '@/db/workoutService';
import { getActiveProgram } from '@/db/programService';
import { sendCoachMessage } from '@/lib/gemini-client';
import type { UserProfile, WorkoutSession, Program } from '@/db/database';

interface Message { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  { text: 'Analyse mon historique récent', icon: '📊' },
  { text: 'Comment progresser en force ?', icon: '💪' },
  { text: 'Quelle nutrition post-séance ?', icon: '🥗' },
  { text: 'Comment éviter le surentraînement ?', icon: '😴' },
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

  useEffect(() => {
    getUserProfile().then(p => setProfile(p ?? null));
    getRecentSessions(10).then(s => setRecentSessions(s));
    getActiveProgram().then(p => setCurrentProgram(p ?? null));
    db.coachMessages.orderBy('timestamp').toArray().then(msgs => {
      setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
      const reply = await sendCoachMessage(newMessages, profile, recentSessions, currentProgram);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      await db.coachMessages.add({ role: 'assistant', content: reply, timestamp: new Date(), context: 'chat' });
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

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/30 to-violet-600/10 border border-violet-500/25 flex items-center justify-center shadow-lg shadow-violet-500/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight">ApexCoach IA</h1>
            <p className="text-[10px] text-zinc-600 font-medium">Propulsé par Gemini · Coach élite</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearHistory} className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-600 hover:text-zinc-400 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        )}
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
