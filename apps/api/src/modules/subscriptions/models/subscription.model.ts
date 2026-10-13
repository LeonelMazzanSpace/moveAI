import type { PlanKind, Service } from '../../catalog/entities/plan.entity.js';

export type SubscriptionServiceKind = 'performance' | 'recovery';

export interface SubscriptionModel {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  service: SubscriptionServiceKind;
  startsOn: string;
  endsOn: string;
  sessionsTotal: number | null;
  sessionsUsed: number;
  purchaseId: string | null;
  createdAt: Date;
}

// Plan fields needed to activate a purchase; callers build it from the catalog.
export interface PlanSnapshot {
  id: string;
  name: string;
  service: Service;
  kind: PlanKind;
  periodMonths: number | null;
  periodDays: number | null;
  sessionsIncluded: number | null;
}

export type SubscriptionStatus = 'active' | 'expiring' | 'expired' | 'scheduled';

export interface SubscriptionDto {
  id: string;
  planId: string;
  planName: string;
  service: 'performance';
  startsOn: string;
  endsOn: string;
  status: SubscriptionStatus;
  daysLeft: number;
  progressPct: number;
}

export interface PackDto {
  id: string;
  planId: string;
  planName: string;
  startsOn: string;
  endsOn: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsLeft: number;
}

export interface MySubscriptionsDto {
  performance: SubscriptionDto | null;
  upcomingPerformance: SubscriptionDto | null;
  recoveryPacks: PackDto[];
}
