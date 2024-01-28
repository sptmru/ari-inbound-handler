import * as ari from 'ari-client';
import * as dotenv from 'dotenv';
import { Client, StasisStart, StasisEnd, Channel, Playback } from 'ari-client';

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

const appName: string = 'inbound_route_17087298587';
const trunkName: string = 'twilio-na-us';
const greetingSound: string = 'speech_17087298587';

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

      const internalNumber: Array<string> = [];
      const playback: Playback = client.Playback();

      channel.on('ChannelDtmfReceived', event =>
        InboundNumberService.handleInternalNumberDtmf(internalNumber, {
          dtmfReceiveEvent: event,
          channel,
          playback,
          client,
          appName,
          trunkName
        })
      );

      logger.debug(`Playing ${greetingSound} to ${channel.id}`);
      await channel.play({ media: [`sound:${greetingSound}`, `sound:${greetingSound}`] }, playback);
    });
    client.on('StasisEnd', async (event: StasisEnd, channel: Channel): Promise<void> => {
      logger.debug(`${event.type} on ${channel.name}`);
    });

    await client.start('inbound_route_17087298587');
  };

  ari
    .connect(ariUrl, ariUsername, ariPassword)
    .then(stasisHandler)
    .catch(err => {
      logger.error(`Error connecting to ARI: ${err}`);
      process.exit(1);
    });
})();
