export const JOB_NAMES = [
  'followup-detect', 'checkins-monthly', 'expiry-reminders', 'generate-slots', 'expire-holds', 'reconcile-payments',
  'booking-reminders',
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export interface JobRunResultDto { job: JobName; ran: boolean; result: Record<string, number> }

export const isJobName = (value: string): value is JobName => (JOB_NAMES as readonly string[]).includes(value);
