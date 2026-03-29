import { db } from './database';
import type { CheckIn, CheckInQuestion } from './database';

export async function getLastCheckin(): Promise<CheckIn | undefined> {
  const all = await db.checkins.orderBy('scheduledFor').reverse().limit(1).toArray();
  return all[0];
}

export async function getLastCompletedCheckin(): Promise<CheckIn | undefined> {
  const all = await db.checkins
    .filter(c => !!c.completedAt)
    .toArray();
  return all.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];
}

export async function createCheckin(questions: CheckInQuestion[]): Promise<number> {
  return db.checkins.add({
    scheduledFor: new Date(),
    questions,
  });
}

export async function completeCheckin(
  id: number,
  answers: Record<string, string | number>,
  profileSuggestions?: Partial<import('./database').UserProfile>,
  aiSummary?: string,
): Promise<void> {
  const checkin = await db.checkins.get(id);
  if (!checkin) return;
  const questions = checkin.questions.map(q => ({
    ...q,
    answer: answers[q.id] ?? q.answer,
  }));
  await db.checkins.update(id, {
    completedAt: new Date(),
    questions,
    profileSuggestions,
    aiSummary,
  });
}

export async function getPendingCheckin(): Promise<CheckIn | undefined> {
  const all = await db.checkins.filter(c => !c.completedAt).toArray();
  return all[0];
}
