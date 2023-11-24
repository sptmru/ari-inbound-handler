import * as ari from 'ari-client';
import * as dotenv from 'dotenv';

import { logger } from './misc/Logger';
import { Client } from 'ari-client';

const config = dotenv.config().parsed;

const ariHost = config?.ARI_HOST || 'localhost';
const ariPort = config?.ARI_PORT || '8088';
const ariProtocol = config?.ARI_PROTOCOL || 'http';
const ariUsername = config?.ARI_USERNAME || 'asterisk';
const ariPassword = config?.ARI_PASSWORD || 'asterisk';
const ariUrl = `${ariProtocol}://${ariHost}:${ariPort}`;

const callHandler = async (client: Client) => {
  client.once('StasisStart', async (event, channel) => {
    logger.debug(`StasisStart on ${channel.name}`);
    console.dir(event);
  });
  client.once('StasisEnd', async (event, channel) => {
    logger.debug(`StasisEnd on ${channel.name}`);
    console.dir(event);
  });

  await client.start(config?.ARI_APP_NAME || 'inbound-app');
};

ari
  .connect(ariUrl, ariUsername, ariPassword)
  .then(callHandler)
  .catch(err => {
    logger.error(`Error connecting to ARI: ${err}`);
    process.exit(1);
  });
