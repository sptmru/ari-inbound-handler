import { Channel, ChannelDtmfReceived, StasisEnd } from 'ari-client';
import { config } from '../config/config';
import { InboundNumber } from '../entities/InboundNumber';
import { logger } from '../misc/Logger';
import { AriData } from '../types/AriData';
import { CallRecordingService } from './CallRecordingService';
import { InboundNumberService } from './InboundNumberService';
import { PromptCitationData } from '../types/PromptCitationData';
import { CitationApiService } from './CitationApiService';

export class InboundQueueService {
  static getListOfQueuePhoneNumbers(inboundNumber: InboundNumber): string[] {
    return inboundNumber.queue_numbers.split(',').map(phone => phone.trim());
  }

  static async callQueueMember(
    phoneNumber: string,
    ariData: AriData,
    isPromptCitationQueue: boolean = false,
    promptCitationData?: PromptCitationData
  ): Promise<boolean> {
    const { client, channel: inboundChannel } = ariData;

    let success = false;

    logger.debug(`Calling queue member ${phoneNumber}`);

    const outboundChannel = client.Channel();
    try {
      await outboundChannel.originate({
        endpoint: phoneNumber.length > 4 ? `PJSIP/${phoneNumber}@${config.trunkName}` : `PJSIP/${phoneNumber}`,
        app: config.ari.app,
        appArgs: 'dialed',
        timeout: config.inboundQueue.ringTime,
        callerId: inboundChannel.caller.number
      });
    } catch (err) {
      logger.error(`Error while calling queue member ${phoneNumber}`, err);
      return false;
    }

    outboundChannel.on('StasisStart', async () => {
      logger.debug(`External queue channel ${outboundChannel.id} answered`);
      success = true;

      const bridge = client.Bridge();

      outboundChannel.once('StasisEnd', () => {
        logger.debug(`External queue channel ${outboundChannel.id} got StasisEnd`);

        logger.debug(`Destroying bridge ${bridge.id}`);
        InboundNumberService.destroyBridge(bridge);
        InboundNumberService.hangupChannel(inboundChannel);
      });

      if (isPromptCitationQueue && promptCitationData) {
        promptCitationData.extension = phoneNumber;
        void CitationApiService.sendNotificationRequest(promptCitationData);
      }

      bridge.create({ type: 'mixing' }, () => {
        logger.debug(`Bridge ${bridge.id} created`);
        // await inboundChannel.answer();
        bridge.addChannel({ channel: [inboundChannel.id, outboundChannel.id] });
        logger.debug(`Channels ${inboundChannel.id} and ${outboundChannel.id} were added to bridge ${bridge.id}`);
      });
    });

    return await new Promise(resolve => {
      outboundChannel.once('ChannelDestroyed', () => {
        logger.debug(`External channel ${outboundChannel.id} got ChannelDestroyed`);
        resolve(success);
      });
    });
  }

  static async callQueueMembers(
    queueNumbers: string[],
    ariData: AriData,
    isPromptCitationQueue: boolean = false,
    promptCitationData?: PromptCitationData
  ): Promise<boolean> {
    if (queueNumbers.length === 0) {
      logger.error(`No queue numbers found`);
      return false;
    }

    logger.debug(`Calling queue members ${queueNumbers.join(', ')}`);

    let success = false;
    for (const number of queueNumbers) {
      success = await this.callQueueMember(number, ariData, isPromptCitationQueue, promptCitationData);

      if (success) {
        break;
      }
    }

    return success;
  }

  static async inboundQueueHandler(
    inboundNumber: InboundNumber,
    inboundDID: string,
    ariData: AriData
  ): Promise<string | void> {
    const { channel: inboundChannel } = ariData;
    const liveRecording = await CallRecordingService.createRecordingChannel(ariData);

    inboundChannel.on('StasisEnd', async (event: StasisEnd, channel: Channel): Promise<void> => {
      await InboundNumberService.stopRecording(channel, liveRecording);
      logger.debug(`${event.type} on ${channel.name}`);
    });

    logger.debug(`Starting inbound queue for ${inboundDID} and channel ${inboundChannel.name}`);
    const queueNumbers = InboundQueueService.getListOfQueuePhoneNumbers(inboundNumber);
    const success = await InboundQueueService.callQueueMembers(queueNumbers, ariData);

    if (!success) {
      try {
        logger.debug(`Redirecting channel ${inboundChannel.name} to voicemail ${inboundNumber.voicemail}`);
        await inboundChannel.answer();
        await inboundChannel.setChannelVar({ variable: 'MESSAGE', value: inboundNumber.message });
        await inboundChannel.continueInDialplan({
          context: config.voicemail.context,
          extension: inboundNumber.voicemail,
          priority: 1
        });
      } catch (err) {
        logger.error(
          `Error while redirecting channel ${inboundChannel.name} to voicemail ${inboundNumber.voicemail}`,
          err
        );
      }
    }
  }

  static async promptCitationQueueHandler(
    inboundNumber: InboundNumber,
    promptCitationData: PromptCitationData,
    ariData: AriData
  ): Promise<void> {
    const { channel: inboundChannel, client } = ariData;
    const liveRecording = await CallRecordingService.createRecordingChannel(ariData);

    const playback = client.Playback();

    inboundChannel.on('StasisEnd', async (event: StasisEnd, channel: Channel): Promise<void> => {
      await InboundNumberService.stopRecording(channel, liveRecording);
      logger.debug(`${event.type} on ${channel.name}`);
    });

    inboundChannel.on('ChannelDtmfReceived', async (event: ChannelDtmfReceived, channel: Channel): Promise<void> => {
      if (event.digit === '1 ') {
        try {
          void playback.stop();
        } catch (err) {
          logger.debug(`Stopping playback failed on ${inboundChannel.id}: there is no playback to stop`);
        }
        await InboundNumberService.stopRecording(channel, liveRecording);
        logger.info(`Channel ${inboundChannel.id} pressed 1 to request a callback, processing`);

        await inboundChannel.play(
          {
            media: [
              `sound: ${config.promptCitation.queueCallbackConfirmationSoundOne}`,
              `sound: ${config.promptCitation.queueCallbackConfirmationSoundTwo}`
            ]
          },
          playback
        );
      }
    });

    const playCallbackInfoSoundInterval = setInterval(async () => {
      await inboundChannel.play({ media: `sound: ${config.promptCitation.queueCallbackInfoSound}` }, playback);
    }, config.promptCitation.queueCallbackInfoSoundInterval);

    await inboundChannel.startMoh();

    logger.debug(
      `Starting inbound queue for ${promptCitationData.dialedPhoneNumber} and channel ${inboundChannel.name}`
    );
    const queueNumbers = InboundQueueService.getListOfQueuePhoneNumbers(inboundNumber);
    const success = await InboundQueueService.callQueueMembers(queueNumbers, ariData, true, promptCitationData);

    clearInterval(playCallbackInfoSoundInterval);
    await inboundChannel.stopMoh();

    if (!success) {
      try {
        logger.debug(`Redirecting channel ${inboundChannel.name} to voicemail ${inboundNumber.voicemail}`);
        await inboundChannel.answer();
        await inboundChannel.setChannelVar({ variable: 'MESSAGE', value: inboundNumber.message });
        await inboundChannel.continueInDialplan({
          context: config.voicemail.context,
          extension: inboundNumber.voicemail,
          priority: 1
        });
      } catch (err) {
        logger.error(
          `Error while redirecting channel ${inboundChannel.name} to voicemail ${inboundNumber.voicemail}`,
          err
        );
      }
    }
  }
}
