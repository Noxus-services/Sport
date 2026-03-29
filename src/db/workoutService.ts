import { db, WorkoutSession, LoggedExercise, LoggedSet, PR } from './database';

export async function startWorkoutSession(
  dayName: string,
  programDayRef?: string
): Promise<number> {
  const now = new Date();
  return db.workoutSessions.add({
    dayName,
    programDayRef,
    date: now,
    startedAt: now,
    exercises: [],
    mood: 3,
    energy: 3,
    totalVolume: 0,
    duration: 0,
    prsAchieved: [],
  });
}

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  return db.workoutSessions
    .filter((s) => !s.completedAt)
    .last();
}

export async function updateSessionExercises(
  sessionId: number,
  exercises: LoggedExercise[]
): Promise<void> {
  const totalVolume = exercises.reduce((total, ex) =>
    total + ex.sets.reduce((s, set) =>
      s + (set.completed ? set.weight * set.reps : 0), 0), 0);
  await db.workoutSessions.update(sessionId, { exercises, totalVolume });
}

export async function finishWorkoutSession(
  sessionId: number,
  data: {
    mood: 1 | 2 | 3 | 4 | 5;
    energy: 1 | 2 | 3 | 4 | 5;
    notes?: string;
    bodyweight?: number;
  }
): Promise<void> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session) return;

  const completedAt = new Date();
  const duration = Math.round(
    (completedAt.getTime() - session.startedAt.getTime()) / 60000
  );

  const totalVolume = session.exercises.reduce((total, ex) =>
    total + ex.sets.reduce((s, set) =>
      s + (set.completed ? set.weight * set.reps : 0), 0), 0);

  const prsAchieved = await detectPRs(session.exercises, sessionId);

  await db.workoutSessions.update(sessionId, {
    completedAt,
    duration,
    totalVolume,
    prsAchieved,
    ...data,
  });
}

async function detectPRs(
  exercises: LoggedExercise[],
  currentSessionId: number
): Promise<PR[]> {
  const prs: PR[] = [];

  for (const ex of exercises) {
    const completedSets = ex.sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
    if (!completedSets.length) continue;

    const maxWeight = Math.max(...completedSets.map((s) => s.weight));
    const estimated1RM = Math.max(...completedSets.map((s) =>
      s.weight * (1 + s.reps / 30)
    ));

    const previousSessions = await db.workoutSessions
      .filter((s) => !!s.completedAt && s.id !== currentSessionId)
      .toArray();

    let prevMax1RM = 0;
    for (const prev of previousSessions) {
      const prevEx = prev.exercises.find((e) => e.exerciseId === ex.exerciseId);
      if (!prevEx) continue;
      const prevEstimated = Math.max(0, ...prevEx.sets
        .filter((s) => s.completed && s.weight > 0 && s.reps > 0)
        .map((s) => s.weight * (1 + s.reps / 30)));
      if (prevEstimated > prevMax1RM) prevMax1RM = prevEstimated;
    }

    if (estimated1RM > prevMax1RM && prevMax1RM > 0) {
      prs.push({
        exerciseId: ex.exerciseId,
        exerciseName: ex.name,
        type: '1rm',
        value: Math.round(estimated1RM * 10) / 10,
        previousValue: Math.round(prevMax1RM * 10) / 10,
        date: new Date(),
      });
    }
  }

  return prs;
}

export async function cancelWorkoutSession(sessionId: number): Promise<void> {
  await db.workoutSessions.delete(sessionId);
}

export async function getRecentSessions(limit = 10): Promise<WorkoutSession[]> {
  return db.workoutSessions
    .orderBy('date')
    .reverse()
    .filter((s) => !!s.completedAt)
    .limit(limit)
    .toArray();
}

export async function getSessionById(id: number): Promise<WorkoutSession | undefined> {
  return db.workoutSessions.get(id);
}

export async function getWeekSessions(weekStart: Date): Promise<WorkoutSession[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return db.workoutSessions
    .where('date')
    .between(weekStart, weekEnd)
    .filter((s) => !!s.completedAt)
    .toArray();
}

export async function saveAiCoachFeedback(
  sessionId: number,
  feedback: string
): Promise<void> {
  await db.workoutSessions.update(sessionId, { aiCoachFeedback: feedback });
}
