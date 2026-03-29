import { NextRequest, NextResponse } from 'next/server';
import { getModel } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { messages, userProfile } = await req.json();

    const model = getModel();

    const systemPrompt = `Tu es ApexCoach, un coach sportif IA expert en musculation et fitness.
Tu parles en français, de façon directe, motivante et bienveillante.
Tu adaptes tes conseils au profil de l'utilisateur :
- Nom: ${userProfile?.name ?? 'Athlète'}
- Âge: ${userProfile?.age ?? '?'} ans
- Poids: ${userProfile?.weight ?? '?'} kg
- Expérience: ${userProfile?.experience ?? '?'}
- Objectif: ${userProfile?.goal ?? '?'}
- Jours/semaine: ${userProfile?.daysPerWeek ?? '?'}
- Blessures/notes: ${userProfile?.injuries || 'Aucune'}

Réponds de façon concise et pratique. Tu peux utiliser des emojis avec modération.`;

    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: "Compris ! Je suis ApexCoach, ton coach IA. Comment puis-je t'aider aujourd'hui ?" }] },
        ...history,
      ],
    });

    const result = await chat.sendMessage(lastMessage);
    return NextResponse.json({ reply: result.response.text() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur Gemini' }, { status: 500 });
  }
}
