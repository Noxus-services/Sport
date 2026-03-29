import { NextRequest, NextResponse } from 'next/server';
import { getModel } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { session, userProfile } = await req.json();

    const model = getModel();

    const exerciseSummary = session.exercises.map((ex: { name: string; sets: Array<{ completed: boolean; weight: number; reps: number; rpe?: number }> }) => {
      const completedSets = ex.sets.filter((s) => s.completed);
      return `${ex.name}: ${completedSets.map((s) => `${s.weight}kg×${s.reps}${s.rpe ? ` @RPE${s.rpe}` : ''}`).join(', ')}`;
    }).join('\n');

    const prompt = `Tu es ApexCoach. Analyse cette séance d'entraînement de ${userProfile?.name ?? 'l\'athlète'} :

Séance : ${session.dayName}
Durée : ${session.duration} minutes
Volume total : ${session.totalVolume}kg
Humeur : ${session.mood}/5 | Énergie : ${session.energy}/5
${session.prsAchieved?.length ? `PRs battus : ${session.prsAchieved.map((p: { exerciseName: string; value: number }) => `${p.exerciseName} ${p.value.toFixed(1)}kg`).join(', ')}` : ''}
${session.notes ? `Notes : ${session.notes}` : ''}

Exercices :
${exerciseSummary}

Donne un feedback court (3-5 phrases) en français :
1. Ce qui était bien dans cette séance
2. Un point d'amélioration concret
3. Un conseil pour la prochaine séance
Sois direct, motivant et précis.`;

    const result = await model.generateContent(prompt);
    return NextResponse.json({ feedback: result.response.text() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 });
  }
}
