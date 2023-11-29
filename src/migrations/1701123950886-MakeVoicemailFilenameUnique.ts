import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeVoicemailFilenameUnique1701123950886 implements MigrationInterface {
    name = 'MakeVoicemailFilenameUnique1701123950886'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`voicemail\` ADD UNIQUE INDEX \`IDX_ac1680a82f9ed05e32d43c2c4a\` (\`filename\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`voicemail\` DROP INDEX \`IDX_ac1680a82f9ed05e32d43c2c4a\``);
    }

}
