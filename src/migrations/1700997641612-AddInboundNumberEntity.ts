import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInboundNumberEntity1700997641612 implements MigrationInterface {
  name = 'AddInboundNumberEntity1700997641612';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`inbound_number\` (\`id\` int NOT NULL AUTO_INCREMENT, \`phone\` varchar(50) NOT NULL, \`vm_notification\` varchar(255) NOT NULL, UNIQUE INDEX \`IDX_9935c0d4f5dadfeb9499ce3c5a\` (\`phone\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_9935c0d4f5dadfeb9499ce3c5a\` ON \`inbound_number\``);
    await queryRunner.query(`DROP TABLE \`inbound_number\``);
  }
}
