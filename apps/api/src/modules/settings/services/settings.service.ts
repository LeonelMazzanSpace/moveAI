import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type Repository } from 'typeorm';
import { Setting, type SettingValue } from '../entities/setting.entity.js';
import type { StaffContactInfo } from '../models/contact-info.model.js';
import type { SettingsValues } from '../models/settings.model.js';
import { CONTACT_DB_KEYS, CONTACT_DEFAULTS, SETTING_DB_KEYS, SETTINGS_DEFAULTS } from '../settings.defaults.js';

// Thrown when the combined settings break a cross-field rule; callers map it to `SETTINGS_INVALID`.
export class InvalidSettingsError extends Error {
  constructor() {
    super('prolongedInactivityDays must be greater than noAttendanceDays');
    this.name = 'InvalidSettingsError';
  }
}

type SettingsField = keyof SettingsValues;
type ContactField = keyof StaffContactInfo;

const CONTACT_FIELDS = Object.keys(CONTACT_DB_KEYS) as ContactField[];
const CONTACT_KEYS = CONTACT_FIELDS.map((field) => CONTACT_DB_KEYS[field]);

const FIELD_BY_DB_KEY = new Map(
  (Object.keys(SETTING_DB_KEYS) as SettingsField[]).map((field) => [SETTING_DB_KEYS[field], field]),
);

function toValues(rows: Pick<Setting, 'key' | 'value'>[]): SettingsValues {
  const values: Record<SettingsField, SettingValue> = { ...SETTINGS_DEFAULTS };
  for (const row of rows) {
    const field = FIELD_BY_DB_KEY.get(row.key);
    if (field) values[field] = row.value;
  }
  return values as SettingsValues;
}

function toContact(rows: Pick<Setting, 'key' | 'value'>[]): StaffContactInfo {
  const contact: StaffContactInfo = { ...CONTACT_DEFAULTS };
  for (const field of CONTACT_FIELDS) {
    const row = rows.find(({ key }) => key === CONTACT_DB_KEYS[field]);
    if (typeof row?.value === 'string') contact[field] = row.value;
  }
  return contact;
}

// A key present with `undefined` (e.g. an optional DTO field) means "not patched", never "clear it".
function definedEntries<T extends object>(patch: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting) private readonly settings: Repository<Setting>,
    private readonly dataSource: DataSource,
  ) {}

  async getAll(): Promise<SettingsValues> {
    return toValues(await this.settings.find({ select: { key: true, value: true } }));
  }

  async get<K extends SettingsField>(key: K): Promise<SettingsValues[K]> {
    const row = await this.settings.findOne({ select: { value: true }, where: { key: SETTING_DB_KEYS[key] } });
    if (!row) return SETTINGS_DEFAULTS[key];
    return row.value as SettingsValues[K];
  }

  async update(patch: Partial<SettingsValues>, updatedBy: string): Promise<SettingsValues> {
    const changes = definedEntries<SettingsValues>(patch);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Setting);
      // Locks every settings row so concurrent updates run the cross-field check one after another.
      const rows = await repository.find({ select: { key: true, value: true }, lock: { mode: 'pessimistic_write' } });
      const next = { ...toValues(rows), ...changes };
      if (next.prolongedInactivityDays <= next.noAttendanceDays) throw new InvalidSettingsError();

      const upserts = (Object.keys(changes) as SettingsField[]).map((field) => ({
        key: SETTING_DB_KEYS[field],
        value: next[field],
        updatedBy,
      }));
      if (upserts.length > 0) await repository.upsert(upserts, ['key']);
      return next;
    });
  }

  async getContact(): Promise<StaffContactInfo> {
    return toContact(await this.settings.find({ select: { key: true, value: true }, where: { key: In(CONTACT_KEYS) } }));
  }

  async updateContact(patch: Partial<StaffContactInfo>, updatedBy: string): Promise<StaffContactInfo> {
    const changes = definedEntries<StaffContactInfo>(patch);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Setting);
      // No row lock: contact fields have no cross-field rule and each patch upserts only the keys it changes.
      const rows = await repository.find({ select: { key: true, value: true }, where: { key: In(CONTACT_KEYS) } });
      const next = { ...toContact(rows), ...changes };

      const upserts = (Object.keys(changes) as ContactField[]).map((field) => ({
        key: CONTACT_DB_KEYS[field],
        value: next[field],
        updatedBy,
      }));
      if (upserts.length > 0) await repository.upsert(upserts, ['key']);
      return next;
    });
  }
}
