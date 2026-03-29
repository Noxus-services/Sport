import { GoogleGenerativeAI } from '@google/generative-ai';
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

function model(name = 'gemini-1.5-flash') {
  const key = getGeminiKey();
  if (!key) throw new Error('NO_API_KEY');
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: name });
}

// ─── Coach chat ────────────────────────────────────────────────────────────────
export async function sendCoachMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userProfile: UserProfile | null
): Promise<string> {
  const m = model();
  const systemPrompt = `Tu es ApexCoach, un coach sportif IA expert en musculation et fitness.
Tu parles en français, de façon directe, motivante et bienveillante.
Profil : ${userProfile?.name ?? 'Athlète'}, ${userProfile?.age ?? '?'} ans, ${userProfile?.weight ?? '?'}kg.
Niveau : ${userProfile?.experience ?? '?'}. Objectif : ${userProfile?.goal ?? '?'}.
Blessures : ${userProfile?.injuries || 'aucune'}.
Réponds de façon concise et pratique.`;

  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : ('user' as const),
    parts: [{ text: msg.content }],
  }));

  const chat = m.startChat({
    history: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: "Compris ! Je suis ApexCoach, comment puis-je t'aider ?" }] },
      ...history,
    ],
  });

  const result = await chat.sendMessage(messages[messages.length - 1].content);
  return result.response.text();
}

// ─── Generate program ──────────────────────────────────────────────────────────
export async function generateProgram(userProfile: UserProfile): Promise<object> {
  const m = model('gemini-1.5-pro');
  const prompt = `Tu es un coach expert en programmation musculation/fitness.
Génère un programme d'entraînement COMPLET en JSON strict pour cet athlète :

Profil :
- Nom: ${userProfile.name}
- Âge: ${userProfile.age} ans, Poids: ${userProfile.weight}kg, Taille: ${userProfile.height}cm
- Niveau: ${userProfile.experience}
- Objectif: ${userProfile.goal}
- Jours/semaine: ${userProfile.daysPerWeek}
- Équipement: ${userProfile.availableEquipment.join(', ') || 'poids du corps'}
- Blessures/restrictions: ${userProfile.injuries || 'aucune'}

Génère exactement ce format JSON (rien d'autre, pas de markdown) :
{
  "name": "Nom du programme",
  "aiRationale": "Explication détaillée en 3-4 phrases",
  "weeks": [
    {
      "weekIndex": 0,
      "days": [
        {
          "dayIndex": 0,
          "name": "Push A",
          "focus": "Poitrine, Épaules, Triceps",
          "estimatedDuration": 60,
          "exercises": [
            {
              "exerciseId": "developpe-couche-barre",
              "name": "Développé couché barre",
              "sets": 4,
              "repsMin": 6,
              "repsMax": 10,
              "restSeconds": 120,
              "rpe": 8,
              "technique": "Descend lentement en 3s, explose à la montée",
              "notes": "Exercice principal"
            }
          ]
        }
      ]
    }
  ]
}

Règles :
- ${userProfile.daysPerWeek} jours d'entraînement (dayIndex 0=lundi à 6=dimanche)
- Adapte les exercices à l'équipement disponible
- 4-6 exercices par séance, 2-4 semaines de progression
- Évite les exercices contre-indiqués avec les blessures`;

  const result = await m.generateContent(prompt);
  const text = result.response.text().trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(text);
}

// ─── Analyze workout ───────────────────────────────────────────────────────────
export async function analyzeWorkout(
  session: WorkoutSession,
  userProfile: UserProfile | null
): Promise<string> {
  const m = model();
  const exerciseSummary = session.exercises.map((ex) => {
    const done = ex.sets.filter((s) => s.completed);
    return `${ex.name}: ${done.map((s) => `${s.weight}kg×${s.reps}${s.rpe ? ` @RPE${s.rpe}` : ''}`).join(', ')}`;
  }).join('\n');

  const prompt = `Tu es ApexCoach. Analyse cette séance de ${userProfile?.name ?? 'l\'athlète'} :

Séance : ${session.dayName} — ${session.duration}min — ${session.totalVolume}kg volume
Humeur : ${session.mood}/5 | Énergie : ${session.energy}/5
${session.prsAchieved?.length ? `PRs : ${session.prsAchieved.map((p) => `${p.exerciseName} ${p.value.toFixed(1)}kg`).join(', ')}` : ''}
${session.notes ? `Notes : ${session.notes}` : ''}

Exercices :
${exerciseSummary}

Donne un feedback court (3-5 phrases) : ce qui était bien, un point d'amélioration, un conseil pour la prochaine séance.`;

  const result = await m.generateContent(prompt);
  return result.response.text();
}
