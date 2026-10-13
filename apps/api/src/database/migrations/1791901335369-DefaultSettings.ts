import { MigrationInterface, QueryRunner } from "typeorm";

export class DefaultSettings1791901335369 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO settings (key, value) VALUES
            ('cancel_limit_hours', '2'::jsonb),
            ('booking_window_days', '14'::jsonb),
            ('pending_payment_minutes', '15'::jsonb),
            ('reconcile_after_minutes', '10'::jsonb),
            ('expiring_soon_days', '7'::jsonb),
            ('no_attendance_days', '7'::jsonb),
            ('prolonged_inactivity_days', '21'::jsonb),
            ('frequency_drop_ratio', '0.5'::jsonb),
            ('frequency_recent_weeks', '2'::jsonb),
            ('frequency_baseline_weeks', '8'::jsonb),
            ('checkin_monthly_enabled', 'true'::jsonb),
            ('values_provisional', 'true'::jsonb)
            ON CONFLICT (key) DO NOTHING`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM settings WHERE key IN (
            'cancel_limit_hours', 'booking_window_days', 'pending_payment_minutes', 'reconcile_after_minutes',
            'expiring_soon_days', 'no_attendance_days', 'prolonged_inactivity_days', 'frequency_drop_ratio',
            'frequency_recent_weeks', 'frequency_baseline_weeks', 'checkin_monthly_enabled', 'values_provisional')`);
    }

}
