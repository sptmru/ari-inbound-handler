import * as dotenv from 'dotenv';
import * as winston from 'winston';

const config = dotenv.config().parsed;

const logger = winston.createLogger({
  level: config?.LOG_LEVEL || 'debug',
  format: winston.format.combine(winston.format.simple(), winston.format.colorize()),
  defaultMeta: { service: 'esl' },
  transports: [new winston.transports.Console()]
});
