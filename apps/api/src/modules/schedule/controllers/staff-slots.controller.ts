import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { CreateSlotDto } from '../dto/create-slot.dto.js';
import { GenerateSlotsDto } from '../dto/generate-slots.dto.js';
import { GenerateSlotsJob } from '../jobs/generate-slots.job.js';
import type { TimeSlotModel } from '../models/time-slot.model.js';
import { ScheduleService } from '../services/schedule.service.js';

// Shape of `StaffTimeSlotDto`; a slot that was just created has no bookings, so every counter is 0, and the calendar
// pull has not seen it yet, so it is not blocked (D94).
function toStaffSlot(slot: TimeSlotModel) {
  return {
    id: slot.id,
    service: slot.service,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    capacity: slot.capacity,
    professional: slot.professional,
    cancelledAt: slot.cancelledAt?.toISOString() ?? null,
    booked: 0,
    present: 0,
    absent: 0,
    noShow: 0,
    cancelled: 0,
    pendingAttendance: 0,
    calendarBlocked: false,
    calendarConflict: false,
  };
}

@Roles('staff')
@Controller('staff')
export class StaffSlotsController {
  constructor(
    private readonly schedule: ScheduleService,
    private readonly generateSlotsJob: GenerateSlotsJob,
  ) {}

  @Post('time-slots')
  async createSlot(@Body() dto: CreateSlotDto): Promise<ReturnType<typeof toStaffSlot>> {
    return toStaffSlot(
      await this.schedule.createSlot({
        service: dto.service,
        date: dto.date,
        startTime: dto.startTime,
        durationMinutes: dto.durationMinutes,
        capacity: dto.capacity,
        professionalId: dto.professionalId,
      }),
    );
  }

  // Responds 0 when another instance holds the job lock.
  @Post('schedule/generate')
  async generate(@Body() dto: GenerateSlotsDto): Promise<{ created: number }> {
    const { result } = await this.generateSlotsJob.executeManually(dto.days);
    return { created: result.created ?? 0 };
  }
}
