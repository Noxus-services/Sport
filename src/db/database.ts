import Dexie, { Table } from 'dexie';

export interface UserProfile {
  id?: number;
  name: string;
  age: number;
  weight: number;          // kg
  height: number;          // cm
  experience: 'debutant' | 'intermediaire' | 'avance';
  goal: 'force' | 'hypertrophie' | 'endurance' | 'perte_poids' | 'athletisme';
  daysPerWeek: number;     // 2-6
  availableEquipment: string[];
  injuries: string;        // texte libre
  createdAt: Date;
  updatedAt: Date;
}

export interface Program {
  id?: number;
  name: string;
  generatedAt: Date;
  weekNumber: number;
  weeks: ProgramWeek[];
  aiRationale: string;     // Explication IA du programme
  isActive: boolean;
}

export interface ProgramWeek {
  weekIndex: number;
  days: ProgramDay[];
}

export interface ProgramDay {
  dayIndex: number;        // 0=lundi
  name: string;            // "Push A", "Legs", etc.
  focus: string;
  exercises: PlannedExercise[];
  estimatedDuration: number; // minutes
}

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  rpe?: number;            // Rate of Perceived Exertion 1-10
  notes?: string;
  technique?: string;      // Conseil technique IA
}

export interface WorkoutSession {
  id?: number;
  programDayRef?: string;
  date: Date;
  startedAt: Date;
  completedAt?: Date;
  dayName: string;
  exercises: LoggedExercise[];
  bodyweight?: number;
  mood: 1 | 2 | 3 | 4 | 5;   // humeur avant séance
  energy: 1 | 2 | 3 | 4 | 5;  // énergie perçue
  notes?: string;
  aiCoachFeedback?: string;    // Analyse IA post-séance
  totalVolume: number;         // kg total soulevé
  duration: number;            // minutes
  prsAchieved: PR[];
}

export interface LoggedExercise {
  exerciseId: string;
  name: string;
  sets: LoggedSet[];
  notes?: string;
}

export interface LoggedSet {
  setNumber: number;
  weight: number;       // kg
  reps: number;
  rpe?: number;
  completed: boolean;
  isDropset?: boolean;
  isWarmup?: boolean;
  timestamp: Date;
}

export interface PR {
  exerciseId: string;
  exerciseName: string;
  type: '1rm' | 'volume' | 'reps';
  value: number;
  previousValue: number;
  date: Date;
}

export interface Exercise {
  id: string;            // slug unique ex: "squat-barre"
  name: string;
  category: 'compound' | 'isolation' | 'cardio' | 'mobility';
  muscleGroups: string[];
  equipment: string[];
  description: string;
  videoUrl?: string;
}

export interface CoachMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: string;      // 'weekly_review' | 'post_workout' | 'chat' | 'program_gen'
}

export interface SupplementReminder {
  id?: number;
  supplement: string;    // 'creatine' | 'whey' | 'preworkout' | 'omega3' | etc.
  label: string;         // Display name
  emoji: string;
  time: string;          // 'HH:MM' format
  days: number[];        // [0-6] (0=lun), empty = every day
  enabled: boolean;
  aiReason: string;      // Why this time/supplement
  dose?: string;         // '5g', '1 scoop', etc.
  generatedAt: Date;
}

export interface CheckIn {
  id?: number;
  scheduledFor: Date;
  completedAt?: Date;
  questions: CheckInQuestion[];
  profileSuggestions?: Partial<UserProfile>;
  aiSummary?: string;
}

export interface CheckInQuestion {
  id: string;
  question: string;
  type: 'text' | 'scale' | 'number';
  answer?: string | number;
}

export interface WeeklyReview {
  id?: number;
  weekStart: Date;
  weekEnd: Date;
  generatedAt: Date;
  sessionsCount: number;
  totalVolume: number;
  analysis: string;      // Analyse complète IA (Markdown)
  nextWeekAdjustments: string;
  progressScore: number; // 0-100
}

export class ApexDatabase extends Dexie {
  userProfile!: Table<UserProfile>;
  programs!: Table<Program>;
  workoutSessions!: Table<WorkoutSession>;
  exercises!: Table<Exercise>;
  coachMessages!: Table<CoachMessage>;
  weeklyReviews!: Table<WeeklyReview>;
  supplementReminders!: Table<SupplementReminder>;
  checkins!: Table<CheckIn>;

  constructor() {
    super('ApexCoach');
    this.version(1).stores({
      userProfile: '++id',
      programs: '++id, isActive, generatedAt',
      workoutSessions: '++id, date, programDayRef',
      exercises: 'id, category, *muscleGroups',
      coachMessages: '++id, timestamp, context',
      weeklyReviews: '++id, weekStart',
    });
    this.version(2).stores({
      userProfile: '++id',
      programs: '++id, isActive, generatedAt',
      workoutSessions: '++id, date, programDayRef',
      exercises: 'id, category, *muscleGroups',
      coachMessages: '++id, timestamp, context',
      weeklyReviews: '++id, weekStart',
      supplementReminders: '++id, enabled, supplement',
      checkins: '++id, scheduledFor, completedAt',
    });
  }
}

export const db = new ApexDatabase();
