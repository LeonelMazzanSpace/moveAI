import type { AlertStatus } from './alert.model.js';
import type { CheckinFeeling, CheckinFlag, CheckinGoals, CheckinPain } from '../entities/checkin.entity.js';

export type Feeling = CheckinFeeling;
export type PainLevel = CheckinPain;
export type GoalsChange = CheckinGoals;
export type { CheckinFlag };

export const FEELINGS: Feeling[] = ['struggling', 'good', 'very_good'];
export const PAIN_LEVELS: PainLevel[] = ['none', 'mild'];
export const GOALS_CHANGES: GoalsChange[] = ['same', 'adjust'];
export const CHECKIN_FLAGS: CheckinFlag[] = ['ok', 'pain', 'goals'];

// Fields `AlertsService.createCheckinAlerts` needs from an answered check-in.
export interface AnsweredCheckin {
  id: string;
  userId: string;
  pain: PainLevel;
  goals: GoalsChange;
}

export interface CheckinStatsDto { period: string; sent: number; answered: number; needsIntervention: number }

export interface CheckinResponseDto {
  id: string;
  client: { id: string; name: string };
  period: string;
  feeling: Feeling;
  pain: PainLevel;
  painDetail: string | null;
  goals: GoalsChange;
  goalsDetail: string | null;
  flag: CheckinFlag;
  respondedAt: string;
  frequencyPerWeek: number;
  planName: string | null;
  alertId: string | null;
  alertStatus: AlertStatus | null;
}

export interface PendingCheckinDto { id: string; period: string; firstName: string }
