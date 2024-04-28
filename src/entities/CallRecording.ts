import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('call_recordings')
export class CallRecording {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column('int', { default: 0, nullable: false })
  court_id: number;

  @Column('varchar', { length: 255, nullable: true })
  callerid_name: string;

  @Column('varchar', { length: 255, nullable: true })
  callerid_num: string;

  @Column('varchar', { length: 50, nullable: true })
  rdnis: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at?: Date;

  @Column('int', { default: 0, nullable: false })
  duration: number;

  @Column('varchar', { length: 255, nullable: true })
  path_to_file: string;
}
