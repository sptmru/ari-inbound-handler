import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { promptCitationId } from '../types/PromptCitationIdEnum';

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

  @Column('varchar', { length: 255, nullable: true })
  message: string;

  @Column('int', { default: 0, nullable: false })
  court_id: string;

  @Column('bool', { default: false })
  is_queue: boolean;

  @Column('varchar', { length: 255, nullable: true })
  queue_numbers: string;

  @Column({ type: 'enum', enum: promptCitationId, default: promptCitationId.NO })
  prompt_citation_id: string;
}
