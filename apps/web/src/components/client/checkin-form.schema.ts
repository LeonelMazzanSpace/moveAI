import { z } from 'zod';
import type { GoalsChange, PainLevel, Feeling } from '@/lib/api/types';

const DETAIL_MAX_LENGTH = 500;
const detailTooLong = `Usá hasta ${DETAIL_MAX_LENGTH} caracteres.`;

const FEELINGS = ['struggling', 'good', 'very_good'] as const satisfies readonly Feeling[];
const PAIN_LEVELS = ['none', 'mild'] as const satisfies readonly PainLevel[];
const GOALS_CHANGES = ['same', 'adjust'] as const satisfies readonly GoalsChange[];

export const checkinSchema = z
  .object({
    feeling: z.enum(FEELINGS, { error: 'Elegí cómo te sentís.' }),
    pain: z.enum(PAIN_LEVELS, { error: 'Contanos si sentiste alguna molestia.' }),
    painDetail: z.string().trim().max(DETAIL_MAX_LENGTH, detailTooLong),
    goals: z.enum(GOALS_CHANGES, { error: 'Contanos si cambiaron tus objetivos.' }),
    goalsDetail: z.string().trim().max(DETAIL_MAX_LENGTH, detailTooLong),
  })
  .refine((values) => values.pain !== 'mild' || values.painDetail.length > 0, {
    path: ['painDetail'],
    error: 'Contanos dónde sentís la molestia.',
  });

export type CheckinFormValues = z.infer<typeof checkinSchema>;

export interface CheckinAnswers {
  feeling: Feeling;
  pain: PainLevel;
  painDetail?: string;
  goals: GoalsChange;
  goalsDetail?: string;
}

/** Cuerpo de `POST /me/checkins/:id`: los detalles solo viajan si corresponden a la respuesta elegida. */
export function toCheckinAnswers(values: CheckinFormValues): CheckinAnswers {
  const answers: CheckinAnswers = { feeling: values.feeling, pain: values.pain, goals: values.goals };
  if (values.pain === 'mild') answers.painDetail = values.painDetail;
  if (values.goals === 'adjust' && values.goalsDetail) answers.goalsDetail = values.goalsDetail;
  return answers;
}
