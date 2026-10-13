// Entry point for the TypeORM CLI (migrations). Runs outside Nest, so it reads env directly.
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../config/database.config.js';
import { buildDataSourceOptions } from './typeorm.options.js';

if (existsSync('.env')) process.loadEnvFile('.env');

export default new DataSource(buildDataSourceOptions(databaseConfig()));
