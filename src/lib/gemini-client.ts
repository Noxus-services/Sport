import type { UserProfile, WorkoutSession } from '@/db/database';

const KEY_STORAGE = 'apex_gemini_key';

export function getGeminiKey(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem(KEY_STORAGE) ?? '') : '';
}

export function setGeminiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function hasGeminiKey(): boolean {
  return !!getGeminiKey();
}

async function callProxy(action: string, payload: object): Promise<Response> {
  const key = getGeminiKey();
  if (!key) throw new Error('Clé API manquante — va dans Profil pour l\'ajouter.');
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, key, ...payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const msg = err.error ?? `HTTP ${res.status}`;
    if (res.status === 401 || msg.includes('API_KEY_INVALID')) throw new Error('Clé API invalide — vérifie-la dans Profil.');
    if (res.status === 403) throw new Error('Permission refusée — active l\'API Gemini sur aistudio.google.com.');
    if (res.status === 429) throw new Error('Quota Gemini dépassé — réessaie dans 1 minute.');
    throw new Error(`Erreur Gemini : ${msg.slice(0, 120)}`);
  }
  return res;
}

// ─── Test key ──────────────────────────────────────────────────────────────────
export async function testGeminiKey(key: string): Promise<void> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'test', key }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const msg = err.error ?? '';
    if (res.status === 401 || msg.includes('API_KEY_INVALID')) throw new Error('Clé invalide');
    if (res.status === 403) throw new Error('Permission refusée');
    if (res.status === 429) throw new Error('Quota dépassé');
    throw new Error('Erreur serveur');
  }
}

// ─── Coach chat ────────────────────────────────────────────────────────────────
export async function sendCoachMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userProfile: UserProfile | null
): Promise<string> {
  const res = await callProxy('chat', { messages, userProfile });
  const data = await res.json();
  return data.reply;
}

// ─── Generate program ──────────────────────────────────────────────────────────
export async function generateProgram(userProfile: UserProfile): Promise<object> {
  const res = await callProxy('generate', { userProfile });
  const data = await res.json();
  return data.program;
}

// ─── Analyze workout ───────────────────────────────────────────────────────────
export async function analyzeWorkout(
  session: WorkoutSession,
  userProfile: UserProfile | null
): Promise<string> {
  const res = await callProxy('analyze', { session, userProfile });
  const data = await res.json();
  return data.feedback;
}
