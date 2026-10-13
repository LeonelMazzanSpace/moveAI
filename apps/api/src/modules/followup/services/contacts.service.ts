import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import type { CreateContactDto } from '../dto/create-contact.dto.js';
import { textOrNull } from '../dto/followup-fields.js';
import type { ContactDto } from '../models/contact.model.js';

type ContactRow = Omit<ContactDto, 'createdAt'> & { createdAt: Date };

const CONTACT_SELECT = `
  SELECT c.id, c.channel, c.outcome, c.note, s.name AS "staffName", a.type AS "alertType", c.created_at AS "createdAt"
  FROM followup_contacts c
  JOIN users s ON s.id = c.staff_id
  LEFT JOIN followup_alerts a ON a.id = c.alert_id`;

const toDto = (row: ContactRow): ContactDto => ({ ...row, createdAt: row.createdAt.toISOString() });

@Injectable()
export class ContactsService {
  constructor(private readonly dataSource: DataSource) {}

  // The contact belongs to the alert's client.
  async create(alertId: string, staffId: string, dto: CreateContactDto): Promise<ContactDto> {
    const [created]: { id: string }[] = await this.dataSource.query(
      `INSERT INTO followup_contacts (user_id, alert_id, staff_id, channel, outcome, note)
       SELECT a.user_id, a.id, $2, $3, $4, $5 FROM followup_alerts a WHERE a.id = $1
       RETURNING id`,
      [alertId, staffId, dto.channel, dto.outcome, textOrNull(dto.note)],
    );
    if (!created) throw new AppError('ALERT_NOT_FOUND');
    const [row]: ContactRow[] = await this.dataSource.query(`${CONTACT_SELECT} WHERE c.id = $1`, [created.id]);
    return toDto(row);
  }

  async listForUser(userId: string): Promise<ContactDto[]> {
    const rows: ContactRow[] = await this.dataSource.query(
      `${CONTACT_SELECT} WHERE c.user_id = $1 ORDER BY c.created_at DESC, c.id`,
      [userId],
    );
    return rows.map(toDto);
  }
}
