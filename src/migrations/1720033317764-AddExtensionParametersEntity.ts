import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtensionParametersEntity1720033317764 implements MigrationInterface {
  name = 'AddExtensionParametersEntity1720033317764';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`extension_parameters\` (\`id\` int NOT NULL AUTO_INCREMENT, \`extension\` varchar(50) NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, UNIQUE INDEX \`IDX_ab5997c7e0f3dbe832d92348e1\` (\`extension\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_ab5997c7e0f3dbe832d92348e1\` ON \`extension_parameters\``);
    await queryRunner.query(`DROP TABLE \`extension_parameters\``);
  }
}
