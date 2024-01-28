import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFollowMeEntity1700997641612 implements MigrationInterface {
  name = 'AddFollowMeEntity1700997641612';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`followme\` (\`id\` int NOT NULL AUTO_INCREMENT, \`extension\` varchar(50) NOT NULL, \`followme_number\` varchar(50) NOT NULL, UNIQUE INDEX \`IDX_9935c0d4f5dadfeb9499ce3c5a\` (\`extension\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_9935c0d4f5dadfeb9499ce3c5a\` ON \`followme\``);
    await queryRunner.query(`DROP TABLE \`followme\``);
  }
}
