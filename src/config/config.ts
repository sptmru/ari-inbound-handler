import * as dotenv from 'dotenv';

const parsedConfig = dotenv.config().parsed;

export const config = {
  log: {
    level: parsedConfig?.LOG_LEVEL != null ? parsedConfig.LOG_LEVEL : 'debug',
    directory: parsedConfig?.LOG_DIRECTORY != null ? parsedConfig.LOG_DIRECTORY : './logs',
    file: parsedConfig?.LOG_LEVEL != null ? `${parsedConfig.LOG_LEVEL}.log` : 'debug.log',
    logToFile: parsedConfig?.LOG_TO_FILE != null ? parsedConfig.LOG_TO_FILE.toLowerCase() === 'true' : false
  },
  db: {
    host: parsedConfig?.DB_HOST != null ? parsedConfig.DB_HOST : 'localhost',
    port: parsedConfig?.DB_PORT != null ? parseInt(parsedConfig.DB_PORT) : 3306,
    username: parsedConfig?.DB_USERNAME != null ? parsedConfig.DB_USERNAME : 'inboundnumbers',
    password: parsedConfig?.DB_PASSWORD != null ? parsedConfig.DB_PASSWORD : 'inboundnumbers',
    rootPassword: parsedConfig?.DB_ROOT_PASSWORD != null ? parsedConfig.DB_ROOT_PASSWORD : 'root',
    name: parsedConfig?.DB_NAME != null ? parsedConfig.DB_NAME : 'inbound_numbers'
  },
  smtp: {
    host: parsedConfig?.SMTP_HOST != null ? parsedConfig.SMTP_HOST : 'smtp.example.com',
    port: parsedConfig?.SMTP_PORT != null ? parseInt(parsedConfig.SMTP_PORT) : 587,
    secure: parsedConfig?.SMTP_SECURE != null ? parsedConfig.SMTP_SECURE === 'true' : false,
    username: parsedConfig?.SMTP_USERNAME != null ? parsedConfig.SMTP_USERNAME : 'username',
    password: parsedConfig?.SMTP_PASSWORD != null ? parsedConfig.SMTP_PASSWORD : 'password',
    mailFrom: parsedConfig?.MAIL_FROM != null ? parsedConfig.MAIL_FROM : 'alert@gmail.com',
    mailSubject: parsedConfig?.MAIL_SUBJECT != null ? parsedConfig.MAIL_SUBJECT : 'New Voicemail'
  },
  ari: {
    host: parsedConfig?.ARI_HOST != null ? parsedConfig.ARI_HOST : 'localhost',
    port: parsedConfig?.ARI_PORT != null ? parsedConfig.ARI_PORT : '8088',
    protocol: parsedConfig?.ARI_PROTOCOL != null ? parsedConfig.ARI_PROTOCOL : 'http',
    username: parsedConfig?.ARI_USERNAME != null ? parsedConfig.ARI_USERNAME : 'asterisk',
    password: parsedConfig?.ARI_PASSWORD != null ? parsedConfig.ARI_PASSWORD : 'asterisk',
    url:
      parsedConfig?.ARI_PROTOCOL != null && parsedConfig?.ARI_HOST != null && parsedConfig?.ARI_PORT != null
        ? `${parsedConfig.ARI_PROTOCOL}://${parsedConfig.ARI_HOST}:${parsedConfig.ARI_PORT}`
        : 'http://localhost:8088',
    app: parsedConfig?.ARI_APP_NAME != null ? parsedConfig.ARI_APP_NAME : 'inbound-app',
    app17087298587:
      parsedConfig?.ARI_APP_NAME_17087298587 != null
        ? parsedConfig.ARI_APP_NAME_17087298587
        : 'inbound_route_17087298587'
  },
  voicemail: {
    context: parsedConfig?.VOICEMAIL_CONTEXT != null ? parsedConfig.VOICEMAIL_CONTEXT : 'to-voicemail',
    directory: parsedConfig?.VOICEMAIL_DIRECTORY != null ? parsedConfig.VOICEMAIL_DIRECTORY : '/opt/voicemail'
  },
  callRecording: {
    directory:
      parsedConfig?.CALL_RECORDING_DIRECTORY != null ? parsedConfig.CALL_RECORDING_DIRECTORY : '/opt/recordings'
  },
  trunkName: parsedConfig?.TRUNK_NAME != null ? parsedConfig.TRUNK_NAME : 'twilio-na-us',
  greetingSound: parsedConfig?.GREETING_SOUND != null ? parsedConfig.GREETING_SOUND : 'speech_17087298587',
  callerId: parsedConfig?.CALLER_ID != null ? parsedConfig.CALLER_ID : '+17087298587',
  pushNotificationsUrl:
    parsedConfig?.PUSH_NOTIFICATION_URL != null ? parsedConfig.PUSH_NOTIFICATION_URL : 'http://localhost'
};
