import { MigrationInterface, QueryRunner } from "typeorm";

export class PlansSlugUniqueWhenNotDeleted1791927872744 implements MigrationInterface {
    name = 'PlansSlugUniqueWhenNotDeleted1791927872744'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plans" DROP CONSTRAINT "UQ_e7b71bb444e74ee067df057397e"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_plans_slug_not_deleted" ON "plans"  ("slug") WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_plans_slug_not_deleted"`);
        await queryRunner.query(`ALTER TABLE "plans" ADD CONSTRAINT "UQ_e7b71bb444e74ee067df057397e" UNIQUE ("slug")`);
    }

}
