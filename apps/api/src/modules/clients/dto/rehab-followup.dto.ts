import { IsBoolean } from 'class-validator';

export class RehabFollowupDto {
  @IsBoolean()
  enabled: boolean;
}
