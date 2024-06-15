import * as ari from 'ari-client';
import { Client, StasisStart, StasisEnd, Channel } from 'ari-client';
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { InboundNumberService } from './services/InboundNumberService';
import { config } from './config/config';
import { InboundQueueService } from './services/InboundQueueService';
import { promptCitationId } from './types/PromptCitationIdEnum';

const ariUsername = config.ari.username;
const ariPassword = config.ari.password;
const ariUrl = config.ari.url;

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
      if (inboundDID === 's') {
        return;
      }
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

      if (inboundNumber.prompt_citation_id === promptCitationId.YES) {
        logger.debug(`Starting prompt citation IVR`);
      }
      if (inboundNumber.is_queue) {
        await InboundQueueService.inboundQueueHandler(inboundNumber, inboundDID, {
          client,
          channel,
          appName: config.ari.app,
          trunkName: config.trunkName,
          callerId: inboundDID
        });
      } else {
        try {
          logger.debug(`Redirecting channel ${channel.name} to voicemail ${inboundNumber.voicemail}`);
          await channel.answer();
          await channel.setChannelVar({ variable: 'MESSAGE', value: inboundNumber.message });
          await channel.continueInDialplan({
            context: config.voicemail.context,
            extension: inboundNumber.voicemail,
            priority: 1
          });
        } catch (err) {
          logger.error(`Error while redirecting channel ${channel.name} to voicemail ${inboundNumber.voicemail}`, err);
        }
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
})();
