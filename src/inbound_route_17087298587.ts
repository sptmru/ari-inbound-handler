import * as ari from 'ari-client';
import { Client, StasisStart, StasisEnd, Channel, Playback } from 'ari-client';
import { exit } from 'process';

import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { InboundNumberService } from './services/InboundNumberService';
import { config } from './config/config';

const ariUsername = config.ari.username;
const ariPassword = config.ari.password;
const ariUrl = config.ari.url;

const appName = config.ari.app17087298587;

void (async (): Promise<void> => {
  try {
    await dataSource.initialize();
    logger.debug('Data Source initialized');
  } catch (err) {
    logger.error('Error during Data Source initialization', err);
  }

  const stasisHandler = async (client: Client): Promise<void> => {
    logger.debug(`ARI app ${appName} started`);
    client.on('StasisStart', async (event: StasisStart, channel: Channel): Promise<void> => {
      const inboundDID = event.channel.dialplan.exten;
      if (inboundDID === 's') {
        return;
      }

      logger.debug(`Inbound call to ${inboundDID}`);

      const internalNumber: Array<string> = [];
      const playback: Playback = client.Playback();
      void channel.answer();

      channel.on('ChannelDtmfReceived', dtmfEvent =>
        InboundNumberService.handleInternalNumberDtmf(internalNumber, {
          dtmfReceiveEvent: dtmfEvent,
          channel,
          playback,
          client,
          appName,
          trunkName: config.trunkName,
          callerId: config.callerId,
          inboundDID,
        })
      );

      logger.debug(`Playing ${config.greetingSound} to ${channel.id}`);
      await channel.play({ media: [`sound:${config.greetingSound}`, `sound:${config.greetingSound}`] }, playback);
    });
    client.on('StasisEnd', (event: StasisEnd, channel: Channel): void => {
      logger.debug(`${event.type} on ${channel.name}`);
    });

    await client.start(config.ari.app17087298587);
  };

  ari
    .connect(ariUrl, ariUsername, ariPassword)
    .then(stasisHandler)
    .catch(err => {
      logger.error(`Error connecting to ARI: ${err}`);
      exit(1);
    });
})();
