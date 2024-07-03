import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('extension_parameters')
export class ExtensionParameters {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 50, nullable: false, unique: true })
  extension: string;

  @Column('bool', { default: true })
  is_active: boolean;
}
