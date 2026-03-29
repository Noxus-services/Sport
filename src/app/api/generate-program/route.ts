import { NextRequest, NextResponse } from 'next/server';
import { getModel } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { userProfile } = await req.json();

    const model = getModel('gemini-1.5-pro');

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
  "aiRationale": "Explication détaillée du programme en 3-4 phrases",
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
- ${userProfile.daysPerWeek} jours d'entraînement par semaine (dayIndex 0=lundi à 6=dimanche)
- Adapte les exercices à l'équipement disponible
- 4-6 exercices par séance
- 2-4 semaines de progression
- Choix intelligents selon l'objectif ${userProfile.goal}
- Évite les exercices contre-indiqués avec les blessures mentionnées`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code blocks if present
    const jsonText = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const programData = JSON.parse(jsonText);

    return NextResponse.json({
      program: {
        ...programData,
        generatedAt: new Date().toISOString(),
        weekNumber: 0,
        isActive: true,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur génération programme' }, { status: 500 });
  }
}
