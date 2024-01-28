import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('followme')
export class FollowMe {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 50, nullable: false, unique: true })
  extension: string;

  @Column('varchar', { length: 50, nullable: true })
  followme_number: string;
}
