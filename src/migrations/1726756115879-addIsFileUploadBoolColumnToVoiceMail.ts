import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsFileUploadBoolColumnToVoiceMail1726756115879 implements MigrationInterface {
    name = 'AddIsFileUploadBoolColumnToVoiceMail1726756115879'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`voicemail\` ADD \`is_exported\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE voicemail MODIFY filename VARCHAR(300) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`voicemail\` DROP COLUMN \`is_exported\``);
        await queryRunner.query(`ALTER TABLE voicemail MODIFY filename VARCHAR(50) NOT NULL`);
    }

}
