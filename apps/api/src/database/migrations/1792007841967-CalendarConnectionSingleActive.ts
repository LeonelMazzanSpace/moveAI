import { MigrationInterface, QueryRunner } from "typeorm";

// M-8: at most one calendar connection not deleted (D94), enforced by the database and not only by the advisory lock of
// `saveConnection`. Created with `migration:create`: TypeORM cannot describe a unique index on a constant.
export class CalendarConnectionSingleActive1792007841967 implements MigrationInterface {
    name = 'CalendarConnectionSingleActive1792007841967'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_calendar_connections_single_active" ON "calendar_connections" ((true)) WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_calendar_connections_single_active"`);
    }

}
