import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePhoneColumnInInboundNumber1700851569859 implements MigrationInterface {
    name = 'RenamePhoneColumnInInboundNumber1700851569859'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` CHANGE \`number\` \`phone\` varchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` CHANGE \`id\` \`id\` int NOT NULL AUTO_INCREMENT`);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`phone\``);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`phone\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`vm_notification\``);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`vm_notification\` varchar(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`vm_notification\``);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`vm_notification\` varchar(500) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` DROP COLUMN \`phone\``);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` ADD \`phone\` varchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` CHANGE \`id\` \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT`);
        await queryRunner.query(`ALTER TABLE \`inbound_number\` CHANGE \`phone\` \`number\` varchar(50) NOT NULL`);
    }

}
