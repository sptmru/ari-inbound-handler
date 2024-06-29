import * as winston from 'winston';
import { config } from '../config/config';

const consoleLogFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

const logger = winston.createLogger({
  level: config.log.level,
  defaultMeta: {},
  transports: config.log.logToFile
    ? [
        new winston.transports.Console({ format: consoleLogFormat }),
        new winston.transports.File({ filename: `${config.log.directory}/${config.log.file}`, format: fileLogFormat }),
      ]
    : [new winston.transports.Console({ format: consoleLogFormat })],
});

export { logger };
