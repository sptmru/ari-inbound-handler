import axios from 'axios';
import { Channel, Bridge, LiveRecording, ChannelDtmfReceived, Playback } from 'ari-client';

import { dataSource } from '../data-source';
import { InboundNumber } from '../entities/InboundNumber';
import { Voicemail } from '../entities/Voicemail';
import { VoicemailService } from './VoicemailService';
import { logger } from '../misc/Logger';
import { AriData } from '../types/AriData';
import { WithRequired } from '../types/WithRequired';
import { FollowMeService } from './FollowMeService';
import { CallRecordingService } from './CallRecordingService';
import { config } from '../config/config';
import { InboundQueueService } from './InboundQueueService';
import { PromptCitationData } from '../types/PromptCitationData';

export class InboundNumberService {
  static async getInboundNumbers(): Promise<InboundNumber[]> {
    return await dataSource.getRepository(InboundNumber).find();
  }

  static async getInboundNumber(phone: string): Promise<InboundNumber | null> {
    return await dataSource.getRepository(InboundNumber).findOne({ where: { phone } });
  }

  static async getInboundNumberByVoicemail(voicemail: string): Promise<InboundNumber | null> {
    return await dataSource.getRepository(InboundNumber).findOne({ where: { voicemail } });
  }

  static getListOfEmails(inboundNumber: InboundNumber): string[] {
    return inboundNumber.vm_notification.split(',').map(email => email.trim());
  }

  static async sendPushNotification(url: string, voicemail: Voicemail, inboundNumber: InboundNumber): Promise<void> {
    const payload = {
      voicemail_id: voicemail.id,
      court_id: inboundNumber.court_id,
      not_listened_vm: await VoicemailService.countNotListenedForCourt(voicemail.origmailbox),
      total_not_listened_vm: await VoicemailService.countNotListened(),
    };

    const data = Object.keys(payload)
      .map(key => `${key}=${encodeURIComponent(payload[key])}`)
      .join('&');

    try {
      await axios.post(url, data);
      logger.debug(`Push notification sent to ${url} for voicemail ${payload.voicemail_id}`);
    } catch (error) {
      logger.error(`Push notification sending error: ${error}`);
    }

    return;
  }

  static async handleInternalNumberDtmf(
    internalNumber: Array<string>,
    ariData: WithRequired<AriData, 'dtmfReceiveEvent'>
  ): Promise<void> {
    const { dtmfReceiveEvent, channel, playback } = ariData;
    const digit = dtmfReceiveEvent.digit;
    logger.debug(`Channel ${channel.id} received DTMF digit ${digit}`);

    internalNumber.push(digit);
    if (internalNumber.length > 3) {
      channel.removeAllListeners('ChannelDtmfReceived');
      logger.debug(
        `Internal number ${internalNumber.join('')} collected on channel ${
          dtmfReceiveEvent.channel.id
        }, stopping DTMF listener and playback`
      );
      try {
        await playback?.stop();
      } catch (err) {
        logger.debug(`Stopping playback failed on ${channel.id}: there is no playback to stop`);
      }
      return this.bridgeIncomingCallWithInternalNumber(internalNumber.join(''), ariData).then(() => {});
    }
  }

  static async bridgeIncomingCallWithInternalNumber(internalNumber: string, ariData: AriData): Promise<boolean> {
    const { client, channel: incomingChannel, appName } = ariData;
    const internalChannel = client.Channel();
    let liveRecording: LiveRecording | undefined = undefined;

    incomingChannel.once('StasisEnd', async () => {
      logger.debug(`Incoming channel ${incomingChannel.id} got StasisEnd`);

      await InboundNumberService.stopRecording(incomingChannel, liveRecording);

      logger.debug(`Hanging up internal channel ${internalChannel.id}`);
      await this.hangupChannel(internalChannel);
    });

    internalChannel.once('ChannelDestroyed', () => {
      logger.debug(`Internal channel ${internalChannel.id} got ChannelDestroyed`);

      logger.debug(`Hanging up incoming channel ${incomingChannel.id}`);
      void this.hangupChannel(incomingChannel);
    });

    internalChannel.once('StasisStart', () => {
      logger.debug(`Internal channel ${internalChannel.id} got StasisStart`);

      const bridge = client.Bridge();

      internalChannel.once('StasisEnd', () => {
        logger.debug(`Internal channel ${internalChannel.id} got StasisEnd`);

        logger.debug(`Destroying bridge ${bridge.id}`);
        void this.destroyBridge(bridge);
      });

      internalChannel.answer(async () => {
        logger.debug(`Internal channel ${internalChannel.id} answered`);
        liveRecording = await CallRecordingService.createRecordingChannel(ariData);
        bridge.create({ type: 'mixing' }, () => {
          logger.debug(`Bridge ${bridge.id} created`);
          void bridge.addChannel({ channel: [incomingChannel.id, internalChannel.id] });
          logger.debug(`Channels ${incomingChannel.id} and ${internalChannel.id} were added to bridge ${bridge.id}`);
        });
      });
    });

    try {
      await internalChannel.originate({
        endpoint: `PJSIP/${internalNumber}`,
        app: appName,
        appArgs: 'dialed',
        callerId: `MT <${incomingChannel.caller.number}>`,
      });
      logger.debug(`Calling PJSIP/${internalNumber} on channel ${internalChannel.id}`);
      return true;
    } catch (err) {
      logger.error(`Failed to call PJSIP/${internalNumber}: ${err}`);

      logger.debug(`Trying to get FollowMe data for ${internalNumber}`);
      const followMeData = await FollowMeService.getFollowMeData(internalNumber);
      if (followMeData) {
        await this.bridgeIncomingCallWithExternalNumber(followMeData.followme_number, { ...ariData, liveRecording });
      } else {
        await this.hangupChannel(incomingChannel);
      }
      return false;
    }
  }

  static async bridgeIncomingCallWithExternalNumber(externalNumber: string, ariData: AriData): Promise<boolean> {
    const { client, channel: incomingChannel, appName, trunkName, callerId } = ariData;
    const externalChannel = client.Channel();

    incomingChannel.once('StasisEnd', async () => {
      logger.debug(`Incoming channel ${incomingChannel.id} got StasisEnd`);

      await InboundNumberService.stopRecording(incomingChannel, ariData.liveRecording);

      logger.debug(`Hanging up external channel ${externalChannel.id}`);
      await this.hangupChannel(externalChannel);
    });

    externalChannel.once('ChannelDestroyed', () => {
      logger.debug(`External channel ${externalChannel.id} got ChannelDestroyed`);

      logger.debug(`Hanging up incoming channel ${incomingChannel.id}`);
      void this.hangupChannel(incomingChannel);
    });

    externalChannel.once('StasisStart', () => {
      logger.debug(`External channel ${externalChannel.id} got StasisStart`);

      const bridge = client.Bridge();

      externalChannel.once('StasisEnd', () => {
        logger.debug(`External channel ${externalChannel.id} got StasisEnd`);

        logger.debug(`Destroying bridge ${bridge.id}`);
        void this.destroyBridge(bridge);
      });

      externalChannel.answer(() => {
        bridge.create({ type: 'mixing' }, () => {
          logger.debug(`Bridge ${bridge.id} created`);
          void bridge.addChannel({ channel: [incomingChannel.id, externalChannel.id] });
          logger.debug(`Channels ${incomingChannel.id} and ${externalChannel.id} were added to bridge ${bridge.id}`);
        });
      });
    });

    try {
      await externalChannel.originate({
        endpoint: `PJSIP/${externalNumber}@${trunkName}`,
        app: appName,
        appArgs: 'dialed',
        callerId,
      });
      logger.debug(`Calling PJSIP/${externalNumber} on channel ${externalChannel.id}`);
      return true;
    } catch (err) {
      logger.error(`Failed to call PJSIP/${externalNumber}: ${err}`);
      await this.hangupChannel(incomingChannel);
      return false;
    }
  }

  static async hangupChannel(channel: Channel): Promise<void> {
    try {
      await channel.hangup();
      logger.debug(`Hangup channel ${channel.id}`);
    } catch (err) {
      logger.debug(`Failed to hangup channel ${channel.id} — nothing to hangup`);
    }
  }

  static async startMusicOnHold(channel: Channel): Promise<void> {
    try {
      await channel.startMoh();
      logger.debug(`Music on hold started on channel ${channel.id}`);
    } catch (err) {
      logger.error(`Failed to start music on hold on channel ${channel.id}`);
    }
  }

  static async stopMusicOnHold(channel: Channel): Promise<void> {
    try {
      await channel.stopMoh();
      logger.debug(`Music on hold stopped on channel ${channel.id}`);
    } catch (err) {
      logger.error(`Failed to stop music on hold on channel ${channel.id}`);
    }
  }

  static async stopPlayback(playback: Playback): Promise<void> {
    try {
      await playback.stop();
    } catch (err) {
      logger.error(`No  playback anymore, nothing to stop`);
    }
  }

  static async stopRecording(channel: Channel, liveRecording: LiveRecording | undefined): Promise<void> {
    if (!liveRecording) {
      logger.debug(`No live recording found for channel ${channel.id}`);
      return;
    }
    try {
      await liveRecording.stop();
      logger.debug(`Recording on channel ${channel.id} stopped`);
    } catch (err) {
      logger.debug(`Failed to stop recording on channel ${channel.id} — nothing to stop`);
    }
  }

  static async destroyBridge(bridge: Bridge): Promise<void> {
    try {
      await bridge.destroy();
      logger.debug(`Bridge ${bridge.id} destroyed`);
    } catch (err) {
      logger.debug(`Failed to destroy bridge ${bridge.id} — nothing to destroy`);
    }
  }

  static async handleInboundQueue(inboundNumber: InboundNumber, inboundDID: string, ariData: AriData): Promise<void> {
    const { client, channel: inboundChannel } = ariData;
    if (inboundNumber.is_queue) {
      await InboundQueueService.inboundQueueHandler(inboundNumber, inboundDID, {
        client,
        channel: inboundChannel,
        appName: config.ari.app,
        trunkName: config.trunkName,
        callerId: inboundDID,
      });
    } else {
      void this.redirectInboundChannelToVoicemail(inboundChannel, inboundNumber);
    }
  }

  // eslint-disable-next-line max-params
  static async handlePromptCitationDTMFHandler(
    inboundNumber: InboundNumber,
    event: ChannelDtmfReceived,
    ariData: AriData,
    citationNumber: string = ''
  ): Promise<void> {
    const { channel: inboundChannel, playback, inboundDID } = ariData;
    logger.debug(`Channel ${inboundChannel.id} pressed ${event.digit}`);
    await this.stopPlayback(playback as Playback);

    const promptCitationData: PromptCitationData = {
      courtId: inboundNumber.court_id,
      citationNumber: '0',
      dialedPhoneNumber: inboundDID !== undefined ? inboundDID : '',
      callerIdName: inboundChannel.caller.name,
      callerIdNumber: inboundChannel.caller.number,
      extension: '',
    };

    if (!(event.digit === '0' && citationNumber.length === 0) && event.digit !== '#') {
      citationNumber += event.digit;
    }

    if (event.digit === '0' && citationNumber.length === 0) {
      inboundChannel.removeAllListeners('ChannelDtmfReceived');
      logger.debug(`Channel ${inboundChannel.id} pressed 0, starting queue processing`);
      await InboundQueueService.promptCitationQueueHandler(inboundNumber, promptCitationData, ariData);
    } else if (event.digit === '#') {
      inboundChannel.removeAllListeners('ChannelDtmfReceived');
      logger.debug(`Channel ${inboundChannel.id} pressed #, sending citation notification`);
      promptCitationData.citationNumber = citationNumber;
      await InboundQueueService.promptCitationQueueHandler(inboundNumber, promptCitationData, ariData);
    }
  }

  static getCourtAudio(inboundNumber: InboundNumber): string[] {
    const { court_id: courtId } = inboundNumber;
    switch (courtId.toString()) {
      case '16':
        return ['sound:court16'];
      case '18':
        return ['sound:court18'];
      case '19':
      case '20':
        return ['sound:court19'];
      default:
        return [];
    }
  }

  static async handlePromptCitationIvr(inboundNumber: InboundNumber, ariData: AriData): Promise<void> {
    const { client, channel: inboundChannel } = ariData;
    const playback = client.Playback();

    const media = this.getCourtAudio(inboundNumber);
    media.push(`sound:${config.promptCitation.greetingSound}`);

    try {
      await inboundChannel.answer();
      await inboundChannel.play({ media }, playback);
    } catch (err) {
      logger.error(`No inbound channel anymore, stop prompt citation IVR`);
    }

    inboundChannel.on('ChannelDtmfReceived', async event => {
      await this.handlePromptCitationDTMFHandler(inboundNumber, event, { ...ariData, playback });
    });
  }

  static async redirectInboundChannelToVoicemail(inboundChannel: Channel, inboundNumber: InboundNumber): Promise<void> {
    try {
      logger.debug(`Redirecting channel ${inboundChannel.name} to voicemail ${inboundNumber.voicemail}`);
      await inboundChannel.answer();
      await inboundChannel.setChannelVar({ variable: 'MESSAGE', value: inboundNumber.message });
      await inboundChannel.continueInDialplan({
        context: config.voicemail.context,
        extension: inboundNumber.voicemail,
        priority: 1,
      });
    } catch (err) {
      logger.error(
        `Error while redirecting channel ${inboundChannel.name} to voicemail ${inboundNumber.voicemail}`,
        err
      );
    }
  }

  static redirectPromptCitationChannelToVoicemail(inboundChannel: Channel, inboundNumber: InboundNumber): void {
    try {
      logger.debug(`Redirecting channel ${inboundChannel.name} to voicemail ${inboundNumber.voicemail}`);
      void inboundChannel.setChannelVar({ variable: 'MESSAGE', value: inboundNumber.message });
      void inboundChannel.continueInDialplan({
        context: config.voicemail.context,
        extension: inboundNumber.voicemail,
        priority: 1,
      });
    } catch (err) {
      logger.error(
        `Error while redirecting channel ${inboundChannel.name} to voicemail ${inboundNumber.voicemail}`,
        err
      );
    }
  }
}
