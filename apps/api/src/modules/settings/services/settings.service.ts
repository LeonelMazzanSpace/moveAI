import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Setting, type SettingValue } from '../entities/setting.entity.js';
import type { SettingsValues } from '../models/settings.model.js';
import { SETTING_DB_KEYS, SETTINGS_DEFAULTS } from '../settings.defaults.js';

// Thrown when the combined settings break a cross-field rule; callers map it to `SETTINGS_INVALID`.
export class InvalidSettingsError extends Error {
  constructor() {
    super('prolongedInactivityDays must be greater than noAttendanceDays');
    this.name = 'InvalidSettingsError';
  }
}

type SettingsField = keyof SettingsValues;

const FIELD_BY_DB_KEY = new Map(
  (Object.keys(SETTING_DB_KEYS) as SettingsField[]).map((field) => [SETTING_DB_KEYS[field], field]),
);

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private readonly settings: Repository<Setting>) {}

  async getAll(): Promise<SettingsValues> {
    const rows = await this.settings.find({ select: { key: true, value: true } });
    const values: Record<SettingsField, SettingValue> = { ...SETTINGS_DEFAULTS };
    for (const row of rows) {
      const field = FIELD_BY_DB_KEY.get(row.key);
      if (field) values[field] = row.value;
    }
    return values as SettingsValues;
  }

  async get<K extends SettingsField>(key: K): Promise<SettingsValues[K]> {
    const row = await this.settings.findOne({ select: { value: true }, where: { key: SETTING_DB_KEYS[key] } });
    if (!row) return SETTINGS_DEFAULTS[key];
    return row.value as SettingsValues[K];
  }

  async update(patch: Partial<SettingsValues>, updatedBy: string): Promise<SettingsValues> {
    const next = { ...(await this.getAll()), ...patch };
    if (next.prolongedInactivityDays <= next.noAttendanceDays) throw new InvalidSettingsError();

    const rows = (Object.keys(patch) as SettingsField[])
      .filter((field) => patch[field] !== undefined)
      .map((field) => ({ key: SETTING_DB_KEYS[field], value: next[field], updatedBy }));
    if (rows.length > 0) await this.settings.upsert(rows, ['key']);
    return next;
  }
}
