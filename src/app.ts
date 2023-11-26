import * as ari from 'ari-client';
import * as dotenv from 'dotenv';
import { Client } from 'ari-client';

import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { InboundNumberService } from './services/InboundNumberService';

const config = dotenv.config().parsed;

const ariHost = config?.ARI_HOST || 'localhost';
const ariPort = config?.ARI_PORT || '8088';
const ariProtocol = config?.ARI_PROTOCOL || 'http';
const ariUsername = config?.ARI_USERNAME || 'asterisk';
const ariPassword = config?.ARI_PASSWORD || 'asterisk';
const ariUrl = `${ariProtocol}://${ariHost}:${ariPort}`;

(async () => {
  try {
    await dataSource.initialize();
    logger.debug('Data Source initialized');
  } catch (err) {
    logger.error('Error during Data Source initialization', err);
  }

  const callHandler = async (client: Client) => {
    client.once('StasisStart', async (event, channel) => {
      logger.debug(`Inbound call to ${channel.dialplan.exten}`);
      const inboundNumber = await InboundNumberService.getInboundNumber(channel.dialplan.exten);
      if (!inboundNumber) {
        logger.debug(`Number ${channel.dialplan.exten} is not in the database`);
        try {
          await channel.continueInDialplan();
          logger.debug(`Channel ${channel.name} continued in dialplan`);
        } catch (err) {
          logger.error(`Error continuing channel ${channel.name} in dialplan`, err);
        }
        return;
      }
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
})();
