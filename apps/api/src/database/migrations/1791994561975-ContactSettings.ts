import { MigrationInterface, QueryRunner } from "typeorm";

export class ContactSettings1791994561975 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `INSERT INTO settings (key, value) VALUES
                ('contact_address', to_jsonb($1::text)),
                ('contact_hours', to_jsonb($2::text)),
                ('contact_whatsapp', to_jsonb($3::text)),
                ('contact_instagram', to_jsonb($4::text)),
                ('contact_email', to_jsonb(''::text)),
                ('contact_maps_url', to_jsonb($5::text)),
                ('staff_notifications_email', to_jsonb(''::text))
            ON CONFLICT (key) DO NOTHING`,
            [
                'Máximo Tajes 6397 esquina Beranger',
                'Lunes a viernes · 7:00 – 11:00 · 15:00 – 20:00',
                '+598 99 140 299',
                '@move_strengthconditioning',
                'https://www.google.com/maps/place/MOVE+Strength%26Conditioning/@-34.8773036,-56.0787995,17z/data=!4m6!3m5!1s0x959f8730c171b183:0x6e7a19d4869b4b26!8m2!3d-34.8773036!4d-56.0787995!16s%2Fg%2F11g22zyvcy',
            ],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM settings WHERE key IN (
            'contact_address', 'contact_hours', 'contact_whatsapp', 'contact_instagram', 'contact_email',
            'contact_maps_url', 'staff_notifications_email')`);
    }

}
