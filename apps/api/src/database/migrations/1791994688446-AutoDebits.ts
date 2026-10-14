import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoDebits1791994688446 implements MigrationInterface {
    name = 'AutoDebits1791994688446'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "auto_debits" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "plan_id" uuid NOT NULL, "service" text NOT NULL, "external_reference" uuid NOT NULL DEFAULT gen_random_uuid(), "mp_preapproval_id" text, "status" text NOT NULL DEFAULT 'pending', "amount" integer NOT NULL, "frequency" smallint NOT NULL, "frequency_type" text NOT NULL, "next_charge_date" date, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancel_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f04ee29c888cb5ef2c0d75fe69a" UNIQUE ("external_reference"), CONSTRAINT "UQ_71297c017734bfa14108e99a007" UNIQUE ("mp_preapproval_id"), CONSTRAINT "CHK_f05193d0878c9578f8b01d785e" CHECK ("amount" >= 0), CONSTRAINT "CHK_5f8cf2977e8e5d0f130626d697" CHECK ("frequency" > 0), CONSTRAINT "CHK_3b34702b4dffc21490ed6dccdd" CHECK ("frequency_type" IN ('months','days')), CONSTRAINT "CHK_a5bc0fab5baab040d5a1055707" CHECK ("cancel_reason" IS NULL OR "cancel_reason" IN ('client','staff','provider','expired')), CONSTRAINT "CHK_c7e44dd71ce6a8a5ac55bedf42" CHECK ("status" IN ('pending','authorized','cancelled')), CONSTRAINT "CHK_2866b34f56eb2b169fc13f1622" CHECK ("service" IN ('performance','recovery')), CONSTRAINT "PK_4e7f5c1ed2e6d95d6a602f2429c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_676864cff458388ea69082d6c9" ON "auto_debits"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_95b0130f8950b28fff897beae5" ON "auto_debits"  ("plan_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_658b61f13dd109e7cf927213f9" ON "auto_debits"  ("status", "created_at") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_auto_debits_active_user_service" ON "auto_debits"  ("user_id", "service") WHERE "status" IN ('pending','authorized')`);
        await queryRunner.query(`ALTER TABLE "plans" ADD "auto_debit_enabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "purchases" ADD "auto_debit_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_866ccaa869c0167e51fa4cd7e7" ON "purchases"  ("auto_debit_id") `);
        await queryRunner.query(`ALTER TABLE "plans" ADD CONSTRAINT "CHK_e7da30416ea5f908778c0e7b9c" CHECK (NOT "auto_debit_enabled" OR "kind" IN ('period_plan','session_pack'))`);
        await queryRunner.query(`ALTER TABLE "auto_debits" ADD CONSTRAINT "FK_676864cff458388ea69082d6c97" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auto_debits" ADD CONSTRAINT "FK_95b0130f8950b28fff897beae52" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "purchases" ADD CONSTRAINT "FK_866ccaa869c0167e51fa4cd7e7a" FOREIGN KEY ("auto_debit_id") REFERENCES "auto_debits"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        // D96: seed plans offered with automatic debit (same list as `insertPlans` in seed-data.ts).
        await queryRunner.query(`UPDATE "plans" SET "auto_debit_enabled" = true WHERE "slug" IN ('performance-mensual','recovery-paquete-4','recovery-paquete-8')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "FK_866ccaa869c0167e51fa4cd7e7a"`);
        await queryRunner.query(`ALTER TABLE "auto_debits" DROP CONSTRAINT "FK_95b0130f8950b28fff897beae52"`);
        await queryRunner.query(`ALTER TABLE "auto_debits" DROP CONSTRAINT "FK_676864cff458388ea69082d6c97"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP CONSTRAINT "CHK_e7da30416ea5f908778c0e7b9c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_866ccaa869c0167e51fa4cd7e7"`);
        await queryRunner.query(`ALTER TABLE "purchases" DROP COLUMN "auto_debit_id"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "auto_debit_enabled"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_auto_debits_active_user_service"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_658b61f13dd109e7cf927213f9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_95b0130f8950b28fff897beae5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_676864cff458388ea69082d6c9"`);
        await queryRunner.query(`DROP TABLE "auto_debits"`);
    }

}
