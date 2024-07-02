import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { InboundNumber } from './InboundNumber';
import { Weekday } from '../types/Weekday';

@Entity('call_time_range')
export class CallTimeRange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: Weekday,
  })
  weekday: Weekday;

  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  @ManyToOne('InboundNumber', 'callTimeRanges')
  inboundNumber: InboundNumber;
}
