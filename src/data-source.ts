import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

import { InboundNumber } from './entities/InboundNumber';

const config = dotenv.config().parsed;

const dataSource = new DataSource({
  type: 'mysql',
  host: config?.DB_HOST || 'localhost',
  port: parseInt(config?.DB_PORT || '3306'),
  username: config?.DB_USERNAME || 'root',
  password: config?.DB_PASSWORD || '',
  database: config?.DB_NAME || 'inbound_numbers',
  logging: config?.LOG_LEVEL === 'debug',
  synchronize: false,
  entities: [InboundNumber],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: ['src/subscribers/**/*.ts']
});

export { dataSource };
