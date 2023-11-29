import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourtName1701270728097 implements MigrationInterface {
    name = 'AddCourtName1701270728097'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`court_name\` varchar(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`court_name\``);
    }

}
