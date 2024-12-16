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
import { WavService } from './WavService';
import { ExtensionParametersService } from './ExtensionParametersService';
import { CallbackService } from './CallbackParametersService';
import { QueueData } from '../types/QueueData';
import { QueueStrategies } from '../types/QueueStrategies.enum';

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

    const inboundChannelExists = await PJSIPService.checkIfChannelExists(inboundChannel.id, client);
    const userIsAvailable = await PJSIPService.checkIfUserIsAvailable(phoneNumber, client);

    if (!inboundChannelExists) {
      logger.debug(`Inbound channel ${inboundChannel.id} does not exist anymore`);
      return false;
    }

    if (!userIsAvailable) {
      logger.debug(`Queue member ${phoneNumber} is busy`);
      return false;
    }

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
          CallbackService.getInstance().removeChannel(callbackChannel.id);
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

  static createCallerChannelHangupEventHandlers(agentChannels: Channel[], ariData: AriData): void {
    ariData.channel.on('StasisEnd', () => {
      const callbackRequested = CallbackService.getInstance().checkChannel(ariData.channel.id);
      if (callbackRequested) {
        return;
      }
      for (const ch of agentChannels) {
        void InboundNumberService.hangupChannel(ch);
      }
    });
    ariData.channel.on('ChannelDestroyed', () => {
      const callbackRequested = CallbackService.getInstance().checkChannel(ariData.channel.id);
      if (callbackRequested) {
        return;
      }
      for (const ch of agentChannels) {
        void InboundNumberService.hangupChannel(ch);
      }
    });
  }

  // eslint-disable-next-line max-params
  static async callQueueMembers(
    queueNumbers: string[],
    ariData: AriData,
    isPromptCitationQueue: boolean = false,
    promptCitationData?: PromptCitationData,
    inboundNumber?: InboundNumber
  ): Promise<boolean> {
    if (queueNumbers.length === 0) {
      logger.error(`No queue numbers found`);
      return false;
    }

    logger.debug(`Calling queue members ${queueNumbers.join(', ')}`);

    const success = false;
    const agentChannels: Channel[] = [];
    let callResults: boolean[] | undefined = undefined;

    this.createCallerChannelHangupEventHandlers(agentChannels, ariData);

    switch (inboundNumber?.queue_strategy) {
      case QueueStrategies.ROUNDROBIN:
        await this.callQueueMembersRoundRobin({
          queueNumbers,
          queueChannels: agentChannels,
          ariData,
          isPromptCitationQueue,
          promptCitationData,
          success,
        });
        return success;
      case QueueStrategies.RINGALL:
        callResults = await this.callQueueMembersRingAll({
          queueNumbers,
          queueChannels: agentChannels,
          ariData,
          isPromptCitationQueue,
          promptCitationData,
        });
        return callResults.some(result => result);
      default:
        return false;
    }
  }

  static async callQueueMembersRingAll(queueData: QueueData): Promise<boolean[]> {
    const {
      queueNumbers,
      queueChannels: agentChannels,
      ariData,
      isPromptCitationQueue,
      promptCitationData,
    } = queueData;

    const queueNumbersWithoutRounds = Array.from(new Set(queueNumbers));

    const callPromises = queueNumbersWithoutRounds.map(number => {
      const channel = ariData.client.Channel();
      agentChannels.push(channel);

      // eslint-disable-next-line no-async-promise-executor
      return new Promise<boolean>(async resolve => {
        try {
          await ariData.client.channels.get({ channelId: ariData.channel.id });
          const currentSuccess = await this.callQueueMember(number, ariData, isPromptCitationQueue, promptCitationData);

          if (currentSuccess) {
            for (const ch of agentChannels) {
              if (ch.id !== channel.id) {
                void InboundNumberService.hangupChannel(ch);
              }
            }
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (err) {
          logger.debug('Inbound channel is not alive anymore');
          resolve(false);
        }
      });
    });

    return await Promise.all(callPromises);
  }

  static async callQueueMembersRoundRobin(queueData: QueueData): Promise<void> {
    const {
      queueNumbers,
      queueChannels: agentChannels,
      ariData,
      isPromptCitationQueue,
      promptCitationData,
    } = queueData;
    let { success } = queueData;

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

    let success = false;
    if (queueNumbers.length > 0) {
      success = await InboundQueueService.callQueueMembers(queueNumbers, ariData, false, undefined, inboundNumber);
    }
    
    if (!success) {
      const applyOverflow = await InboundNumberService.checkOverflowStatus(inboundNumber);
      if (applyOverflow) {
        logger.debug(`inboundQueueHandler: overflow status is active for inbound number ${inboundNumber.phone}, calling overflow number ${inboundNumber.overflow_number}`);
        const overflowCallResult = await InboundQueueService.callQueueMember(inboundNumber.overflow_number, ariData, false);
        
        if (overflowCallResult) {
          logger.debug(`inboundQueueHandler: overflow call was successful`);
          return;
        }
      }
      void InboundNumberService.redirectInboundChannelToVoicemail(inboundChannel, inboundNumber);
    }
  }

  static async callbackRequestHandler(promptCitationData: PromptCitationData, ariData: AriData): Promise<void> {
    const { channel: inboundChannel, dtmfReceiveEvent: event, playback, liveRecording } = ariData;
    if (event?.digit !== '1') {
      return;
    }

    logger.info(`Channel ${inboundChannel.id} pressed 1 to request a callback, processing`);

    CallbackService.getInstance().removeChannel(inboundChannel.id); // make sure we won't add a duplicate
    CallbackService.getInstance().addChannel(inboundChannel.id);

    inboundChannel.removeAllListeners('ChannelDtmfReceived');
    inboundChannel.removeAllListeners('StasisEnd');
    await InboundNumberService.stopPlayback(playback as Playback);
    await InboundNumberService.stopRecording(inboundChannel, liveRecording);

    const callbackQueue = CallbackQueue.getInstance<PromptCitationData>();
    callbackQueue.enqueue(promptCitationData);

    const phoneNumberSounds = WavService.getPhoneNumberSounds(inboundChannel.caller.number);
    phoneNumberSounds.unshift(`sound:${config.promptCitation.queueCallbackConfirmationSoundOne}`);
    phoneNumberSounds.push(`sound:${config.promptCitation.queueCallbackConfirmationSoundTwo}`);

    void inboundChannel.play(
      {
        media: phoneNumberSounds,
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
    ariData: AriData,
    playbacks: Playback[] = []
  ): Promise<void> {
    const { channel: inboundChannel, client } = ariData;
    playbacks.forEach(playback => InboundNumberService.stopPlayback(playback));

    const queueNumbers = InboundQueueService.getListOfQueuePhoneNumbers(inboundNumber);
    let { available: availableQueueMembers, busy: busyQueueMembers } = await PJSIPService.findAvailableAndBusyUsers(
      queueNumbers as string[],
      client
    );

    availableQueueMembers = await Promise.all(
      availableQueueMembers.map(async (queueNumber: string): Promise<string> => {
        const extensionIsActive = await ExtensionParametersService.getExtensionStatus(queueNumber);
        return extensionIsActive ? queueNumber : '';
      })
    );
    availableQueueMembers = availableQueueMembers.filter(item => item !== '');

    if (inboundNumber.queue_strategy === QueueStrategies.ROUNDROBIN) {
      availableQueueMembers = this.applyRoundsQuantityToAgentsList(availableQueueMembers as string[]);
      busyQueueMembers = this.applyRoundsQuantityToAgentsList(busyQueueMembers as string[]);
    }
    
    if (availableQueueMembers.length > 0) {
      return this.callAvailableQueueMembers(availableQueueMembers, inboundNumber, promptCitationData, ariData);
    }
    
    if (busyQueueMembers.length > 0) {
      // start the queue
      return this.callBusyQueueMembers(busyQueueMembers, inboundNumber, promptCitationData, ariData);
    }

    return InboundNumberService.handleNoAnswerInPromptCitationQueue(inboundChannel, inboundNumber, ariData, promptCitationData);
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
    const success = await InboundQueueService.callQueueMembers(
      queueMembers,
      { ...ariData },
      true,
      promptCitationData,
      inboundNumber
    );

    await InboundNumberService.stopMusicOnHold(inboundChannel);

    if (!success) {
      return InboundNumberService.handleNoAnswerInPromptCitationQueue(inboundChannel, inboundNumber, ariData, promptCitationData);
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
      promptCitationData,
      inboundNumber
    );

    clearInterval(playCallbackInfoSoundInterval);
    await InboundNumberService.stopMusicOnHold(inboundChannel);

    if (!success) {
      return InboundNumberService.handleNoAnswerInPromptCitationQueue(inboundChannel, inboundNumber, ariData, promptCitationData);
    }
  }

  static applyRoundsQuantityToAgentsList(queueMembers: string[]): string[] {
    const result: string[] = [];
    for (let i = 0; i < config.promptCitation.queue.rounds; i++) {
      result.push(...queueMembers);
    }

    return result;
  }
}
