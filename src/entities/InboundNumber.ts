import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('inbound_number')
export class InboundNumber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 50, nullable: false, unique: true })
  phone: string;

  @Column('varchar', { length: 50, nullable: false })
  voicemail: string;

  @Column('varchar', { length: 255, nullable: false })
  vm_notification: string;

  @Column('varchar', { length: 255, nullable: false })
  court_name: string;
}
