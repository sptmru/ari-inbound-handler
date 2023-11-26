import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('inbound_number')
export class InboundNumber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  phone: string;

  @Column()
  vm_notification: string;
}
