import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeFilenameAndVoicemailUnique1701265855132 implements MigrationInterface {
  name = 'MakeFilenameAndVoicemailUnique1701265855132';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_beed4fc3d35cca6309ec679aca\` ON \`voicemail\``);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_beed4fc3d35cca6309ec679aca\` ON \`voicemail\` (\`filename\`, \`origmailbox\`)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_beed4fc3d35cca6309ec679aca\` ON \`voicemail\``);
    await queryRunner.query(
      `CREATE INDEX \`IDX_beed4fc3d35cca6309ec679aca\` ON \`voicemail\` (\`filename\`, \`origmailbox\`)`
    );
  }
}
