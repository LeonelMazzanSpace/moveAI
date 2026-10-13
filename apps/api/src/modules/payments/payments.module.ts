import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AgendaModule } from '../schedule/agenda.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { UsersModule } from '../users/users.module.js';
import { CheckoutController } from './controllers/checkout.controller.js';
import { StaffPaymentsController } from './controllers/staff-payments.controller.js';
import { WebhookController } from './controllers/webhook.controller.js';
import { ReconcilePaymentsJob } from './jobs/reconcile-payments.job.js';
import { CheckoutService } from './services/checkout.service.js';
import { MercadoPagoService } from './services/mercado-pago.service.js';
import { PaymentsService } from './services/payments.service.js';

@Module({
  imports: [
    SettingsModule, NotificationsModule, UsersModule, AuthModule, CatalogModule, AgendaModule, SubscriptionsModule, BookingsModule,
  ],
  controllers: [CheckoutController, WebhookController, StaffPaymentsController],
  providers: [PaymentsService, CheckoutService, MercadoPagoService, ReconcilePaymentsJob],
  exports: [PaymentsService, ReconcilePaymentsJob],
})
export class PaymentsModule {}
