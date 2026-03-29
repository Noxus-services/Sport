import { db, Program, ProgramDay } from './database';

export async function getActiveProgram(): Promise<Program | undefined> {
  return db.programs.filter((p) => p.isActive).first();
}

export async function saveProgram(program: Omit<Program, 'id'>): Promise<number> {
  // Deactivate all existing programs
  await db.programs.toCollection().modify({ isActive: false });
  return db.programs.add(program);
}

export async function getAllPrograms(): Promise<Program[]> {
  return db.programs.orderBy('generatedAt').reverse().toArray();
}

export async function setActiveProgram(id: number): Promise<void> {
  await db.programs.toCollection().modify({ isActive: false });
  await db.programs.update(id, { isActive: true });
}

export async function getTodayProgramDay(): Promise<ProgramDay | null> {
  const program = await getActiveProgram();
  if (!program || !program.weeks?.length) return null;

  const today = new Date().getDay(); // 0=Sunday
  // Convert: Monday=0 in our schema, Sunday=6
  const dayIndex = today === 0 ? 6 : today - 1;

  const currentWeek = program.weeks[program.weekNumber % program.weeks.length];
  if (!currentWeek) return null;

  return currentWeek.days.find((d) => d.dayIndex === dayIndex) ?? null;
}

export async function deleteProgram(id: number): Promise<void> {
  await db.programs.delete(id);
}
