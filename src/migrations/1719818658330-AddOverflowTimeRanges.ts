import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOverflowTimeRanges1719818658330 implements MigrationInterface {
  name = 'AddOverflowTimeRanges1719818658330';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`call_time_range\` (\`id\` int NOT NULL AUTO_INCREMENT, \`weekday\` enum ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL, \`start_time\` time NOT NULL, \`end_time\` time NOT NULL, \`inboundNumberId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`overflow_number\` varchar(255) NULL`);
    await queryRunner.query(
      `ALTER TABLE \`call_time_range\` ADD CONSTRAINT \`FK_4ea3c48c2c600e852a88cc0faa4\` FOREIGN KEY (\`inboundNumberId\`) REFERENCES \`inbound_number\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`call_time_range\` DROP FOREIGN KEY \`FK_4ea3c48c2c600e852a88cc0faa4\``);
    await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`overflow_number\``);
    await queryRunner.query(`DROP TABLE \`call_time_range\``);
  }
}
