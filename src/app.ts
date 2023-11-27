import * as ari from 'ari-client';
import * as dotenv from 'dotenv';
import { Client, StasisStart, StasisEnd, Channel } from 'ari-client';

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

  const stasisHandler = async (client: Client): Promise<void> => {
    client.on('StasisStart', async (event: StasisStart, channel: Channel): Promise<void> => {
      const inboundDID = event.channel.dialplan.exten;
      logger.debug(`Inbound call to ${inboundDID}`);
      const inboundNumber = await InboundNumberService.getInboundNumber(inboundDID);
      if (!inboundNumber) {
        logger.debug(`Number ${inboundDID} is not in the database`);
        try {
          await channel.continueInDialplan();
          logger.debug(`Channel ${channel.name} continued in dialplan`);
        } catch (err) {
          logger.error(`Error continuing channel ${channel.name} in dialplan`, err);
        }
        return;
      }

      try {
        logger.debug(`Redirecting channel ${channel.name} to voicemail ${inboundNumber.voicemail}`);
        await channel.continueInDialplan({
          context: config?.VOICEMAIL_CONTEXT,
          extension: inboundNumber.voicemail,
          priority: 1
        });
      } catch (err) {
        logger.error(`Error while redirecting channel ${channel.name} to voicemail ${inboundNumber.voicemail}`, err);
      }
    });
    client.on('StasisEnd', async (event: StasisEnd, channel: Channel): Promise<void> => {
      logger.debug(`${event.type} on ${channel.name}`);
    });

    await client.start(config?.ARI_APP_NAME || 'inbound-app');
  };

  ari
    .connect(ariUrl, ariUsername, ariPassword)
    .then(stasisHandler)
    .catch(err => {
      logger.error(`Error connecting to ARI: ${err}`);
      process.exit(1);
    });
})();
