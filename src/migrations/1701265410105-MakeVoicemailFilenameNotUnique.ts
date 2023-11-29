import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeVoicemailFilenameNotUnique1701265410105 implements MigrationInterface {
    name = 'MakeVoicemailFilenameNotUnique1701265410105'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_ac1680a82f9ed05e32d43c2c4a\` ON \`voicemail\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_ac1680a82f9ed05e32d43c2c4a\` ON \`voicemail\` (\`filename\`)`);
    }

}
