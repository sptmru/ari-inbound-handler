import * as ari from 'ari-client';
import { Client, StasisStart, StasisEnd, Channel } from 'ari-client';
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { InboundNumberService } from './services/InboundNumberService';
import { config } from './config/config';
import { promptCitationId } from './types/PromptCitationIdEnum';

const ariUsername = config.ari.username;
const ariPassword = config.ari.password;
const ariUrl = config.ari.url;

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

(async () => {
  try {
    await dataSource.initialize();
    logger.debug('Data Source initialized');
  } catch (err) {
    logger.error('Error during Data Source initialization', err);
  }

  const stasisHandler = async (client: Client): Promise<void> => {
    client.on('StasisStart', async (event: StasisStart, inboundChannel: Channel): Promise<void> => {
      const inboundDID = event.channel.dialplan.exten;
      if (inboundDID === 's') {
        return;
      }

      logger.debug(`Inbound call to ${inboundDID}`);
      const inboundNumber = await InboundNumberService.getInboundNumber(inboundDID);
      if (!inboundNumber) {
        logger.debug(`Number ${inboundDID} is not in the database`);
        try {
          await inboundChannel.continueInDialplan();
          logger.debug(`Channel ${inboundChannel.name} continued in dialplan`);
        } catch (err) {
          logger.error(`Error continuing channel ${inboundChannel.name} in dialplan`, err);
        }
        return;
      }

      const ariData = {
        channel: inboundChannel,
        client,
        appName: config.ari.app,
        trunkName: config.trunkName,
        callerId: inboundDID,
        inboundDID
      };

      if (inboundNumber.prompt_citation_id === promptCitationId.YES) {
        logger.debug(`Starting prompt citation IVR`);
        await InboundNumberService.handlePromptCitationIvr(inboundNumber, ariData);
      } else {
        void InboundNumberService.handleInboundQueue(inboundNumber, inboundDID, ariData);
      }
    });

    client.on('StasisEnd', async (event: StasisEnd, channel: Channel): Promise<void> => {
      logger.debug(`${event.type} on ${channel.name}`);
    });

    await client.start(config.ari.app);
  };

  ari
    .connect(ariUrl, ariUsername, ariPassword)
    .then(stasisHandler)
    .catch(err => {
      logger.error(`Error connecting to ARI: ${err}`);
      process.exit(1);
    });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
})();
