import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCitationIvrPromptColumn1734619375971 implements MigrationInterface {
    name = 'AddCitationIvrPromptColumn1734619375971'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`citation_ivr_prompt\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`citation_ivr_prompt\``);
    }

}
