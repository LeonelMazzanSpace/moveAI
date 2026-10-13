import { IsIn, ValidateBy, ValidateIf } from 'class-validator';
import {
  FEELINGS, GOALS_CHANGES, PAIN_LEVELS, type Feeling, type GoalsChange, type PainLevel,
} from '../models/checkin.model.js';
import { CHECKIN_DETAIL_MAX, FreeText, OptionalField } from './followup-fields.js';

// R13: the pain detail is required, and not blank, when the client reports pain.
const RequiredWithPain = () =>
  ValidateBy({
    name: 'requiredWithPain',
    validator: {
      validate: (value: unknown, args) => (args?.object as AnswerCheckinDto | undefined)?.pain !== 'mild' || value !== '',
      defaultMessage: () => 'painDetail is required when pain is mild',
    },
  });

export class AnswerCheckinDto {
  @IsIn(FEELINGS)
  feeling: Feeling;

  @IsIn(PAIN_LEVELS)
  pain: PainLevel;

  @ValidateIf((dto: AnswerCheckinDto, value) => dto.pain === 'mild' || value !== undefined)
  @FreeText(CHECKIN_DETAIL_MAX)
  @RequiredWithPain()
  painDetail?: string;

  @IsIn(GOALS_CHANGES)
  goals: GoalsChange;

  @OptionalField()
  @FreeText(CHECKIN_DETAIL_MAX)
  goalsDetail?: string;
}
