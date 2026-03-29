import { db } from './database';
import type { SupplementReminder } from './database';

export async function getSupplementReminders(): Promise<SupplementReminder[]> {
  return db.supplementReminders.orderBy('time').toArray();
}

export async function saveSupplementReminders(reminders: Omit<SupplementReminder, 'id'>[]): Promise<void> {
  await db.supplementReminders.clear();
  await db.supplementReminders.bulkAdd(reminders as SupplementReminder[]);
}

export async function toggleReminder(id: number, enabled: boolean): Promise<void> {
  await db.supplementReminders.update(id, { enabled });
}

export async function updateReminderTime(id: number, time: string): Promise<void> {
  await db.supplementReminders.update(id, { time });
}

export async function clearSupplementReminders(): Promise<void> {
  await db.supplementReminders.clear();
}
