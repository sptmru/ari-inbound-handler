import { Bridge, Channel, ChannelDtmfReceived, Playback, StasisEnd } from 'ari-client';
import { config } from '../config/config';
import { InboundNumber } from '../entities/InboundNumber';
import { logger } from '../misc/Logger';
import { AriData } from '../types/AriData';
import { CallRecordingService } from './CallRecordingService';
import { InboundNumberService } from './InboundNumberService';
import { PromptCitationData } from '../types/PromptCitationData';
import { CitationApiService } from './CitationApiService';
import { CallbackQueue } from '../queues/CallbackQueue';
import { PJSIPService } from './PJSIPService';

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

    const callResult = { success: false };
    const outboundChannel = client.Channel();

    logger.debug(`Calling queue member ${phoneNumber}`);

    try {
      await outboundChannel.originate({
        endpoint: phoneNumber.length > 4 ? `PJSIP/${phoneNumber}@${config.trunkName}` : `PJSIP/${phoneNumber}`,
        app: config.ari.app,
        appArgs: 'dialed',
        timeout: isPromptCitationQueue ? config.promptCitation.queue.ringTime : config.inboundQueue.ringTime,
        callerId: inboundChannel.caller.number,
      });
    } catch (err) {
      logger.error(`Error while calling queue member ${phoneNumber}`, err);
      return false;
    }

    inboundChannel.on('StasisEnd', (): void => {
      logger.debug(`Inbound channel ${inboundChannel.id} got StasisEnd`);
      void InboundNumberService.hangupChannel(outboundChannel);
    });

    if (isPromptCitationQueue) {
      this.callPromptCitationQueueMember(
        { outboundChannel, phoneNumber },
        callResult,
        promptCitationData as PromptCitationData,
        ariData
      );
    } else {
      this.callInboundQueueMember({ outboundChannel, phoneNumber }, callResult, ariData);
    }

    try {
      return await new Promise(resolve => {
        outboundChannel.once('ChannelDestroyed', () => {
          logger.debug(`External channel ${outboundChannel.id} got ChannelDestroyed`);
          resolve(callResult.success);
        });
      });
    } catch (err) {
      return false;
    }
  }

  static callInboundQueueMember(
    outboundData: { phoneNumber: string; outboundChannel: Channel },
    callResult: { success: boolean },
    ariData: AriData
  ): void {
    const { channel: inboundChannel, client } = ariData;
    const { outboundChannel, phoneNumber: outboundPhoneNumber } = outboundData;

    logger.debug(`Called inbound queue member ${outboundPhoneNumber}`);

    outboundChannel.on('StasisStart', (): void => {
      logger.debug(`External queue channel ${outboundChannel.id} got StasisStart`);
      const bridge = client.Bridge();

      outboundChannel.once('StasisEnd', async (): Promise<void> => {
        logger.debug(`External queue channel ${outboundChannel.id} got StasisEnd`);

        logger.debug(`Destroying bridge ${bridge.id}`);
        await InboundNumberService.destroyBridge(bridge);
        await InboundNumberService.hangupChannel(inboundChannel);
      });

      outboundChannel.answer((): void => {
        callResult.success = true;
        logger.debug(`External queue channel ${outboundChannel.id} answered`);
        bridge.create({ type: 'mixing' }, async (): Promise<void> => {
          logger.debug(`Bridge ${bridge.id} created`);
          await inboundChannel.answer();
          await bridge.addChannel({ channel: [inboundChannel.id, outboundChannel.id] });
          logger.debug(`Channels ${inboundChannel.id} and ${outboundChannel.id} were added to bridge ${bridge.id}`);
        });
      });
    });
  }

  static callPromptCitationQueueMember(
    outboundData: { phoneNumber: string; outboundChannel: Channel },
    callResult: { success: boolean },
    promptCitationData: PromptCitationData,
    ariData: AriData
  ): void {
    const { channel: inboundChannel, client } = ariData;
    const { outboundChannel, phoneNumber: outboundPhoneNumber } = outboundData;

    logger.debug(`Called prompt citation queue member ${outboundPhoneNumber}`);

    const callbackChannel = client.Channel();
    const callbackBridge = client.Bridge();
    const bridge = client.Bridge();

    outboundChannel.once('StasisStart', async () => {
      logger.debug(`External queue channel ${outboundChannel.id} answered`);
      await InboundNumberService.stopPlayback(ariData.playback as Playback);

      try {
        await client.channels.get({ channelId: inboundChannel.id });
      } catch (err) {
        await this.promptCitationCallback(callbackChannel, outboundChannel, bridge, callbackBridge);
      }

      callResult.success = true;
      await InboundNumberService.stopMusicOnHold(inboundChannel);

      try {
        outboundChannel.once('StasisEnd', () => {
          logger.debug(`External queue channel ${outboundChannel.id} got StasisEnd`);

          logger.debug(`Destroying bridge ${bridge.id}`);
          void InboundNumberService.destroyBridge(bridge);
          void InboundNumberService.hangupChannel(inboundChannel);
          void InboundNumberService.destroyBridge(callbackBridge);
          void InboundNumberService.hangupChannel(callbackChannel);
        });

        promptCitationData.extension = outboundPhoneNumber;
        void CitationApiService.sendNotificationRequest(promptCitationData);

        bridge.create({ type: 'mixing' }, () => {
          logger.debug(`Bridge ${bridge.id} created`);
          // await inboundChannel.answer();
          void bridge.addChannel({ channel: [inboundChannel.id, outboundChannel.id] });
          logger.debug(`Channels ${inboundChannel.id} and ${outboundChannel.id} were added to bridge ${bridge.id}`);
        });
      } catch (err) {
        logger.debug('No outbound channel');
      }
    });
  }

  static async promptCitationCallback(
    callbackChannel: Channel,
    outboundChannel: Channel,
    bridge: Bridge,
    callbackBridge: Bridge
  ): Promise<void> {
    // TODO: Proceed with callback from the callback queue
    const callbackQueue = CallbackQueue.getInstance<PromptCitationData>();
    const callbackData = callbackQueue.dequeue();

    if (callbackData) {
      logger.debug(`Proceeding with callback to ${callbackData.dialedPhoneNumber}`);

      callbackChannel.once('StasisStart', () => {
        logger.debug(`Callback channel ${callbackChannel.id} answered`);

        callbackChannel.once('StasisEnd', () => {
          logger.debug(`Callback channel ${callbackChannel.id} got StasisEnd`);
          logger.debug(`Destroying bridge ${callbackBridge.id}`);
          void InboundNumberService.destroyBridge(bridge);
          void InboundNumberService.destroyBridge(callbackBridge);
          void InboundNumberService.hangupChannel(outboundChannel);
        });

        callbackBridge.create({ type: 'mixing' }, async () => {
          logger.debug(`Bridge ${callbackBridge.id} created`);
          await callbackBridge.addChannel({ channel: [outboundChannel.id, callbackChannel.id] });
          logger.debug(
            `Channels ${outboundChannel.id} and ${callbackChannel.id} were added to bridge ${callbackBridge.id}`
          );
        });
      });

      try {
        const { callerIdNumber: phoneNumber, dialedPhoneNumber } = callbackData;

        await callbackChannel.originate({
          endpoint: phoneNumber.length > 4 ? `PJSIP/${phoneNumber}@${config.trunkName}` : `PJSIP/${phoneNumber}`,
          app: config.ari.app,
          appArgs: 'dialed',
          callerId: dialedPhoneNumber,
        });

        logger.debug(`Callback channel ${callbackChannel.id} originated to ${phoneNumber}`);
      } catch (err) {
        logger.error(`Error while calling back to ${callbackData.dialedPhoneNumber}: ${err}`);
      }
    }
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
    const agentChannels: Channel[] = [];
    for (const number of queueNumbers) {
      const channel = ariData.client.Channel();
      agentChannels.push(channel);

      try {
        await ariData.client.channels.get({ channelId: ariData.channel.id });
        success = await this.callQueueMember(number, ariData, isPromptCitationQueue, promptCitationData);

        if (success) {
          for (const ch of agentChannels) {
            void InboundNumberService.hangupChannel(ch);
          }
          break;
        }
      } catch (err) {
        logger.debug('Inbound channel is not alive anymore');
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
      void InboundNumberService.redirectInboundChannelToVoicemail(inboundChannel, inboundNumber);
    }
  }

  static async callbackRequestHandler(promptCitationData: PromptCitationData, ariData: AriData): Promise<void> {
    const { channel: inboundChannel, dtmfReceiveEvent: event, playback, liveRecording } = ariData;
    if (event?.digit !== '1') {
      return;
    }

    logger.info(`Channel ${inboundChannel.id} pressed 1 to request a callback, processing`);
    inboundChannel.removeAllListeners('ChannelDtmfReceived');
    await InboundNumberService.stopPlayback(playback as Playback);
    await InboundNumberService.stopRecording(inboundChannel, liveRecording);

    const callbackQueue = CallbackQueue.getInstance<PromptCitationData>();
    callbackQueue.enqueue(promptCitationData);

    // TODO: we need to say phone number here
    void inboundChannel.play(
      {
        media: [
          `sound:${config.promptCitation.queueCallbackConfirmationSoundOne}`,
          `sound:${config.promptCitation.queueCallbackConfirmationSoundTwo}`,
        ],
      },
      playback as Playback
    );

    (playback as Playback).once('PlaybackFinished', async () => {
      await InboundNumberService.hangupChannel(inboundChannel);
    });
  }

  static async promptCitationQueueHandler(
    inboundNumber: InboundNumber,
    promptCitationData: PromptCitationData,
    ariData: AriData
  ): Promise<void> {
    const { channel: inboundChannel, client } = ariData;

    const queueNumbers = InboundQueueService.getListOfQueuePhoneNumbers(inboundNumber);
    const { available: availableQueueMembers, busy: busyQueueMembers } = await PJSIPService.findAvailableAndBusyUsers(
      queueNumbers,
      client
    );

    if (availableQueueMembers.length > 0) {
      return this.callAvailableQueueMembers(availableQueueMembers, inboundNumber, promptCitationData, ariData);
    }

    if (busyQueueMembers.length > 0) {
      // start the queue
      return this.callBusyQueueMembers(busyQueueMembers, inboundNumber, promptCitationData, ariData);
    }

    return InboundNumberService.redirectPromptCitationChannelToVoicemail(inboundChannel, inboundNumber);
  }

  static async callAvailableQueueMembers(
    queueMembers: string[],
    inboundNumber: InboundNumber,
    promptCitationData: PromptCitationData,
    ariData: AriData
  ): Promise<void> {
    const { channel: inboundChannel } = ariData;
    logger.debug(`Calling available queue members ${queueMembers.join(', ')}`);

    const liveRecording = await CallRecordingService.createRecordingChannel(ariData);

    inboundChannel.on('StasisEnd', async (event: StasisEnd, channel: Channel): Promise<void> => {
      await InboundNumberService.stopRecording(channel, liveRecording);
      logger.debug(`${event.type} on ${channel.name}`);
    });

    await InboundNumberService.startMusicOnHold(inboundChannel);

    logger.debug(
      `Starting inbound queue for ${promptCitationData.dialedPhoneNumber} and channel ${inboundChannel.name}`
    );
    const success = await InboundQueueService.callQueueMembers(queueMembers, { ...ariData }, true, promptCitationData);

    await InboundNumberService.stopMusicOnHold(inboundChannel);

    if (!success) {
      return InboundNumberService.redirectPromptCitationChannelToVoicemail(inboundChannel, inboundNumber);
    }
  }

  static async callBusyQueueMembers(
    queueMembers: string[],
    inboundNumber: InboundNumber,
    promptCitationData: PromptCitationData,
    ariData: AriData
  ): Promise<void> {
    const { channel: inboundChannel, client } = ariData;
    logger.debug(`Calling busy queue members ${queueMembers.join(', ')}`);

    const liveRecording = await CallRecordingService.createRecordingChannel(ariData);
    const playback = client.Playback();

    inboundChannel.on('StasisEnd', async (event: StasisEnd, channel: Channel): Promise<void> => {
      await InboundNumberService.stopRecording(channel, liveRecording);
      logger.debug(`${event.type} on ${channel.name}`);
    });

    inboundChannel.on('ChannelDtmfReceived', async (event: ChannelDtmfReceived): Promise<void> => {
      await this.callbackRequestHandler(promptCitationData, {
        ...ariData,
        dtmfReceiveEvent: event,
        playback,
        liveRecording,
        channel: inboundChannel,
      });
    });

    try {
      await inboundChannel.play({ media: `sound:${config.promptCitation.queueCallbackInfoSound}` }, playback);
      await InboundNumberService.startMusicOnHold(inboundChannel);
    } catch (err) {
      logger.error('Cannot play callback info sound on an inbound channel — there is no channel anymore');
      return;
    }

    const playCallbackInfoSoundInterval = setInterval(async () => {
      try {
        await InboundNumberService.stopMusicOnHold(inboundChannel);
        await inboundChannel.play({ media: `sound:${config.promptCitation.queueCallbackInfoSound}` }, playback);
        await InboundNumberService.startMusicOnHold(inboundChannel);
      } catch (err) {
        logger.debug(`Failed to process callback info audio interval on channel ${inboundChannel.id}`);
      }
    }, config.promptCitation.queueCallbackInfoSoundInterval);

    logger.debug(
      `Starting inbound queue for ${promptCitationData.dialedPhoneNumber} and channel ${inboundChannel.name}`
    );
    const success = await InboundQueueService.callQueueMembers(
      queueMembers,
      { ...ariData, playback },
      true,
      promptCitationData
    );

    clearInterval(playCallbackInfoSoundInterval);
    await InboundNumberService.stopMusicOnHold(inboundChannel);

    if (!success) {
      return InboundNumberService.redirectPromptCitationChannelToVoicemail(inboundChannel, inboundNumber);
    }
  }
}
