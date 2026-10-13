import { IsIn } from 'class-validator';
import { CONTACT_CHANNELS, CONTACT_OUTCOMES, type ContactChannel, type ContactOutcome } from '../models/contact.model.js';
import { FreeText, NOTE_MAX, OptionalField } from './followup-fields.js';

export class CreateContactDto {
  @IsIn(CONTACT_CHANNELS)
  channel: ContactChannel;

  @IsIn(CONTACT_OUTCOMES)
  outcome: ContactOutcome;

  @OptionalField()
  @FreeText(NOTE_MAX)
  note?: string;
}
