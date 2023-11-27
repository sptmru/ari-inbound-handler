import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoicemailToInboundNumber1701114898837 implements MigrationInterface {
    name = 'AddVoicemailToInboundNumber1701114898837'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`voicemail\` varchar(50) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`voicemail\``);
    }

}
