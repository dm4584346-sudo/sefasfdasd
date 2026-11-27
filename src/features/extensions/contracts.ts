/**
 * Stable integration contracts for later phases.
 * Phase 1 deliberately ships no network, AI, replay or recommendation adapter.
 */

import type { Role } from '@/types';

export interface PlayerMatch {
  matchId: string;
  playedAt: string;
  heroName: string;
  role: Role;
  result: 'win' | 'loss';
  durationSeconds?: number;
  mmrChange?: number;
}

export interface MatchDataProvider {
  getRecentMatches(accountId: string, limit?: number): Promise<PlayerMatch[]>;
  getPlayerMmr?(accountId: string): Promise<number | null>;
}

export interface CoachContext {
  currentMmr: number;
  targetMmr: number;
  primaryRole: Role;
  secondaryRole: Role;
  recentMatches: PlayerMatch[];
  trainingNotes: string[];
}

export interface CoachRecommendation {
  id: string;
  title: string;
  explanation: string;
  priority: 'low' | 'medium' | 'high';
  suggestedMinutes?: number;
}

export interface CoachEngine {
  createRecommendations(context: CoachContext): Promise<CoachRecommendation[]>;
}

export interface DraftEvaluationInput {
  alliedHeroes: string[];
  enemyHeroes: string[];
  playerRole: Role;
}

export interface DraftEvaluation {
  summary: string;
  laneNotes: string[];
  teamfightNotes: string[];
  confidence: number | null;
}

export interface DraftTrainer {
  evaluateDraft(input: DraftEvaluationInput): Promise<DraftEvaluation>;
}

export interface ItemBuildContext {
  heroName: string;
  role: Role;
  alliedHeroes: string[];
  enemyHeroes: string[];
  gamePhase: 'early' | 'mid' | 'late';
  matchNotes?: string;
}

export interface ItemBuildSuggestion {
  itemName: string;
  reason: string;
  priority: number;
}

export interface ItemBuildEngine {
  suggestItems(context: ItemBuildContext): Promise<ItemBuildSuggestion[]>;
}

export interface SituationScenario {
  id: string;
  title: string;
  role: Role;
  prompt: string;
  options: { id: string; label: string }[];
  correctOptionId?: string;
  explanation?: string;
}

export interface SituationTrainer {
  getNextScenario(role: Role): Promise<SituationScenario | null>;
}

export interface ReplayAnalysisResult {
  matchId: string;
  observations: { timestampSeconds: number; category: string; note: string }[];
  summary: string;
}

export interface ReplayAnalyzer {
  analyzeReplay(replayReference: string): Promise<ReplayAnalysisResult>;
}
