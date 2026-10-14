import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { paginateInMemory, type Paginated, type PaginationQueryDto } from '../../../common/http/pagination.js';
import { businessMonth, businessToday } from '../../../common/time/business-time.js';
import { AuthService } from '../../auth/services/auth.service.js';
import { AttendanceService } from '../../bookings/services/attendance.service.js';
import { BookingsService } from '../../bookings/services/bookings.service.js';
import { SlotStatsService } from '../../bookings/services/slot-stats.service.js';
import { ActivityMetricsService } from '../../bookings/services/activity-metrics.service.js';
import type { ClientMetricsDto, UserMetrics } from '../../bookings/models/user-metrics.model.js';
import { toPerformanceInput, type ClientAlertsInput } from '../../followup/domain/alert-rules.js';
import { AlertsService } from '../../followup/services/alerts.service.js';
import { ContactsService } from '../../followup/services/contacts.service.js';
import { InactivityService } from '../../followup/services/inactivity.service.js';
import type { InactivityReasonDto } from '../../followup/models/inactivity.model.js';
import { AutoDebitsService } from '../../payments/services/auto-debits.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import type { SubscriptionModel } from '../../subscriptions/models/subscription.model.js';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service.js';
import type { UserModel } from '../../users/models/user.model.js';
import { UsersService } from '../../users/services/users.service.js';
import { deriveClientStatus } from '../domain/client-status.js';
import { matchesClientSearch } from '../domain/search.js';
import type {
  ClientDetailDto, ClientKpisDto, ClientRowDto, ClientStatus, ClientSummaryDto, DashboardDto, PaymentStatusSummary,
} from '../dto/client-responses.js';
import type { CreateClientDto } from '../dto/create-client.dto.js';
import type { ClientStatusFilter } from '../dto/list-clients.query.js';
import { OverviewService } from './overview.service.js';

const HISTORY_LIMIT = 50;

// Everything R11 needs about one client, loaded in batch.
interface ClientContext {
  user: UserModel;
  performance: ClientAlertsInput['performance'];
  firstStartsOn: string | null;
  pause: InactivityReasonDto | null;
  metrics: UserMetrics;
  status: ClientStatus;
  paymentStatus: PaymentStatusSummary;
}

const groupByUser = (subs: SubscriptionModel[]): Map<string, SubscriptionModel[]> => {
  const byUser = new Map<string, SubscriptionModel[]>();
  for (const sub of subs) byUser.set(sub.userId, [...(byUser.get(sub.userId) ?? []), sub]);
  return byUser;
};

const earliestStart = (subs: SubscriptionModel[]): string | null =>
  subs.reduce<string | null>((first, sub) => (first === null || sub.startsOn < first ? sub.startsOn : first), null);

const toRow = ({ user, performance, pause, metrics, status, paymentStatus }: ClientContext): ClientRowDto => {
  const shown = performance.current ?? performance.latest;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status,
    pauseReason: pause?.reason ?? null,
    planName: shown?.planName ?? null,
    endsOn: shown?.endsOn ?? null,
    paymentStatus,
    lastAttendanceOn: metrics.lastAttendanceOn,
    frequencyPerWeek: metrics.frequencyPerWeek,
    rehabCount: metrics.rehabCount,
    recoveryCount: metrics.recoveryCount,
  };
};

const toSummary = (context: ClientContext): ClientSummaryDto => ({
  ...toRow(context),
  phone: context.user.phone,
  rehabFollowupEnabled: context.user.rehabFollowupEnabled,
  createdAt: context.user.createdAt.toISOString(),
});

const toMetricsDto = (metrics: UserMetrics): ClientMetricsDto => ({
  lastAttendanceOn: metrics.lastAttendanceOn,
  frequencyPerWeek: metrics.frequencyPerWeek,
  attendancesThisMonth: metrics.attendancesThisMonth,
  cancellations: metrics.cancellations,
  noShows: metrics.noShows,
  rehabCount: metrics.rehabCount,
  recoveryCount: metrics.recoveryCount,
});

@Injectable()
export class ClientsService {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly metrics: ActivityMetricsService,
    private readonly inactivity: InactivityService,
    private readonly contacts: ContactsService,
    private readonly bookings: BookingsService,
    private readonly attendance: AttendanceService,
    private readonly slotStats: SlotStatsService,
    private readonly alerts: AlertsService,
    private readonly overview: OverviewService,
    private readonly autoDebits: AutoDebitsService,
  ) {}

  // D26: every client is loaded and filtered in memory.
  async list(q: string | undefined, status: ClientStatusFilter, page: PaginationQueryDto): Promise<Paginated<ClientRowDto>> {
    const contexts = await this.loadContexts(await this.users.listClients(), businessToday());
    const rows = contexts
      .filter((context) => status === 'all' || context.status === status)
      .map(toRow)
      .filter((row) => matchesClientSearch(row, q ?? ''));
    return paginateInMemory(rows, page);
  }

  async kpis(today: string): Promise<ClientKpisDto> {
    const [contexts, attendancesToday, slotsToday] = await Promise.all([
      this.users.listClients().then((clients) => this.loadContexts(clients, today)),
      this.attendance.countPresentOn(today),
      this.slotStats.countSlotsOn(today),
    ]);
    const month = businessMonth(today);
    return {
      active: contexts.filter(({ performance }) => performance.current !== null).length,
      activeDeltaMonth: contexts.filter(({ firstStartsOn }) => firstStartsOn !== null && businessMonth(firstStartsOn) === month).length,
      expiringSoon: contexts.filter(({ status }) => status === 'expiring').length,
      inactive: contexts.filter(({ status }) => status === 'inactive').length,
      attendancesToday,
      slotsToday,
    };
  }

  async detail(id: string): Promise<ClientDetailDto> {
    const user = await this.requireClient(id);
    const today = businessToday();
    const [context, mine, contacts, reasons, history, upcomingBookings, autoDebits] = await Promise.all([
      this.loadContext(user, today),
      this.subscriptions.getMySubscriptions(id, today),
      this.contacts.listForUser(id),
      this.inactivity.listForUser(id),
      this.overview.listActivity(id, 'all'),
      this.bookings.listForUser(id, 'upcoming'),
      this.autoDebits.listForUser(id),
    ]);
    return {
      client: toSummary(context),
      subscription: mine.performance,
      upcomingSubscription: mine.upcomingPerformance,
      recoveryPacks: mine.recoveryPacks,
      metrics: toMetricsDto(context.metrics),
      activePause: context.pause,
      contacts,
      reasons,
      history: history.slice(0, HISTORY_LIMIT),
      upcomingBookings,
      autoDebits,
    };
  }

  // The invitation email goes out inside `AuthService.createInvitedUser`, after the account exists.
  async create(dto: CreateClientDto): Promise<ClientRowDto> {
    const { userId } = await this.auth.createInvitedUser(dto);
    const user = await this.requireClient(userId);
    return toRow(await this.loadContext(user, businessToday()));
  }

  async setRehabFollowup(id: string, enabled: boolean): Promise<ClientSummaryDto> {
    await this.requireClient(id);
    const user = await this.users.setRehabFollowupEnabled(id, enabled);
    return toSummary(await this.loadContext(user, businessToday()));
  }

  async dashboard(today: string): Promise<DashboardDto> {
    const [kpis, alertCounts, todaySlots, pendingSlots] = await Promise.all([
      this.kpis(today),
      this.alerts.counts(),
      this.slotStats.listStaffSlots(today),
      this.slotStats.pendingAttendanceSlots(today),
    ]);
    return { kpis, alertCounts, todaySlots, pendingAttendanceSlots: pendingSlots.length };
  }

  // Staff and soft-deleted users are not clients (D25).
  private async requireClient(id: string): Promise<UserModel> {
    const user = await this.users.findById(id);
    if (!user || user.role !== 'client') throw new AppError('CLIENT_NOT_FOUND');
    return user;
  }

  private async loadContext(user: UserModel, today: string): Promise<ClientContext> {
    const [context] = await this.loadContexts([user], today);
    return context;
  }

  // Subscriptions, pauses and metrics come in three batch queries, whatever the number of clients.
  private async loadContexts(clients: UserModel[], today: string): Promise<ClientContext[]> {
    const ids = clients.map((client) => client.id);
    const [settings, subs, pauses, metrics] = await Promise.all([
      this.settings.getAll(),
      this.subscriptions.listPerformanceByUsers(ids),
      this.inactivity.getActivePauses(ids),
      this.metrics.getMetrics(ids, today),
    ]);
    const subsByUser = groupByUser(subs);
    return clients.map((user) => {
      const userSubs = subsByUser.get(user.id) ?? [];
      const performance = toPerformanceInput(userSubs, today);
      const userMetrics = metrics.get(user.id);
      if (!userMetrics) throw new AppError('INTERNAL_ERROR');
      const pause = pauses.get(user.id) ?? null;
      const derived = deriveClientStatus({
        today, settings, paused: pause !== null, performance, lastAttendanceOn: userMetrics.lastAttendanceOn,
      });
      return { user, performance, firstStartsOn: earliestStart(userSubs), pause, metrics: userMetrics, ...derived };
    });
  }
}
