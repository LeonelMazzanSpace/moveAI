import { diffDays, toBusinessDate } from '../../../common/time/business-time.js';
import type { PendingCheckinDto } from '../../followup/models/checkin.model.js';
import type { PackDto, SubscriptionDto } from '../../subscriptions/models/subscription.model.js';
import type { NoticeDto } from '../dto/client-responses.js';

const PERFORMANCE_PLANS_URL = '/planes?service=performance';
const RECOVERY_PLANS_URL = '/planes?service=recovery';
const ANSWERED_VISIBLE_DAYS = 30;
const PACK_LOW_SESSIONS = 1;

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export interface NoticesInput {
  today: string;
  subscription: SubscriptionDto | null;
  pendingCheckin: PendingCheckinDto | null;
  lastAnswered: { period: string; respondedAt: Date } | null;
  packs: PackDto[];
}

// `period` is 'YYYY-MM'.
const monthName = (period: string): string => MONTH_NAMES[Number(period.slice(5, 7)) - 1] ?? period;

function subscriptionNotice(subscription: SubscriptionDto | null): NoticeDto | null {
  if (subscription?.status === 'expiring') {
    const days = subscription.daysLeft;
    return {
      id: `plan_expiring:${subscription.id}`,
      kind: 'plan_expiring',
      title: `Tu plan vence en ${days} ${days === 1 ? 'día' : 'días'}`,
      body: 'Renová para no perder tus reservas.',
      actionUrl: PERFORMANCE_PLANS_URL,
    };
  }
  if (subscription?.status === 'expired') {
    return {
      id: `plan_expired:${subscription.id}`,
      kind: 'plan_expired',
      title: 'Tu plan venció',
      body: 'Renová tu plan para volver a reservar turnos.',
      actionUrl: PERFORMANCE_PLANS_URL,
    };
  }
  return null;
}

function pendingCheckinNotice(checkin: PendingCheckinDto | null): NoticeDto | null {
  if (!checkin) return null;
  return {
    id: `checkin_pending:${checkin.id}`,
    kind: 'checkin_pending',
    title: 'Tenés un check-in pendiente',
    body: 'Contanos cómo venís en 1 minuto.',
    actionUrl: '/check-in',
  };
}

function answeredCheckinNotice(answered: NoticesInput['lastAnswered'], today: string): NoticeDto | null {
  if (!answered || diffDays(toBusinessDate(answered.respondedAt), today) > ANSWERED_VISIBLE_DAYS) return null;
  return {
    id: `checkin_answered:${answered.period}`,
    kind: 'checkin_answered',
    title: `Check-in de ${monthName(answered.period)} respondido`,
    body: 'Gracias por contarnos cómo venís.',
    actionUrl: null,
  };
}

function packNotice(pack: PackDto): NoticeDto {
  return {
    id: `pack_low:${pack.id}`,
    kind: 'pack_low',
    title: `Te queda ${pack.sessionsLeft} sesión de Recovery`,
    body: 'Renová tu paquete para seguir reservando.',
    actionUrl: RECOVERY_PLANS_URL,
  };
}

// Order of the HTTP contract: plan, pending check-in, answered check-in, low packs.
export function buildNotices(input: NoticesInput): NoticeDto[] {
  const notices = [
    subscriptionNotice(input.subscription),
    pendingCheckinNotice(input.pendingCheckin),
    answeredCheckinNotice(input.lastAnswered, input.today),
  ];
  const lowPacks = input.packs.filter((pack) => pack.sessionsLeft <= PACK_LOW_SESSIONS).map(packNotice);
  return [...notices.filter((notice): notice is NoticeDto => notice !== null), ...lowPacks];
}
