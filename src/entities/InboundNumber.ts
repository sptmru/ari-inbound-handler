import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { PromptCitationId } from '../types/PromptCitationIdEnum';
import { CallTimeRange } from './CallTimeRange';

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

  @Column('varchar', { length: 255, nullable: true })
  overflow_number: string;

  @Column({ type: 'enum', enum: PromptCitationId, default: PromptCitationId.NO })
  prompt_citation_id: string;

  @OneToMany(() => CallTimeRange, callTimeRange => callTimeRange.inboundNumber)
  callTimeRanges: CallTimeRange[];
}
