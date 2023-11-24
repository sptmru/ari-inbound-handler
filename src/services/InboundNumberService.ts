import { Repository } from 'typeorm';

import { dataSource } from '../data-source';
import { InboundNumber } from '../entities/InboundNumber';

export class InboundNumberService {
  private repo: Repository<InboundNumber>;
  constructor() {
    this.repo = dataSource.getRepository(InboundNumber);
  }
  async getInboundNumbers(): Promise<InboundNumber[]> {
    return await this.repo.find();
  }

  async getInboundNumber(phone: string): Promise<InboundNumber | null> {
    return await this.repo.findOne({ where: { phone } });
  }
}
