import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { businessToday } from '../../../common/time/business-time.js';
import { appConfig } from '../../../config/app.config.js';
import { InactivityService } from '../../followup/services/inactivity.service.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { performanceSummary } from '../../subscriptions/domain/vigencia.js';
import type { SubscriptionModel } from '../../subscriptions/models/subscription.model.js';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { formatEmailDate, selectExpiryReminders, type ExpiryReminderClient } from '../domain/expiry-reminders.js';

const groupByUser = (subs: SubscriptionModel[]): Map<string, SubscriptionModel[]> => {
  const byUser = new Map<string, SubscriptionModel[]>();
  for (const sub of subs) byUser.set(sub.userId, [...(byUser.get(sub.userId) ?? []), sub]);
  return byUser;
};

// R14: emails clients whose Performance plan is about to expire or just expired. Idempotent per subscription:
// `NotificationsService` skips an idempotency key it already logged.
@Injectable()
export class ExpiryRemindersService {
  constructor(
    private readonly users: UsersService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly inactivity: InactivityService,
    private readonly notifications: NotificationsService,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async run(today: string = businessToday()): Promise<{ expiring: number; expired: number }> {
    const clients = await this.users.listClients();
    const ids = clients.map((client) => client.id);
    const [{ expiringSoonDays }, pauses, subs] = await Promise.all([
      this.settings.getAll(),
      this.inactivity.getActivePauses(ids),
      this.subscriptions.listPerformanceByUsers(ids),
    ]);
    const subsByUser = groupByUser(subs);

    const reminderClients = ids.map((userId): ExpiryReminderClient => {
      const userSubs = subsByUser.get(userId) ?? [];
      const { current, latest } = performanceSummary(userSubs, today);
      const covered = current ?? latest;
      const renewed = covered !== null && userSubs.some((sub) => sub.startsOn > covered.endsOn);
      return { userId, paused: pauses.has(userId), current, latest, renewed };
    });
    const reminders = selectExpiryReminders({ today, expiringSoonDays, clients: reminderClients });

    const byId = new Map(clients.map((client) => [client.id, client]));
    const renewUrl = `${this.app.webUrl}/planes?service=performance`;
    const sent = { expiring: 0, expired: 0 };
    for (const { userId, template, subscription } of reminders) {
      const user = byId.get(userId);
      if (!user) continue;
      const to = { email: user.email, name: user.name };
      const idempotencyKey = `${template}:${subscription.id}`;
      const result =
        template === 'plan-expiring'
          ? await this.notifications.send({
              template, to, userId, idempotencyKey,
              params: { name: user.name, planName: subscription.planName, endsOn: formatEmailDate(subscription.endsOn), renewUrl },
            })
          : await this.notifications.send({
              template, to, userId, idempotencyKey,
              params: { name: user.name, planName: subscription.planName, renewUrl },
            });
      if (result === 'duplicate' || result === 'failed') continue;
      sent[template === 'plan-expiring' ? 'expiring' : 'expired'] += 1;
    }
    return sent;
  }
}
