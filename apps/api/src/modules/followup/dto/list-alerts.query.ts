import { IsIn, IsOptional } from 'class-validator';
import { ALERT_STATUSES, ALERT_TYPES, type AlertStatus, type AlertType } from '../models/alert.model.js';

export class ListAlertsQuery {
  @IsOptional()
  @IsIn(ALERT_TYPES)
  type?: AlertType;

  @IsOptional()
  @IsIn(ALERT_STATUSES)
  status: AlertStatus = 'open';
}
