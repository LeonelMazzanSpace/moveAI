import { MigrationInterface, QueryRunner } from "typeorm";

export class GoogleCalendar1791996896582 implements MigrationInterface {
    name = 'GoogleCalendar1791996896582'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "calendar_connections" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "google_account_email" text NOT NULL, "calendar_id" text, "calendar_name" text, "refresh_token_enc" text NOT NULL, "status" text NOT NULL DEFAULT 'connected', "last_push_at" TIMESTAMP WITH TIME ZONE, "last_pull_at" TIMESTAMP WITH TIME ZONE, "last_error_code" text, "connected_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_a3d2a521a9c8fa24d4fda33739" CHECK ("status" IN ('connected','needs_reconnect')), CONSTRAINT "PK_c2f78ae03c2e2a9389f6d8ddc64" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ad9e282c962d2f039f10b33349" ON "calendar_connections"  ("connected_by") `);
        await queryRunner.query(`CREATE TABLE "calendar_event_links" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "booking_id" uuid NOT NULL, "google_event_id" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3c963f58497aebe47ea5dc028a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_741e5cae18b91aed7c76bf4393" ON "calendar_event_links"  ("booking_id") `);
        await queryRunner.query(`ALTER TABLE "time_slots" ADD "calendar_blocked_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_206fd83f2ba9a023cd4ed11d7c" ON "time_slots"  ("calendar_blocked_at") WHERE "calendar_blocked_at" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "calendar_connections" ADD CONSTRAINT "FK_ad9e282c962d2f039f10b33349f" FOREIGN KEY ("connected_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "calendar_event_links" ADD CONSTRAINT "FK_741e5cae18b91aed7c76bf4393f" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "calendar_event_links" DROP CONSTRAINT "FK_741e5cae18b91aed7c76bf4393f"`);
        await queryRunner.query(`ALTER TABLE "calendar_connections" DROP CONSTRAINT "FK_ad9e282c962d2f039f10b33349f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_206fd83f2ba9a023cd4ed11d7c"`);
        await queryRunner.query(`ALTER TABLE "time_slots" DROP COLUMN "calendar_blocked_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_741e5cae18b91aed7c76bf4393"`);
        await queryRunner.query(`DROP TABLE "calendar_event_links"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad9e282c962d2f039f10b33349"`);
        await queryRunner.query(`DROP TABLE "calendar_connections"`);
    }

}
