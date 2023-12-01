import axios from 'axios';

import { dataSource } from '../data-source';
import { InboundNumber } from '../entities/InboundNumber';
import { Voicemail } from '../entities/Voicemail';
import { VoicemailService } from './VoicemailService';
import { logger } from '../misc/Logger';

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

    try {
      await axios.post(url, payload);
      logger.debug(`Push notification sent to ${url} for voicemail ${payload.voicemail_id}`);
    } catch (error) {
      logger.error(`Push notification sending error: ${error}`);
    }

    return;
  }
}
