const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_FAST = 'gemini-2.0-flash';
const MODEL_PRO  = 'gemini-2.0-flash';

async function generate(key, model, contents, systemInstruction) {
  const body = { contents };
  if (systemInstruction) body.system_instruction = { parts: [{ text: systemInstruction }] };

  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message ?? `HTTP ${res.status}`;
    const status = res.status;
    throw Object.assign(new Error(msg), { status });
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors() });
  }

  try {
    const { action, key, ...payload } = await req.json();
    if (!key) return json({ error: 'NO_API_KEY' }, 400);

    // ── Test ─────────────────────────────────────────────────────────────────
    if (action === 'test') {
      await generate(key, MODEL_FAST, [{ role: 'user', parts: [{ text: 'ok' }] }]);
      return json({ ok: true });
    }

    // ── Chat ─────────────────────────────────────────────────────────────────
    if (action === 'chat') {
      const { messages, userProfile: p } = payload;
      const system = `Tu es ApexCoach, coach sportif IA expert musculation.
Tu parles en français, direct et motivant.
Profil: ${p?.name ?? 'Athlète'}, ${p?.age ?? '?'}ans, ${p?.weight ?? '?'}kg, ${p?.experience ?? '?'}, objectif: ${p?.goal ?? '?'}.
Blessures: ${p?.injuries || 'aucune'}.`;

      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const reply = await generate(key, MODEL_FAST, contents, system);
      return json({ reply });
    }

    // ── Generate program ──────────────────────────────────────────────────────
    if (action === 'generate') {
      const { userProfile: p } = payload;
      const prompt = `Génère un programme musculation en JSON strict (rien d'autre, pas de markdown) :
Profil: ${p.name}, ${p.age}ans, ${p.weight}kg, ${p.height}cm, ${p.experience}, objectif: ${p.goal}, ${p.daysPerWeek}j/sem, équipement: ${p.availableEquipment.join(', ') || 'poids du corps'}, blessures: ${p.injuries || 'aucune'}.

Format JSON exact :
{"name":"...","aiRationale":"...","weeks":[{"weekIndex":0,"days":[{"dayIndex":0,"name":"Push A","focus":"Poitrine, Épaules, Triceps","estimatedDuration":60,"exercises":[{"exerciseId":"slug","name":"Nom","sets":4,"repsMin":6,"repsMax":10,"restSeconds":120,"rpe":8,"technique":"...","notes":"..."}]}]}]}

Règles: ${p.daysPerWeek} jours (dayIndex 0=lundi), 4-6 exercices/séance, 2-4 semaines, adapte à l'équipement.`;

      const text = await generate(key, MODEL_PRO, [{ role: 'user', parts: [{ text: prompt }] }]);
      const clean = text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      return json({ program: JSON.parse(clean) });
    }

    // ── Analyze workout ───────────────────────────────────────────────────────
    if (action === 'analyze') {
      const { session, userProfile: p } = payload;
      const exerciseSummary = session.exercises
        .map((ex) => `${ex.name}: ${ex.sets.filter((s) => s.completed).map((s) => `${s.weight}kg×${s.reps}`).join(', ')}`)
        .join('\n');

      const prompt = `Analyse cette séance de ${p?.name ?? 'l\'athlète'}:
${session.dayName} — ${session.duration}min — ${session.totalVolume}kg — humeur ${session.mood}/5 énergie ${session.energy}/5
${exerciseSummary}
Feedback 3-5 phrases en français: ce qui était bien, un point d'amélioration, conseil pour la prochaine séance.`;

      const feedback = await generate(key, MODEL_FAST, [{ role: 'user', parts: [{ text: prompt }] }]);
      return json({ feedback });
    }

    return json({ error: 'Unknown action' }, 400);

  } catch (e) {
    const msg   = e instanceof Error ? e.message : String(e);
    const status = e?.status === 400 ? 401
      : e?.status === 403 ? 403
      : e?.status === 429 ? 429
      : 500;
    return json({ error: msg }, status);
  }
};

const cors = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
