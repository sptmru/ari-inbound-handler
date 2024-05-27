import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInboundQueueStuff1716783919199 implements MigrationInterface {
  name = 'AddInboundQueueStuff1716783919199';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`is_queue\` tinyint NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`queue_numbers\` varchar(255) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`queue_numbers\``);
    await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`is_queue\``);
  }
}
