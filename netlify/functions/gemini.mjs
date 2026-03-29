import { GoogleGenerativeAI } from '@google/generative-ai';

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const body = await req.json();
    const { action, key, ...payload } = body;

    if (!key) return json({ error: 'NO_API_KEY' }, 400);

    const ai = new GoogleGenerativeAI(key);

    if (action === 'test') {
      const m = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
      await m.generateContent('ok');
      return json({ ok: true });
    }

    if (action === 'chat') {
      const { messages, userProfile } = payload;
      const m = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const systemPrompt = `Tu es ApexCoach, un coach sportif IA expert en musculation et fitness.
Tu parles en français, de façon directe, motivante et bienveillante.
Profil : ${userProfile?.name ?? 'Athlète'}, ${userProfile?.age ?? '?'} ans, ${userProfile?.weight ?? '?'}kg.
Niveau : ${userProfile?.experience ?? '?'}. Objectif : ${userProfile?.goal ?? '?'}.
Blessures : ${userProfile?.injuries || 'aucune'}.
Réponds de façon concise et pratique.`;

      const history = messages.slice(0, -1).map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
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
      return json({ reply: result.response.text() });
    }

    if (action === 'generate') {
      const { userProfile } = payload;
      const m = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
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
      return json({ program: JSON.parse(text) });
    }

    if (action === 'analyze') {
      const { session, userProfile } = payload;
      const m = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const exerciseSummary = session.exercises.map((ex) => {
        const done = ex.sets.filter((s) => s.completed);
        return `${ex.name}: ${done.map((s) => `${s.weight}kg×${s.reps}`).join(', ')}`;
      }).join('\n');

      const prompt = `Tu es ApexCoach. Analyse cette séance de ${userProfile?.name ?? 'l\'athlète'} :
Séance : ${session.dayName} — ${session.duration}min — ${session.totalVolume}kg volume
Humeur : ${session.mood}/5 | Énergie : ${session.energy}/5
Exercices :\n${exerciseSummary}
Donne un feedback court (3-5 phrases) : ce qui était bien, un point d'amélioration, un conseil pour la prochaine séance.`;

      const result = await m.generateContent(prompt);
      return json({ feedback: result.response.text() });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('API_KEY_INVALID') ? 401
      : msg.includes('PERMISSION_DENIED') ? 403
      : msg.includes('RESOURCE_EXHAUSTED') ? 429
      : 500;
    return json({ error: msg }, status);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export const config = { path: '/api/gemini' };
