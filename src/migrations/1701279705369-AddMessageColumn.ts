import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageColumn1701279705369 implements MigrationInterface {
  name = 'AddMessageColumn1701279705369';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`message\` varchar(255) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`message\``);
  }
}
