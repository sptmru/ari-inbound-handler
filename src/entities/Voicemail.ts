import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// eslint-disable-next-line no-shadow
enum IsListened {
  LISTENED = 'Y',
  NOT_LISTENED = 'N',
}

@Entity('voicemail')
@Index(['filename', 'origmailbox'], { unique: true })
export class Voicemail {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column('varchar', { length: 50, nullable: false })
  filename?: string;

  @Column('varchar', { length: 50, nullable: false })
  origmailbox: string;

  @Column('varchar', { length: 255, nullable: false })
  context: string;

  @Column('varchar', { length: 255, nullable: true })
  macrocontext?: string;

  @Column('varchar', { length: 50, nullable: false })
  exten: string;

  @Column('varchar', { length: 50, nullable: true })
  rdnis: string;

  @Column('varchar', { length: 50, nullable: false })
  priority: number;

  @Column('varchar', { length: 255, nullable: false })
  callerchan: string;

  @Column('varchar', { length: 255, nullable: false })
  callerid: string;

  @Column('varchar', { length: 255, nullable: false })
  origdate: string;

  @Column('varchar', { length: 255, nullable: false })
  origtime: number;

  @Column('varchar', { length: 255, nullable: true })
  category?: string;

  @Column('varchar', { length: 255, nullable: true })
  msg_id: string;

  @Column('varchar', { length: 255, nullable: true })
  flag?: string;

  @Column('varchar', { length: 255, nullable: false })
  duration: number;

  @Column('bool', { default: false })
  sent: boolean;

  @Column({ type: 'enum', enum: IsListened, default: IsListened.NOT_LISTENED })
  is_listened?: string;
}
