import { config } from '../config/config';
import { InboundNumber } from '../entities/InboundNumber';
import { logger } from '../misc/Logger';
import { AriData } from '../types/AriData';
import { InboundNumberService } from './InboundNumberService';

export class InboundQueueService {
  static getListOfQueuePhoneNumbers(inboundNumber: InboundNumber): string[] {
    return inboundNumber.queue_numbers.split(',').map(phone => phone.trim());
  }

  static async callQueueMember(phoneNumber: string, ariData: AriData): Promise<boolean> {
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
      logger.debug(`External queue channel ${outboundChannel.id} got StasisStart`);
      const bridge = client.Bridge();

      outboundChannel.once('StasisEnd', () => {
        logger.debug(`External queue channel ${outboundChannel.id} got StasisEnd`);

        logger.debug(`Destroying bridge ${bridge.id}`);
        InboundNumberService.destroyBridge(bridge);
      });

      outboundChannel.answer(() => {
        success = true;
        logger.debug(`External queue channel ${outboundChannel.id} answered`);
        bridge.create({ type: 'mixing' }, () => {
          logger.debug(`Bridge ${bridge.id} created`);
          bridge.addChannel({ channel: [inboundChannel.id, outboundChannel.id] });
          logger.debug(`Channels ${inboundChannel.id} and ${outboundChannel.id} were added to bridge ${bridge.id}`);
        });
      });
    });

    return await new Promise(resolve => {
      outboundChannel.once('ChannelDestroyed', () => {
        logger.debug(`External channel ${outboundChannel.id} got ChannelDestroyed`);
        resolve(success);
      });
    });
  }

  static async callQueueMembers(queueNumbers: string[], ariData: AriData): Promise<boolean> {
    if (queueNumbers.length === 0) {
      logger.error(`No queue numbers found`);
      return false;
    }

    logger.debug(`Calling queue members ${queueNumbers.join(', ')}`);

    let success = false;
    for (const number of queueNumbers) {
      success = await this.callQueueMember(number, ariData);

      if (success) {
        break;
      }
    }

    return success;
  }
}
