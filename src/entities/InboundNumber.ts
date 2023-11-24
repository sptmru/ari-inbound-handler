import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class InboundNumber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  phone: string;

  @Column()
  vm_notification: string;
}
