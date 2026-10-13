import { registerAs } from '@nestjs/config';

export const schedulerConfig = registerAs('scheduler', () => ({
  enabled: process.env.SCHEDULER_ENABLED !== 'false',
}));
