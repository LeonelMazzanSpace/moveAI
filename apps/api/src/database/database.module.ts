import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig, type DatabaseConfig } from '../config/database.config.js';
import { buildDataSourceOptions } from './typeorm.options.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: DatabaseConfig) => ({ ...buildDataSourceOptions(config), autoLoadEntities: true }),
    }),
  ],
})
export class DatabaseModule {}
