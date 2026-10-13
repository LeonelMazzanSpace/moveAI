import { Module } from '@nestjs/common';
import { DevSimulatorController } from './controllers/dev-simulator.controller.js';
import { PaymentsModule } from './payments.module.js';

// D4/D59: registered from AppModule with ConditionalModule, so the route does not exist in production.
@Module({
  imports: [PaymentsModule],
  controllers: [DevSimulatorController],
})
export class DevSimulatorModule {}
