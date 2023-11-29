import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoicemailEntity1701123613981 implements MigrationInterface {
    name = 'AddVoicemailEntity1701123613981'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`voicemail\` (\`id\` int NOT NULL AUTO_INCREMENT, \`filename\` varchar(50) NOT NULL, \`origmailbox\` varchar(50) NOT NULL, \`context\` varchar(255) NOT NULL, \`macrocontext\` varchar(255) NULL, \`exten\` varchar(50) NOT NULL, \`rdnis\` varchar(50) NULL, \`priority\` varchar(50) NOT NULL, \`callerchan\` varchar(255) NOT NULL, \`callerid\` varchar(255) NOT NULL, \`origdate\` varchar(255) NOT NULL, \`origtime\` varchar(255) NOT NULL, \`category\` varchar(255) NULL, \`msg_id\` varchar(255) NULL, \`flag\` varchar(255) NULL, \`duration\` varchar(255) NOT NULL, \`sent\` tinyint NOT NULL DEFAULT 0, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`voicemail\``);
    }

}
