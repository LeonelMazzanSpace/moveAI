import { IsIn } from 'class-validator';
import type { AttendanceStatus } from '../entities/attendance.entity.js';

export class MarkAttendanceDto {
  @IsIn(['present', 'absent', 'no_show'])
  status: AttendanceStatus;
}
