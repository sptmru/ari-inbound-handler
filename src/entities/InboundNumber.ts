import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class InboundNumber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  number: string;

  @Column()
  vm_notification: string;
}
