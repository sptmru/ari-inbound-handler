import * as dotenv from 'dotenv';
import * as winston from 'winston';

const config = dotenv.config().parsed;

const logger = winston.createLogger({
  level: config?.LOG_LEVEL || 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: {},
  transports: [new winston.transports.Console()]
});

export { logger };
