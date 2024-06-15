import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptCitationId1718451429947 implements MigrationInterface {
  name = 'AddPromptCitationId1718451429947';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`inbound_number\` ADD \`prompt_citation_id\` enum ('Y', 'N') NOT NULL DEFAULT 'N'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`prompt_citation_id\``);
  }
}
