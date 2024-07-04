import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQueueStrategyOptionToInboundNumberEntity1720120996976 implements MigrationInterface {
  name = 'AddQueueStrategyOptionToInboundNumberEntity1720120996976';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`inbound_number\` ADD \`queue_strategy\` enum ('RINGALL', 'ROUNDROBIN') NOT NULL DEFAULT 'ROUNDROBIN'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`queue_strategy\``);
  }
}
