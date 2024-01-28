import axios from 'axios';
import { Channel, Bridge } from 'ari-client';

import { dataSource } from '../data-source';
import { InboundNumber } from '../entities/InboundNumber';
import { Voicemail } from '../entities/Voicemail';
import { VoicemailService } from './VoicemailService';
import { logger } from '../misc/Logger';
import { AriData } from '../types/AriData';
import { WithRequired } from '../types/WithRequired';
import { FollowMeService } from './FollowMeService';

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
      total_not_listened_vm: await VoicemailService.countNotListened()
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

    incomingChannel.once('StasisEnd', () => {
      logger.debug(`Incoming channel ${incomingChannel.id} got StasisEnd`);

      logger.debug(`Hanging up internal channel ${internalChannel.id}`);
      this.hangupChannel(internalChannel);
    });

    internalChannel.once('ChannelDestroyed', () => {
      logger.debug(`Internal channel ${internalChannel.id} got ChannelDestroyed`);

      logger.debug(`Hanging up incoming channel ${incomingChannel.id}`);
      this.hangupChannel(incomingChannel);
    });

    internalChannel.once('StasisStart', () => {
      logger.debug(`Internal channel ${internalChannel.id} got StasisStart`);

      const bridge = client.Bridge();

      internalChannel.once('StasisEnd', () => {
        logger.debug(`Internal channel ${internalChannel.id} got StasisEnd`);

        logger.debug(`Destroying bridge ${bridge.id}`);
        this.destroyBridge(bridge);
      });

      internalChannel.answer(() => {
        bridge.create({ type: 'mixing' }, () => {
          logger.debug(`Bridge ${bridge.id} created`);
          bridge.addChannel({ channel: [incomingChannel.id, internalChannel.id] });
          logger.debug(`Channels ${incomingChannel.id} and ${internalChannel.id} were added to bridge ${bridge.id}`);
        });
      });
    });

    try {
      await internalChannel.originate({
        endpoint: `PJSIP/${internalNumber}`,
        app: appName,
        appArgs: 'dialed',
        callerId: `MT <${incomingChannel.caller.number}>`
      });
      logger.debug(`Calling PJSIP/${internalNumber} on channel ${internalChannel.id}`);
      return true;
    } catch (err) {
      logger.error(`Failed to call PJSIP/${internalNumber}: ${err}`);

      logger.debug(`Trying to get FollowMe data for ${internalNumber}`);
      const followMeData = await FollowMeService.getFollowMeData(internalNumber);
      if (followMeData) {
        await this.bridgeIncomingCallWithExternalNumber(followMeData.followme_number, ariData);
      } else {
        await this.hangupChannel(incomingChannel);
      }
      return false;
    }
  }

  static async bridgeIncomingCallWithExternalNumber(externalNumber: string, ariData: AriData): Promise<boolean> {
    const { client, channel: incomingChannel, appName, trunkName, callerId } = ariData;
    const externalChannel = client.Channel();

    incomingChannel.once('StasisEnd', () => {
      logger.debug(`Incoming channel ${incomingChannel.id} got StasisEnd`);

      logger.debug(`Hanging up external channel ${externalChannel.id}`);
      this.hangupChannel(externalChannel);
    });

    externalChannel.once('ChannelDestroyed', () => {
      logger.debug(`External channel ${externalChannel.id} got ChannelDestroyed`);

      logger.debug(`Hanging up incoming channel ${incomingChannel.id}`);
      this.hangupChannel(incomingChannel);
    });

    externalChannel.once('StasisStart', () => {
      logger.debug(`External channel ${externalChannel.id} got StasisStart`);

      const bridge = client.Bridge();

      externalChannel.once('StasisEnd', () => {
        logger.debug(`External channel ${externalChannel.id} got StasisEnd`);

        logger.debug(`Destroying bridge ${bridge.id}`);
        this.destroyBridge(bridge);
      });

      externalChannel.answer(() => {
        bridge.create({ type: 'mixing' }, () => {
          logger.debug(`Bridge ${bridge.id} created`);
          bridge.addChannel({ channel: [incomingChannel.id, externalChannel.id] });
          logger.debug(`Channels ${incomingChannel.id} and ${externalChannel.id} were added to bridge ${bridge.id}`);
        });
      });
    });

    try {
      await externalChannel.originate({
        endpoint: `PJSIP/${externalNumber}@${trunkName}`,
        app: appName,
        appArgs: 'dialed',
        callerId
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

  static async destroyBridge(bridge: Bridge): Promise<void> {
    try {
      await bridge.destroy();
      logger.debug(`Bridge ${bridge.id} destroyed`);
    } catch (err) {
      logger.debug(`Failed to destroy bridge ${bridge.id} — nothing to destroy`);
    }
  }
}
