export interface ClientMetricsDto {
  lastAttendanceOn: string | null;
  frequencyPerWeek: number;
  attendancesThisMonth: number;
  cancellations: number;
  noShows: number;
  rehabCount: number;
  recoveryCount: number;
}

// R10: `usualFrequencyPerWeek` = `baselineFrequency`.
export type UserMetrics = ClientMetricsDto & {
  recentFrequency: number;
  baselineFrequency: number;
  usualFrequencyPerWeek: number;
};

export interface MyStatsDto { month: string; attendances: number; avgPerWeek: number }
