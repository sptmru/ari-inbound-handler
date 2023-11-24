import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

const config = dotenv.config().parsed;

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: config?.DB_HOST || 'localhost',
  port: parseInt(config?.DB_PORT || '3306'),
  username: config?.DB_USERNAME || 'root',
  password: config?.DB_PASSWORD || '',
  database: config?.DB_NAME || 'inbound_numbers',
  logging: false,
  synchronize: false,
  entities: ['src/entities/**/*.ts'],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: ['src/subscribers/**/*.ts']
});
