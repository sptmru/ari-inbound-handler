import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInboundNumberEntity1700846672200 implements MigrationInterface {
  private tableName = 'inbound_number';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS ${this.tableName} (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                number VARCHAR(50) NOT NULL,
                vm_notification VARCHAR(500) NOT NULL
            );
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE IF EXISTS ${this.tableName};
        `);
  }
}
