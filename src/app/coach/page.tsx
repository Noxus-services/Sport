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
  'Comment progresser en force ?',
  'Quelle nutrition post-séance ?',
  'Comment éviter le surentraînement ?',
  'Exercices pour les épaules ?',
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUserProfile().then((p) => setProfile(p ?? null));
    getRecentSessions(10).then((s) => setRecentSessions(s));
    getActiveProgram().then((p) => setCurrentProgram(p ?? null));
    // Load saved messages from DB
    db.coachMessages.orderBy('timestamp').toArray().then((msgs) => {
      setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    await db.coachMessages.add({
      role: 'user', content, timestamp: new Date(), context: 'chat',
    });

    try {
      const reply = await sendCoachMessage(newMessages, profile, recentSessions, currentProgram);

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      await db.coachMessages.add({
        role: 'assistant', content: reply, timestamp: new Date(), context: 'chat',
      });
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erreur de connexion. Réessaie.' }]);
    }
    setLoading(false);
  }

  async function clearHistory() {
    if (!confirm('Effacer la conversation ?')) return;
    await db.coachMessages.clear();
    setMessages([]);
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-4 pt-12 pb-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-lg">
            🤖
          </div>
          <div>
            <h1 className="font-bold">ApexCoach</h1>
            <p className="text-xs text-zinc-500">Propulsé par Gemini</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearHistory} className="text-xs text-zinc-600 hover:text-zinc-400">
            Effacer
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="text-center">
              <p className="text-4xl mb-2">🤖</p>
              <p className="font-semibold text-zinc-300">Bonjour{profile ? `, ${profile.name}` : ''} !</p>
              <p className="text-zinc-500 text-sm mt-1">Comment puis-je t'aider aujourd'hui ?</p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 hover:border-zinc-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-0.5">
                🤖
              </div>
            )}
            <div
              className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                msg.role === 'user'
                  ? 'bg-orange-500 text-white rounded-br-sm'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-sm flex-shrink-0">
              🤖
            </div>
            <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Pose ta question…"
            rows={1}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500 max-h-32 transition-colors"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
