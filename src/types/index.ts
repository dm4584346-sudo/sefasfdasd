export type Role = 'Carry' | 'Mid' | 'Offlane' | 'Soft Support' | 'Hard Support';

export interface UserProfile {
  id: number;
  nickname: string;
  currentMmr: number;
  targetMmr: number;
  primaryRole: Role;
  secondaryRole: Role;
  extraRole: Role;
  dailyTrainingMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Hero {
  id: number;
  name: string;
  position: Role;
  matches: number | null;
  winrate: number | null;
  mastery: number | null;
  strengths: string;
  weaknesses: string;
}

export interface ScheduleBlock {
  id: number;
  title: string;
  category: string;
  durationMinutes: number;
  scheduledAt: string;
  completed: boolean;
  notes: string;
}

export interface TrainingSession {
  id: number;
  title: string;
  category: string;
  durationMinutes: number;
  completedAt: string;
  notes: string;
}

export const ROLES: Role[] = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
