import { FollowMe } from '../entities/FollowMe';
import { dataSource } from '../data-source';

// FIXME: test git
export class FollowMeService {
  static async getFollowMeData(extension: string): Promise<FollowMe | null> {
    return await dataSource.getRepository(FollowMe).findOne({ where: { extension } });
  }
}
