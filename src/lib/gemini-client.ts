import type { UserProfile, WorkoutSession, ProgramDay } from '@/db/database';

const KEY_STORAGE = 'apex_gemini_key';
const SUPABASE_FN = 'https://skdhptggvvjetbrrnsue.supabase.co/functions/v1/gemini';

export function getGeminiKey(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem(KEY_STORAGE) ?? '') : '';
}
export function setGeminiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}
export function hasGeminiKey(): boolean {
  return !!getGeminiKey();
}

async function call(action: string, payload: object): Promise<Response> {
  const key = getGeminiKey();
  if (!key) throw new Error('Clé API manquante — va dans Profil pour l\'ajouter.');

  const res = await fetch(SUPABASE_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, key, ...payload }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const msg: string = err.error ?? `HTTP ${res.status}`;
    // Only show "Clé invalide" when the server explicitly says it's a key error (HTTP 401)
    if (res.status === 401) throw new Error('Clé API invalide — vérifie-la dans Profil.');
    if (res.status === 403) throw new Error('Active l\'API Gemini sur aistudio.google.com.');
    if (res.status === 429) throw new Error('Quota Gemini dépassé — réessaie dans 1 minute.');
    throw new Error(msg.slice(0, 300) || `Erreur ${res.status}`);
  }
  return res;
}

export async function testGeminiKey(key: string): Promise<void> {
  const res = await fetch(SUPABASE_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'test', key }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '' }));
    const msg = err.error ?? '';
    if (res.status === 401 || msg.toLowerCase().includes('api_key') || msg.toLowerCase().includes('invalid')) throw new Error('Clé invalide — vérifie sur aistudio.google.com');
    if (res.status === 403) throw new Error('Permission refusée — active l\'API Gemini sur aistudio.google.com');
    if (res.status === 429) throw new Error('Quota Gemini dépassé — réessaie dans 1 minute');
    throw new Error(msg || `Erreur ${res.status}`);
  }
}

export async function sendCoachMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userProfile: UserProfile | null,
  recentSessions?: WorkoutSession[],
  currentProgram?: object | null
): Promise<string> {
  const res = await call('chat', { messages, userProfile, recentSessions: recentSessions ?? [], currentProgram: currentProgram ?? null });
  return (await res.json()).reply;
}

export async function sendAgentMessage(
  message: string,
  userProfile: UserProfile | null,
  recentSessions?: WorkoutSession[],
  currentProgram?: object | null,
  coachHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ reply: string; action?: { type: 'program' | 'supplements'; data: object } | null }> {
  const res = await call('agent', {
    message,
    userProfile,
    recentSessions: recentSessions ?? [],
    currentProgram: currentProgram ?? null,
    coachHistory: (coachHistory ?? []).slice(-20),
  });
  return res.json();
}

export async function generateProgram(
  userProfile: UserProfile,
  recentSessions?: WorkoutSession[]
): Promise<object> {
  const res = await call('generate', { userProfile, recentSessions: recentSessions ?? [] });
  return (await res.json()).program;
}

export async function analyzeWorkout(
  session: WorkoutSession,
  userProfile: UserProfile | null,
  previousSessions?: WorkoutSession[]
): Promise<string> {
  const res = await call('analyze', { session, userProfile, previousSessions: previousSessions ?? [] });
  return (await res.json()).feedback;
}

export async function getPreWorkoutBrief(
  dayPlan: ProgramDay | null,
  userProfile: UserProfile | null,
  recentSessions?: WorkoutSession[]
): Promise<string> {
  const res = await call('brief', { dayPlan, userProfile, recentSessions: recentSessions ?? [] });
  return (await res.json()).brief;
}
