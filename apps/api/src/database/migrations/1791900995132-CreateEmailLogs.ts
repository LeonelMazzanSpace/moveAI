import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmailLogs1791900995132 implements MigrationInterface {
    name = 'CreateEmailLogs1791900995132'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "idempotency_key" text NOT NULL, "template" text NOT NULL, "user_id" uuid, "status" text NOT NULL, "provider_message_id" text, "error_code" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sent_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_34e9ffce289c74b1ebc3a1faf34" UNIQUE ("idempotency_key"), CONSTRAINT "CHK_fe4083ea4acb738bd225206167" CHECK ("status" IN ('pending','sent','failed','skipped')), CONSTRAINT "PK_999382218924e953a790d340571" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "email_logs"`);
    }

}
