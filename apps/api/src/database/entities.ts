import { AuthAccount } from '../modules/auth/entities/auth-account.entity.js';
import { AuthSession } from '../modules/auth/entities/auth-session.entity.js';
import { AuthVerification } from '../modules/auth/entities/auth-verification.entity.js';
import { Attendance } from '../modules/bookings/entities/attendance.entity.js';
import { Booking } from '../modules/bookings/entities/booking.entity.js';
import { Plan } from '../modules/catalog/entities/plan.entity.js';
import { Checkin } from '../modules/followup/entities/checkin.entity.js';
import { FollowupAlert } from '../modules/followup/entities/followup-alert.entity.js';
import { FollowupContact } from '../modules/followup/entities/followup-contact.entity.js';
import { InactivityReason } from '../modules/followup/entities/inactivity-reason.entity.js';
import { AutoDebit } from '../modules/payments/entities/auto-debit.entity.js';
import { Payment } from '../modules/payments/entities/payment.entity.js';
import { Purchase } from '../modules/payments/entities/purchase.entity.js';
import { Professional } from '../modules/schedule/entities/professional.entity.js';
import { ScheduleTemplate } from '../modules/schedule/entities/schedule-template.entity.js';
import { TimeSlot } from '../modules/schedule/entities/time-slot.entity.js';
import { Setting } from '../modules/settings/entities/setting.entity.js';
import { Subscription } from '../modules/subscriptions/entities/subscription.entity.js';
import { User } from '../modules/users/entities/user.entity.js';

// Every entity of the MVP schema except `EmailLog`, which its module registers with `forFeature`.
export const ALL_ENTITIES = [
  User,
  AuthSession,
  AuthAccount,
  AuthVerification,
  Plan,
  Setting,
  Professional,
  ScheduleTemplate,
  TimeSlot,
  Subscription,
  Booking,
  Attendance,
  Purchase,
  Payment,
  InactivityReason,
  FollowupAlert,
  FollowupContact,
  Checkin,
  AutoDebit,
];
