import type { AlertType } from '../models/alert.model.js';
import type { CheckinFlag, GoalsChange, PainLevel } from '../models/checkin.model.js';

export type CheckinAlertType = Extract<AlertType, 'checkin_pain' | 'checkin_goals'>;

// R13: pain outranks a goals change.
export function computeCheckinFlag(input: { pain: PainLevel; goals: GoalsChange }): CheckinFlag {
  if (input.pain === 'mild') return 'pain';
  if (input.goals === 'adjust') return 'goals';
  return 'ok';
}

// R12: alerts raised by an answered check-in, the main one (pain) first.
export function checkinAlertTypes(input: { pain: PainLevel; goals: GoalsChange }): CheckinAlertType[] {
  const types: CheckinAlertType[] = [];
  if (input.pain === 'mild') types.push('checkin_pain');
  if (input.goals === 'adjust') types.push('checkin_goals');
  return types;
}

// The alert that follows a check-in's flag (`ok` raises none).
export function alertTypeForFlag(flag: CheckinFlag): CheckinAlertType | null {
  if (flag === 'pain') return 'checkin_pain';
  if (flag === 'goals') return 'checkin_goals';
  return null;
}

export const checkinPeriodKey = (checkinId: string): string => `checkin:${checkinId}`;
