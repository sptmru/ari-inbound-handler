import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHolidayAudioPlaybackSwitcher1732650739962 implements MigrationInterface {
    name = 'AddHolidayAudioPlaybackSwitcher1732650739962'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`play_holiday_message\` tinyint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`play_holiday_message\``);
    }

}
