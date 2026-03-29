import type { SupplementReminder } from '@/db/database';

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return await Notification.requestPermission();
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Schedule today's supplement reminders via setTimeout + SW showNotification
const scheduledTimers: ReturnType<typeof setTimeout>[] = [];

export function clearScheduledNotifications() {
  scheduledTimers.forEach(clearTimeout);
  scheduledTimers.length = 0;
}

export async function scheduleTodayReminders(reminders: SupplementReminder[]) {
  clearScheduledNotifications();
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  const todayDay = (now.getDay() + 6) % 7; // Convert Sun=0 to Mon=0

  for (const r of reminders) {
    if (!r.enabled) continue;
    if (r.days.length > 0 && !r.days.includes(todayDay)) continue;

    const [h, m] = r.time.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);

    const delay = target.getTime() - now.getTime();
    if (delay <= 0) continue; // Already passed today

    const timer = setTimeout(async () => {
      const sw = await navigator.serviceWorker.ready;
      sw.showNotification(`${r.emoji} ${r.label}`, {
        body: r.dose ? `${r.dose} — ${r.aiReason}` : r.aiReason,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `supplement-${r.supplement}`,
        data: { url: '/reminders' },
      } as NotificationOptions);
    }, delay);

    scheduledTimers.push(timer);
  }
}

export function formatReminderTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
}

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function shouldShowCheckin(lastCheckinDate?: Date): boolean {
  if (!lastCheckinDate) return true;
  const daysSince = (Date.now() - new Date(lastCheckinDate).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= 7;
}
