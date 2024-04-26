import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallRecordingEntity1714133127169 implements MigrationInterface {
  name = 'AddCallRecordingEntity1714133127169';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`call_recordings\` (\`id\` int NOT NULL AUTO_INCREMENT, \`court_id\` int NOT NULL DEFAULT '0', \`callerid_name\` varchar(255) NULL, \`callerid_num\` varchar(255) NULL, \`rdnis\` varchar(50) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`duration\` int NOT NULL DEFAULT '0', \`path_to_file\` varchar(255) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`call_recordings\``);
  }
}
