import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from './config/config';

const dataSource = new DataSource({
  type: 'mysql',
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.name,
  logging: config.log.level === 'debug',
  synchronize: false,
  entities: ['src/entities/**/*.ts'],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: ['src/subscribers/**/*.ts']
});

export { dataSource };
