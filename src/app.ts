import * as ari from 'ari-client';
import { Client, StasisStart, StasisEnd, Channel, LiveRecording } from 'ari-client';
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { InboundNumberService } from './services/InboundNumberService';
import { config } from './config/config';
import { CallRecordingService } from './services/CallRecordingService';

const ariUsername = config.ari.username;
const ariPassword = config.ari.password;
const ariUrl = config.ari.url;
const RING_TIME = 15; // 3 rings, assuming 5 seconds per ring

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

      if (inboundNumber.is_queue) {
        let liveRecording: LiveRecording | undefined = undefined;
        channel.on('StasisEnd', async (event: StasisEnd, channel: Channel): Promise<void> => {
          await InboundNumberService.stopRecording(channel, liveRecording);
          logger.debug(`${event.type} on ${channel.name}`);
        });

        logger.debug(`Starting inbound number for ${inboundDID} and channel ${channel.name}`);
        const queueNumbers = InboundNumberService.getListOfQueuePhoneNumbers(inboundNumber);
        if (queueNumbers.length > 0) {
          try {
            const bridge = client.Bridge();
            bridge.create({ type: 'mixing' }).then(async bridge => {
              logger.debug(`Bridge ${bridge.id} created`);

              const callPromises = queueNumbers.map(async number => {
                const outgoing = client.Channel();
                await outgoing.originate({
                  endpoint: `PJSIP/${number}@${config.trunkName}`,
                  app: config.ari.app,
                  appArgs: 'dialed',
                  timeout: RING_TIME,
                  callerId: inboundDID
                });
                return outgoing;
              });

              const outgoingChannels = await Promise.all(callPromises);
              let answeredChannel: Channel | null = null;

              for (const outgoingChannel of outgoingChannels) {
                outgoingChannel.on('StasisStart', async (event: StasisStart, channel: Channel) => {
                  if (!answeredChannel) {
                    answeredChannel = channel;
                    liveRecording = await CallRecordingService.createRecordingChannel({
                      channel,
                      client,
                      appName: config.ari.app,
                      liveRecording,
                      trunkName: config.trunkName,
                      callerId: channel.caller.number
                    });
                    await bridge.addChannel({ channel: [channel.id, event.channel.id] });
                    logger.debug(`Channel ${channel.id} added to bridge ${bridge.id}`);

                    // Hang up all other channels
                    for (const otherChannel of outgoingChannels) {
                      if (otherChannel.id !== channel.id) {
                        await otherChannel.hangup();
                        logger.debug(`Channel ${otherChannel.id} hung up because another channel already answered`);
                      }
                    }
                  } else {
                    await channel.hangup();
                    logger.debug(`Channel ${channel.id} hung up because another channel already answered`);
                  }
                });
              }

              setTimeout(async () => {
                if (!answeredChannel) {
                  logger.debug(`No one answered within ${RING_TIME} seconds, redirecting to voicemail`);
                  await channel.answer();
                  await channel.setChannelVar({ variable: 'MESSAGE', value: inboundNumber.message });
                  await channel.continueInDialplan({
                    context: config.voicemail.context,
                    extension: inboundNumber.voicemail,
                    priority: 1
                  });
                }
              }, RING_TIME * 1000);
            });
          } catch (err) {
            logger.error(`Error processing queue for ${inboundDID}`, err);
          }
        } else {
          logger.error(`No queue numbers found for inbound number ${inboundDID}`);
        }
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
