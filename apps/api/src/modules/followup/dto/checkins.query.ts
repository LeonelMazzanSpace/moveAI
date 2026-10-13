import { IsIn, IsOptional, Matches } from 'class-validator';
import { CHECKIN_FLAGS, type CheckinFlag } from '../models/checkin.model.js';
import { PERIOD_PATTERN } from './followup-fields.js';

// `period` defaults to the current business month (resolved by the controller).
export class CheckinStatsQuery {
  @IsOptional()
  @Matches(PERIOD_PATTERN)
  period?: string;
}

export class CheckinResponsesQuery extends CheckinStatsQuery {
  @IsOptional()
  @IsIn(CHECKIN_FLAGS)
  flag?: CheckinFlag;
}
