import { dataSource } from '../data-source';
import { InboundNumber } from '../entities/InboundNumber';

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
}
